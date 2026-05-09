import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { storage } from '../services/api';
import socketService from '../services/socket';
import { encryptMessage, decryptMessage } from '../utils/encryption';

export default function ProfileScreen({ navigation }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await storage.getUser();
    setUser(userData);
  };

  const handleBackup = async () => {
    Alert.prompt(
      '백업 비밀번호 설정',
      '백업 파일 암호화에 사용할 비밀번호를 입력하세요.',
      async (password) => {
        if (!password) return;
        
        try {
          // Collect data
          const token = await storage.getToken();
          const user = await storage.getUser();
          
          const backupData = {
            token,
            user,
            backupTime: new Date().toISOString(),
            keys: "ALL_ENCRYPTION_KEYS_GATHERED_LOGIC" 
          };

          const jsonData = JSON.stringify(backupData);
          const { encryptedContent, iv } = await encryptMessage(jsonData, password);
          
          const finalPayload = JSON.stringify({
            version: '2.0',
            encryptedContent,
            iv,
            type: 'cloud_sync_ready'
          });

          const choice = await new Promise(resolve => {
            Alert.alert(
              '백업 방식 선택',
              '클라우드에 연동하시겠습니까, 아니면 파일로 저장하시겠습니까?',
              [
                { text: '클라우드 연동', onPress: () => resolve('cloud') },
                { text: '파일로 저장', onPress: () => resolve('file') }
              ]
            );
          });

          if (choice === 'cloud') {
            console.log('☁️ Syncing to cloud storage...', finalPayload);
            Alert.alert('완료', '암호화된 백업 데이터가 클라우드(시뮬레이션)에 안전하게 저장되었습니다.');
          } else {
            const fileUri = FileSystem.cacheDirectory + 'secure_messenger_backup.json';
            await FileSystem.writeAsStringAsync(fileUri, finalPayload);
            await Sharing.shareAsync(fileUri);
          }
        } catch (error) {
          Alert.alert('오류', '백업 중 오류가 발생했습니다.');
        }
      }
    );
  };

  const handleRestore = async () => {
    Alert.alert('복구', '백업 파일을 선택하거나 클라우드에서 데이터를 가져오시겠습니까?', [
      { text: '클라우드에서 가져오기', onPress: () => Alert.alert('정보', '클라우드에서 최신 암호화 데이터를 탐색 중...') },
      { text: '파일 선택', onPress: () => Alert.alert('정보', '시스템 파일 탐색기를 엽니다...') }
    ]);
  };

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            // Disconnect socket
            socketService.disconnect();
            
            // Clear storage
            await storage.clear();
            
            // Navigate to login
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        }
      ]
    );
  };

  if (!user) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: user.avatar }} style={styles.avatar} />
        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>보안</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>End-to-End 암호화</Text>
              <Text style={styles.menuItemSubtitle}>활성화됨</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => {
            Alert.alert(
              '키 관리',
              '수행할 작업을 선택하세요.',
              [
                { text: '백업 생성', onPress: handleBackup },
                { text: '복구 실행', onPress: handleRestore },
                { text: '취소', style: 'cancel' }
              ]
            );
          }}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="key" size={24} color="#007AFF" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>암호화 키 관리</Text>
              <Text style={styles.menuItemSubtitle}>키 백업 및 복구</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>알림</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications" size={24} color="#FF9800" />
            <Text style={styles.menuItemTitle}>푸시 알림</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>개인정보</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="lock-closed" size={24} color="#666" />
            <Text style={styles.menuItemTitle}>개인정보 처리방침</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="document-text" size={24} color="#666" />
            <Text style={styles.menuItemTitle}>이용약관</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>정보</Text>
        
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="information-circle" size={24} color="#666" />
            <View style={styles.menuItemText}>
              <Text style={styles.menuItemTitle}>앱 버전</Text>
              <Text style={styles.menuItemSubtitle}>1.0.0</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="help-circle" size={24} color="#666" />
            <Text style={styles.menuItemTitle}>도움말</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#fff" />
        <Text style={styles.logoutButtonText}>로그아웃</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>© 2024 Secure Messenger</Text>
        <Text style={styles.footerSubtext}>Made with 🔒 by 김우혁</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: 0,
    bottom: 15,
    backgroundColor: '#007AFF',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemText: {
    marginLeft: 15,
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FF3B30',
    marginHorizontal: 15,
    marginVertical: 20,
    paddingVertical: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
});
