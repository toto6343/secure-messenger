import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { friendAPI, conversationAPI } from '../services/api';
import socketService from '../services/socket';

export default function FriendsScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFriends();
    
    // Listen for status changes
    socketService.onUserStatusChanged((data) => {
      setFriends(prev =>
        prev.map(friend =>
          friend._id === data.userId ? { ...friend, status: data.status } : friend
        )
      );
    });

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
    }, [])
  );

  const loadFriends = async () => {
    try {
      const data = await friendAPI.getFriends();
      setFriends(data);
    } catch (error) {
      console.error('Load friends error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadFriends();
  };

  const handleStartChat = async (friend) => {
    try {
      const conversation = await conversationAPI.create([friend._id], 'direct');
      navigation.navigate('Chat', {
        conversationId: conversation._id,
        conversationName: friend.username,
        conversation
      });
    } catch (error) {
      console.error('Start chat error:', error);
    }
  };

  const handleRemoveFriend = (friend) => {
    Alert.alert(
      '친구 삭제',
      `${friend.username}님을 친구 목록에서 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { 
          text: '삭제', 
          style: 'destructive',
          onPress: async () => {
            try {
              await friendAPI.removeFriend(friend._id);
              setFriends(prev => prev.filter(f => f._id !== friend._id));
            } catch (error) {
              Alert.alert('오류', '친구 삭제에 실패했습니다.');
            }
          }
        }
      ]
    );
  };

  const renderFriend = ({ item }) => {
    const isOnline = item.status === 'online';

    return (
      <View style={styles.friendItem}>
        <TouchableOpacity 
          style={styles.friendContent}
          onPress={() => handleStartChat(item)}
        >
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: item.avatar }}
              style={styles.avatar}
            />
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>

          <View style={styles.friendInfo}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.statusText}>
              {isOnline ? '온라인' : '오프라인'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleStartChat(item)}
          >
            <Ionicons name="chatbubble-outline" size={22} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleRemoveFriend(item)}
          >
            <Ionicons name="person-remove-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {friends.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>친구 목록이 비어 있습니다</Text>
          <Text style={styles.emptySubtext}>검색을 통해 친구를 추가해보세요!</Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => navigation.navigate('NewChat')}
          >
            <Text style={styles.searchButtonText}>친구 찾기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriend}
          keyExtractor={(item) => item._id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    padding: 20,
  },
  listContent: {
    paddingVertical: 8,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
  },
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  friendInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  statusText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginLeft: 80,
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
    textAlign: 'center',
  },
  searchButton: {
    marginTop: 24,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
