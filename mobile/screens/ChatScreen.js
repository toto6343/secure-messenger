import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Text,
  Linking,
  TextInput
} from 'react-native';
import { GiftedChat, Bubble, Send, SystemMessage, Actions } from 'react-native-gifted-chat';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { conversationAPI, storage, fileAPI } from '../services/api';
import socketService from '../services/socket';
import {
  getConversationKey,
  createConversationKey,
  storeConversationKey,
  encryptMessage,
  decryptMessage
} from '../utils/encryption';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, conversationName, conversation } = route.params;
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationKey, setConversationKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState(0); // 0 = no timer

  useEffect(() => {
    navigation.setOptions({
      title: conversationName,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => startCall(false)} style={{ marginRight: 15 }}>
            <Ionicons name="call" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => startCall(true)} style={{ marginRight: 15 }}>
            <Ionicons name="videocam" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsSearching(prev => !prev)} style={{ marginRight: 15 }}>
            <Ionicons name="search" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('GroupSettings', { conversationId, conversation })}
            style={{ marginRight: 15 }}
          >
            <Ionicons name="settings" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )
    });

    loadCurrentUser();
    loadMessages();
    setupConversationKey();
    setupSocketListeners();

    // Join conversation room
    socketService.joinConversation(conversationId);

    // Call handlers
    socketService.on('incoming-call', (data) => {
      if (data.conversationId === conversationId) {
        Alert.alert(
          '수신 전화',
          `${data.isVideo ? '영상' : '음성'} 통화가 걸려왔습니다.`,
          [
            { text: '거절', style: 'cancel', onPress: () => socketService.emit('end-call', { conversationId }) },
            { text: '수락', onPress: () => {
              Alert.alert('통화 연결', 'WebRTC P2P 연결을 시작합니다 (데모)');
              socketService.emit('answer-call', { conversationId, signalData: { type: 'answer' } });
            }}
          ]
        );
      }
    });

    socketService.on('call-answered', (data) => {
      if (data.conversationId === conversationId) {
        Alert.alert('통화 수락됨', '상대방이 통화를 수락했습니다. 실시간 통화를 시작합니다.');
      }
    });

    return () => {
      socketService.off('new-message');
      socketService.off('user-typing');
      socketService.off('user-stop-typing');
      socketService.off('message-deleted');
      socketService.off('message-expiry-started');
    };
  }, []);

  const loadCurrentUser = async () => {
    const user = await storage.getUser();
    setCurrentUser(user);
  };

  const startCall = (isVideo) => {
    Alert.alert(
      isVideo ? '영상 통화' : '음성 통화',
      '통화를 시작하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '통화', onPress: () => {
          socketService.emit('call-user', {
            conversationId,
            isVideo,
            signalData: { type: 'offer' }
          });
          Alert.alert('연결 중...', '상대방의 응답을 기다리고 있습니다.');
        }}
      ]
    );
  };

  const setupConversationKey = async () => {
    try {
      // Try to get existing key
      let key = await getConversationKey(conversationId);
      
      // If no key exists, create one
      if (!key) {
        const participantKeys = conversation.participants.map(p => p.publicKey);
        key = await createConversationKey(conversationId, participantKeys);
        await storeConversationKey(conversationId, key);
      }
      
      setConversationKey(key);
    } catch (error) {
      console.error('Setup conversation key error:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const data = await conversationAPI.getMessages(conversationId);
      
      // Convert to GiftedChat format
      const formattedMessages = data.map(msg => {
        const giftMsg = {
          _id: msg._id,
          text: '🔒 암호화된 메시지',
          createdAt: new Date(msg.timestamp),
          user: {
            _id: msg.senderId._id,
            name: msg.senderId.username,
            avatar: msg.senderId.avatar
          },
          encrypted: true,
          encryptedContent: msg.encryptedContent,
          iv: msg.iv,
          messageType: msg.messageType,
          fileUrl: msg.fileUrl,
          fileName: msg.fileName,
          fileSize: msg.fileSize,
          expirySeconds: msg.expirySeconds,
          expiresAt: msg.expiresAt ? new Date(msg.expiresAt) : null
        };
        if (msg.messageType === 'image') {
          giftMsg.image = msg.fileUrl;
        }
        return giftMsg;
      });

      setMessages(formattedMessages);

      // Decrypt messages if we have the key
      if (conversationKey) {
        decryptMessages(formattedMessages);
      }
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const decryptMessages = async (msgs) => {
    const decryptedMessages = msgs.map(msg => {
      if (msg.encrypted) {
        try {
          const decryptedText = decryptMessage(
            msg.encryptedContent,
            msg.iv,
            conversationKey
          );
          return { ...msg, text: decryptedText, encrypted: false };
        } catch (error) {
          console.error('Decrypt error:', error);
          return msg;
        }
      }
      return msg;
    });

    setMessages(decryptedMessages);
  };

  const setupSocketListeners = () => {
    // New message
    socketService.onNewMessage(async (message) => {
      if (message.conversationId === conversationId) {
        let decryptedText = '🔒 암호화된 메시지';
        
        if (conversationKey) {
          try {
            decryptedText = decryptMessage(
              message.encryptedContent,
              message.iv,
              conversationKey
            );
          } catch (error) {
            console.error('Decrypt new message error:', error);
          }
        }

        const newMessage = {
          _id: message._id,
          text: decryptedText,
          createdAt: new Date(message.timestamp),
          user: {
            _id: message.senderId,
            name: 'User',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'
          },
          messageType: message.messageType,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          expirySeconds: message.expirySeconds
        };
        if (message.messageType === 'image') {
          newMessage.image = message.fileUrl;
        }

        setMessages(prev => GiftedChat.append(prev, [newMessage]));
      }
    });

    // Message expiry started
    socketService.onMessageExpiryStarted((data) => {
      setMessages(prev => prev.map(msg => {
        if (msg._id === data.messageId) {
          return { ...msg, expiresAt: new Date(data.expiresAt) };
        }
        return msg;
      }));
    });

    // Typing indicators
    socketService.onUserTyping((data) => {
      if (data.conversationId === conversationId && data.userId !== currentUser?._id) {
        setIsTyping(true);
      }
    });

    socketService.onUserStopTyping((data) => {
      if (data.conversationId === conversationId) {
        setIsTyping(false);
      }
    });

    // Message deleted
    socketService.onMessageDeleted((data) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
      }
    });
  };

  const handleAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (result.canceled) return;
      
      const file = result.assets[0];

      if (!conversationKey) {
        Alert.alert('오류', '암호화 키를 불러올 수 없습니다.');
        return;
      }

      // Upload file
      const uploadData = await fileAPI.upload(file.uri, file.name, file.mimeType);

      // Encrypt placeholder
      const textToEncrypt = `[파일] ${uploadData.fileName}`;
      const { encryptedContent, iv } = await encryptMessage(textToEncrypt, conversationKey);

      let msgType = 'file';
      if (uploadData.mimetype && uploadData.mimetype.startsWith('image/')) {
        msgType = 'image';
      }

      // Send message via socket
      socketService.sendMessage({
        conversationId,
        encryptedContent,
        iv,
        messageType: msgType,
        fileUrl: uploadData.fileUrl,
        fileName: uploadData.fileName,
        fileSize: uploadData.fileSize,
        expirySeconds: expirySeconds
      });

      // Optimistically add to UI (optional, or rely on socket 'new-message' event)
    } catch (error) {
      console.error('Attachment error:', error);
      Alert.alert('오류', '파일 첨부에 실패했습니다.');
    }
  };

  const renderActions = (props) => {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Actions
          {...props}
          options={{
            ['파일 첨부']: handleAttachment,
            ['취소']: () => {}
          }}
          icon={() => (
            <Ionicons name="attach" size={28} color="#007AFF" />
          )}
        />
        <TouchableOpacity 
          onPress={() => {
            const options = [0, 5, 10, 30, 60, 3600];
            const labels = ['해제', '5초', '10초', '30초', '1분', '1시간'];
            Alert.alert(
              '자동 삭제 타이머',
              '메시지를 읽은 후 삭제될 시간을 선택하세요.',
              options.map((opt, i) => ({
                text: labels[i],
                onPress: () => setExpirySeconds(opt)
              }))
            );
          }}
          style={{ marginLeft: -10, marginRight: 5 }}
        >
          <Ionicons 
            name="timer" 
            size={24} 
            color={expirySeconds > 0 ? '#ff3b30' : '#8e8e93'} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  const onSend = useCallback(async (newMessages = []) => {
    if (!conversationKey) {
      Alert.alert('오류', '암호화 키를 불러올 수 없습니다.');
      return;
    }

    const message = newMessages[0];

    try {
      // Encrypt message
      const { encryptedContent, iv } = await encryptMessage(
        message.text,
        conversationKey
      );

      // Send encrypted message
      socketService.sendMessage({
        conversationId,
        encryptedContent,
        iv,
        messageType: 'text',
        expirySeconds: expirySeconds
      });

      // Add to local messages (optimistic)
      const giftMsg = {
        ...message,
        expirySeconds: expirySeconds
      };
      setMessages(prev => GiftedChat.append(prev, [giftMsg]));
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
    }
  }, [conversationKey, expirySeconds]);

  const onInputTextChanged = (text) => {
    if (text && text.length > 0) {
      socketService.typing(conversationId);
    } else {
      socketService.stopTyping(conversationId);
    }
  };

  const showReadStatus = async (messageId) => {
    try {
      const readByList = await messageAPI.getReadStatus(messageId);
      let listStr = readByList.length > 0 
        ? readByList.map(u => `- ${u.username} (${u.status === 'online' ? '온라인' : '오프라인'})`).join('\n')
        : '아직 아무도 읽지 않았습니다.';
      
      Alert.alert('읽음 확인', listStr);
    } catch (error) {
      Alert.alert('오류', '읽음 정보를 가져올 수 없습니다.');
    }
  };

  const onLongPress = (context, message) => {
    const options = ['읽음 확인'];
    if (message.user._id === currentUser?._id) options.push('삭제');
    else options.push('신고');
    options.push('취소');

    Alert.alert(
      '메시지 옵션',
      '수행할 작업을 선택하세요.',
      [
        {
          text: '읽음 확인',
          onPress: () => showReadStatus(message._id)
        },
        {
          text: message.user._id === currentUser?._id ? '삭제' : '신고',
          style: 'destructive',
          onPress: async () => {
            if (message.user._id === currentUser?._id) {
              try {
                await messageAPI.delete(message._id);
                setMessages(prev => prev.filter(msg => msg._id !== message._id));
              } catch (error) {
                Alert.alert('오류', '메시지 삭제에 실패했습니다.');
              }
            } else {
              Alert.prompt(
                '신고 사유',
                '신고 사유를 입력해주세요',
                async (reason) => {
                  if (reason) {
                    try {
                      await messageAPI.report(message._id, reason, '');
                      Alert.alert('완료', '신고가 접수되었습니다.');
                    } catch (error) {
                      Alert.alert('오류', '신고에 실패했습니다.');
                    }
                  }
                }
              );
            }
          }
        },
        {
          text: '취소',
          style: 'cancel'
        }
      ]
    );
  };

  const renderCustomView = (props) => {
    const { currentMessage } = props;
    if (currentMessage.messageType === 'file' && currentMessage.fileUrl) {
      return (
        <TouchableOpacity 
          style={{ padding: 10, flexDirection: 'row', alignItems: 'center' }}
          onPress={() => Linking.openURL(currentMessage.fileUrl)}
        >
          <Ionicons name="document-text" size={30} color={currentMessage.user._id === currentUser?._id ? '#fff' : '#007AFF'} />
          <View style={{ marginLeft: 10 }}>
            <Text style={{ color: currentMessage.user._id === currentUser?._id ? '#fff' : '#333', fontWeight: 'bold' }}>
              {currentMessage.fileName}
            </Text>
            <Text style={{ color: currentMessage.user._id === currentUser?._id ? '#e0e0e0' : '#666', fontSize: 12 }}>
              {(currentMessage.fileSize / 1024).toFixed(1)} KB
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderBubble = (props) => {
    const { currentMessage } = props;
    return (
      <View>
        <Bubble
          {...props}
          wrapperStyle={{
            left: { backgroundColor: '#f0f0f0' },
            right: { backgroundColor: '#007AFF' },
          }}
          textStyle={{
            left: { color: '#333' },
            right: { color: '#fff' },
          }}
        />
        {currentMessage.expirySeconds > 0 && (
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'flex-end',
            paddingRight: 5,
            marginTop: -5,
            marginBottom: 5
          }}>
            <Ionicons name="timer-outline" size={12} color="#8e8e93" />
            <Text style={{ fontSize: 10, color: '#8e8e93', marginLeft: 2 }}>
              {currentMessage.expiresAt 
                ? `폭파까지 ${Math.max(0, Math.floor((currentMessage.expiresAt - new Date()) / 1000))}초`
                : `${currentMessage.expirySeconds}초 후 삭제`
              }
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSend = (props) => {
    return (
      <Send {...props}>
        <View style={styles.sendButton}>
          <Ionicons name="send" size={22} color="#FFF" />
        </View>
      </Send>
    );
  };

  const filteredMessages = searchQuery
    ? messages.filter(msg => msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <View style={styles.container}>
      {isSearching && (
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="메시지 검색..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}
      <GiftedChat
        messages={filteredMessages}
        onSend={onSend}
        onInputTextChanged={onInputTextChanged}
        onLongPress={onLongPress}
        user={{
          _id: currentUser?._id || '',
          name: currentUser?.username || '',
          avatar: currentUser?.avatar || ''
        }}
        renderBubble={renderBubble}
        renderSend={renderSend}
        renderActions={renderActions}
        renderCustomView={renderCustomView}
        isTyping={isTyping}
        placeholder="메시지를 입력하세요..."
        alwaysShowSend
        scrollToBottom
        renderUsernameOnMessage
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  sendButton: {
    marginRight: 10,
    marginBottom: 10,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    marginRight: 10,
    fontSize: 16,
    color: '#0F172A',
  },
});
