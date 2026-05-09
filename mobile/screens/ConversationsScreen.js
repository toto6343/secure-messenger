import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { conversationAPI, storage } from '../services/api';
import { getConversationKey, decryptMessage } from '../utils/encryption';
import socketService from '../services/socket';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ConversationsScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadCurrentUser();
    loadConversations();
    setupSocketListeners();

    return () => {
      socketService.offAll();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [])
  );

  const loadCurrentUser = async () => {
    const user = await storage.getUser();
    setCurrentUser(user);
  };

  const loadConversations = async () => {
    try {
      const data = await conversationAPI.getAll();
      setConversations(data);
    } catch (error) {
      console.error('Load conversations error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.onNewMessage((message) => {
      // Update conversation list with new message
      loadConversations();
    });

    socketService.onUserStatusChanged((data) => {
      setConversations(prev =>
        prev.map(conv => {
          const updatedParticipants = conv.participants.map(p =>
            p._id === data.userId ? { ...p, status: data.status } : p
          );
          return { ...conv, participants: updatedParticipants };
        })
      );
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const getOtherParticipant = (conversation) => {
    if (!currentUser) return null;
    return conversation.participants.find(p => p._id !== currentUser._id);
  };

  const getConversationName = (conversation) => {
    if (conversation.type === 'group') {
      return conversation.name || '그룹 채팅';
    }
    const other = getOtherParticipant(conversation);
    return other?.username || '알 수 없음';
  };

  const getConversationAvatar = (conversation) => {
    if (conversation.type === 'group') {
      return conversation.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=Group';
    }
    const other = getOtherParticipant(conversation);
    return other?.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Unknown';
  };

  const renderConversation = ({ item }) => {
    const otherParticipant = getOtherParticipant(item);
    const isOnline = otherParticipant?.status === 'online';
    const conversationName = getConversationName(item);
    const avatar = getConversationAvatar(item);

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => navigation.navigate('Chat', {
          conversationId: item._id,
          conversationName,
          conversation: item
        })}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: avatar }}
            style={styles.avatar}
          />
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName} numberOfLines={1}>
              {conversationName}
            </Text>
            {item.lastMessage && (
              <Text style={styles.timestamp}>
                {formatDistanceToNow(new Date(item.lastMessage.timestamp), {
                  addSuffix: true,
                  locale: ko
                })}
              </Text>
            )}
          </View>

          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage?.content || '메시지가 없습니다'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="chatbubbles-outline" size={60} color="#ccc" />
        <Text style={styles.emptyText}>아직 대화가 없습니다</Text>
        <Text style={styles.emptySubtext}>새 채팅을 시작해보세요!</Text>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => navigation.navigate('NewChat')}
        >
          <Text style={styles.newChatButtonText}>새 채팅 시작하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}
      >
        <Ionicons name="create-outline" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#fff',
  },
  conversationInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#64748B',
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginLeft: 82,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 15,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 5,
  },
  newChatButton: {
    marginTop: 24,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  newChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
