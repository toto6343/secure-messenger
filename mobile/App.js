import React, { useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { storage } from './services/api';
import socketService from './services/socket';

// Screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ConversationsScreen from './screens/ConversationsScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import NewChatScreen from './screens/NewChatScreen';
import GroupSettingsScreen from './screens/GroupSettingsScreen';
import FriendsScreen from './screens/FriendsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Main Tab Navigator
function MainTabs() {
  const scheme = useColorScheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          if (route.name === 'Conversations') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Friends') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: scheme === 'dark' ? '#0F172A' : '#0F172A',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Conversations" 
        component={ConversationsScreen}
        options={({ navigation }) => ({ 
          title: '채팅',
          headerRight: () => (
            <Ionicons 
              name="add-circle-outline" 
              size={28} 
              color="#fff" 
              style={{ marginRight: 15 }}
              onPress={() => navigation.navigate('NewChat')}
            />
          ),
        })}
      />
      <Tab.Screen 
        name="Friends" 
        component={FriendsScreen}
        options={({ navigation }) => ({ 
          title: '친구',
          headerRight: () => (
            <Ionicons 
              name="person-add-outline" 
              size={24} 
              color="#fff" 
              style={{ marginRight: 15 }}
              onPress={() => navigation.navigate('NewChat')}
            />
          ),
        })}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: '설정' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scheme = useColorScheme();

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const token = await storage.getToken();
      const user = await storage.getUser();
      
      if (token && user) {
        setIsLoggedIn(true);
        await socketService.connect();
      }
    } catch (error) {
      console.error('Check login status error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null; // Or loading screen
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'auto'} />
      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: scheme === 'dark' ? '#1c1c1e' : '#007AFF',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          {!isLoggedIn ? (
            <>
              <Stack.Screen 
                name="Login" 
                component={LoginScreen}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Register" 
                component={RegisterScreen}
                options={{ title: '회원가입' }}
              />
              <Stack.Screen 
                name="ForgotPassword" 
                component={ForgotPasswordScreen}
                options={{ title: '비밀번호 찾기' }}
              />
            </>
          ) : (
            <>
              <Stack.Screen 
                name="MainTabs" 
                component={MainTabs}
                options={{ headerShown: false }}
              />
              <Stack.Screen 
                name="Chat" 
                component={ChatScreen}
                options={({ route }) => ({ 
                  title: route.params?.conversationName || '채팅'
                })}
              />
              <Stack.Screen 
                name="NewChat" 
                component={NewChatScreen}
                options={{ title: '새 채팅' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
