import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Image,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { storage, userAPI } from '../services/api';
import socketService from '../services/socket';

export default function GroupSettingsScreen({ route, navigation }) {
  const { conversationId, conversation } = route.params;
  const [currentUser, setCurrentUser] = useState(null);
  const [participants, setParticipants] = useState(conversation.participants);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    setupSocketListeners();
    
    return () => {
      socketService.off('member-added');
      socketService.off('member-removed');
      socketService.off('admin-promoted');
    };
  }, []);

  const loadCurrentUser = async () => {
    const user = await storage.getUser();
    setCurrentUser(user);
    setIsAdmin(conversation.admins.includes(user._id));
  };

  const setupSocketListeners = () => {
    socketService.onMemberAdded((data) => {
      if (data.conversationId === conversationId) {
        // Refresh participants logic here
        Alert.alert('정보', '새로운 멤버가 추가되었습니다.');
      }
    });

    socketService.onMemberRemoved((data) => {
      if (data.conversationId === conversationId) {
        setParticipants(prev => prev.filter(p => p._id !== data.userId));
        if (data.userId === currentUser?._id) {
          Alert.alert('정보', '그룹에서 제외되었습니다.', [
            { text: '확인', onPress: () => navigation.popToTop() }
          ]);
        }
      }
    });

    socketService.onAdminPromoted((data) => {
      if (data.conversationId === conversationId && data.userId === currentUser?._id) {
        setIsAdmin(true);
        Alert.alert('정보', '관리자로 임명되었습니다.');
      }
    });
  };

  const handleAddMember = () => {
    navigation.navigate('NewChat', { 
      isAddingToGroup: true, 
      conversationId 
    });
  };

  const handleRemoveMember = (userId, username) => {
    Alert.alert(
      '멤버 제외',
      `${username}님을 그룹에서 제외하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '제외', 
          style: 'destructive',
          onPress: () => socketService.removeMember(conversationId, userId)
        }
      ]
    );
  };

  const handlePromoteAdmin = (userId, username) => {
    Alert.alert(
      '관리자 임명',
      `${username}님을 관리자로 임명하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '임명', 
          onPress: () => socketService.promoteAdmin(conversationId, userId)
        }
      ]
    );
  };

  const renderParticipant = ({ item }) => {
    const isItemAdmin = conversation.admins.includes(item._id);
    const isItemCreator = conversation.creator === item._id;
    const isMe = item._id === currentUser?._id;

    return (
      <View style={styles.participantItem}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>
            {item.username} {isMe ? '(나)' : ''}
          </Text>
          {isItemAdmin && <Text style={styles.adminBadge}>{isItemCreator ? '소유자' : '관리자'}</Text>}
        </View>
        
        {isAdmin && !isMe && !isItemCreator && (
          <View style={styles.actions}>
            {!isItemAdmin && (
              <TouchableOpacity onPress={() => handlePromoteAdmin(item._id, item.username)}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#4cd964" style={{ marginRight: 15 }} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleRemoveMember(item._id, item.username)}>
              <Ionicons name="person-remove-outline" size={24} color="#ff3b30" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>그룹 정보</Text>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>이름</Text>
          <Text style={styles.infoValue}>{conversation.name || '그룹 채팅'}</Text>
        </View>
      </View>

      <View style={[styles.section, { flex: 1 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>참여자 ({participants.length})</Text>
          {isAdmin && (
            <TouchableOpacity onPress={handleAddMember}>
              <Ionicons name="person-add-outline" size={24} color="#007AFF" />
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={participants}
          keyExtractor={(item) => item._id}
          renderItem={renderParticipant}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    color: '#8e8e93',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 16,
    color: '#333',
  },
  infoValue: {
    fontSize: 16,
    color: '#8e8e93',
  },
  participantItem: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  participantInfo: {
    marginLeft: 15,
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  adminBadge: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
