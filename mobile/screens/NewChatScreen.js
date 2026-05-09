import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userAPI, conversationAPI, friendAPI } from '../services/api';
import socketService from '../services/socket';

export default function NewChatScreen({ route, navigation }) {
  const isAddingToGroup = route.params?.isAddingToGroup || false;
  const conversationId = route.params?.conversationId;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const results = await userAPI.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (user) => {
    try {
      if (isAddingToGroup) {
        socketService.addMember(conversationId, user._id);
        Alert.alert('완료', `${user.username}님을 그룹에 초대했습니다.`);
        navigation.goBack();
        return;
      }

      // Create or get existing conversation
      const conversation = await conversationAPI.create([user._id], 'direct');

      // Navigate to chat
      navigation.navigate('Chat', {
        conversationId: conversation._id,
        conversationName: user.username,
        conversation
      });
    } catch (error) {
      console.error('Start chat error:', error);
    }
  };

  const handleAddFriend = async (user) => {
    try {
      await friendAPI.addFriend(user._id);
      Alert.alert('친구 추가', `${user.username}님을 친구로 추가했습니다.`);
    } catch (error) {
      console.error('Add friend error:', error);
      Alert.alert('오류', error.response?.data?.error || '친구 추가에 실패했습니다.');
    }
  };

  const renderUser = ({ item }) => (
    <View style={styles.userItem}>
      <TouchableOpacity
        style={styles.userMainInfo}
        onPress={() => handleStartChat(item)}
      >
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.userInfo}>
          <Text style={styles.username}>{item.username}</Text>
          <Text style={styles.email}>{item.email}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.userActions}>
        {!isAddingToGroup && (
          <TouchableOpacity 
            style={styles.actionIcon} 
            onPress={() => handleAddFriend(item)}
          >
            <Ionicons name="person-add-outline" size={24} color="#3B82F6" />
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.actionIcon} 
          onPress={() => handleStartChat(item)}
        >
          <Ionicons name={isAddingToGroup ? "add-circle-outline" : "chatbubble-outline"} size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="사용자 이름 또는 이메일 검색"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>검색</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderUser}
          keyExtractor={(item) => item._id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : searchQuery.length > 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="person-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={60} color="#ccc" />
          <Text style={styles.emptyText}>사용자를 검색해보세요</Text>
          <Text style={styles.emptySubtext}>사용자 이름 또는 이메일로 검색할 수 있습니다</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 45,
    marginRight: 10,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    justifyContent: 'space-between',
  },
  userMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    padding: 10,
    marginLeft: 5,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 77,
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 5,
    textAlign: 'center',
  },
});
