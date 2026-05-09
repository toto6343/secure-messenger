import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://localhost:5000/api'; // Change to your server URL

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (username, email, password, publicKey) => {
    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      publicKey
    });
    return response.data;
  },

  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (email, token, newPassword) => {
    const response = await api.post('/auth/reset-password', { email, token, newPassword });
    return response.data;
  }
};

// User API
export const userAPI = {
  getProfile: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await api.patch('/users/profile', data);
    return response.data;
  },

  searchUsers: async (query) => {
    const response = await api.get(`/users/search/${query}`);
    return response.data;
  }
};

// Friends API
export const friendAPI = {
  getFriends: async () => {
    const response = await api.get('/friends');
    return response.data;
  },

  addFriend: async (friendId) => {
    const response = await api.post(`/friends/${friendId}`);
    return response.data;
  },

  removeFriend: async (friendId) => {
    const response = await api.delete(`/friends/${friendId}`);
    return response.data;
  }
};

// Conversation API
export const conversationAPI = {
  create: async (participantIds, type = 'direct', name = null) => {
    const response = await api.post('/conversations', {
      participantIds,
      type,
      name
    });
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/conversations');
    return response.data;
  },

  getMessages: async (conversationId, limit = 50, before = null) => {
    const params = { limit };
    if (before) params.before = before;
    
    const response = await api.get(`/conversations/${conversationId}/messages`, { params });
    return response.data;
  }
};

// Message API
export const messageAPI = {
  delete: async (messageId) => {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data;
  },

  report: async (messageId, reason, description) => {
    const response = await api.post(`/messages/${messageId}/report`, { reason, description });
    return response.data;
  },
  getReadStatus: async (messageId) => {
    const response = await api.get(`/messages/${messageId}/read-status`);
    return response.data;
  }
  };

// File API
export const fileAPI = {
  upload: async (fileUri, fileName, mimeType) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName || 'upload.bin',
      type: mimeType || 'application/octet-stream'
    });

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }
};

// Storage functions
export const storage = {
  setToken: async (token) => {
    await AsyncStorage.setItem('authToken', token);
  },

  getToken: async () => {
    return await AsyncStorage.getItem('authToken');
  },

  setUser: async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
  },

  getUser: async () => {
    const userStr = await AsyncStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  clear: async () => {
    await AsyncStorage.multiRemove(['authToken', 'user']);
  }
};

export default api;
