import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../services/api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1); // 1: Request Token, 2: Reset Password
  const [loading, setLoading] = useState(false);

  const handleRequestToken = async () => {
    if (!email) {
      Alert.alert('오류', '이메일을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.forgotPassword(email);
      // In a real app, we wouldn't get the token here, 
      // but for this prototype we show it for convenience.
      if (response.token) {
        Alert.alert('인증 코드', `테스트용 인증 코드가 발급되었습니다: ${response.token}`);
      } else {
        Alert.alert('이메일 확인', '비밀번호 재설정 이메일이 전송되었습니다.');
      }
      setStep(2);
    } catch (error) {
      Alert.alert('오류', error.response?.data?.error || '비밀번호 재설정 요청에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!token || !newPassword) {
      Alert.alert('오류', '인증 코드와 새 비밀번호를 입력해주세요.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('오류', '비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(email, token, newPassword);
      Alert.alert('완료', '비밀번호가 성공적으로 변경되었습니다.', [
        { text: '확인', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (error) {
      Alert.alert('오류', error.response?.data?.error || '비밀번호 재설정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>비밀번호 찾기</Text>
          <Text style={styles.subtitle}>
            {step === 1 
              ? '가입하신 이메일 주소를 입력하시면 인증 코드를 보내드립니다.' 
              : '이메일로 전송된 6자리 인증 코드와 새 비밀번호를 입력해주세요.'}
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, step === 2 && styles.inputDisabled]}
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={step === 1}
            />
          </View>

          {step === 2 && (
            <>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="인증 코드"
                  value={token}
                  onChangeText={setToken}
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="새 비밀번호"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={step === 1 ? handleRequestToken : handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {step === 1 ? '인증 코드 받기' : '비밀번호 변경'}
              </Text>
            )}
          </TouchableOpacity>

          {step === 2 && (
            <TouchableOpacity
              style={styles.retryLink}
              onPress={() => setStep(1)}
              disabled={loading}
            >
              <Text style={styles.retryText}>이메일 다시 입력하기</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 30,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    height: 52,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputDisabled: {
    color: '#94A3B8',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  retryLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  retryText: {
    color: '#64748B',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
