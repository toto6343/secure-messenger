// API Service for desktop app

const API_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

class API {
    static socket = null;
    static token = null;

    // Set auth token
    static setToken(token) {
        this.token = token;
    }

    // Get auth headers
    static getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    // Helper for fetch with JSON handling
    static async request(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        });

        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = { error: await response.text() };
        }

        if (!response.ok) {
            throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
        }

        return data;
    }

    // Auth API
    static async register(username, email, password, publicKey) {
        return this.request(`${API_URL}/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ username, email, password, publicKey })
        });
    }

    static async login(email, password) {
        return this.request(`${API_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    }

    static async forgotPassword(email) {
        return this.request(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    static async resetPassword(email, token, newPassword) {
        return this.request(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ email, token, newPassword })
        });
    }

    // User API
    static async getProfile(userId) {
        return this.request(`${API_URL}/users/${userId}`);
    }

    static async updateProfile(data) {
        return this.request(`${API_URL}/users/profile`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    static async searchUsers(query) {
        return this.request(`${API_URL}/users/search/${query}`);
    }

    // Friends API
    static async getFriends() {
        return this.request(`${API_URL}/friends`);
    }

    static async addFriend(friendId) {
        return this.request(`${API_URL}/friends/${friendId}`, {
            method: 'POST'
        });
    }

    static async removeFriend(friendId) {
        return this.request(`${API_URL}/friends/${friendId}`, {
            method: 'DELETE'
        });
    }

    // Conversation API
    static async createConversation(participantIds, type = 'direct', name = null) {
        return this.request(`${API_URL}/conversations`, {
            method: 'POST',
            body: JSON.stringify({ participantIds, type, name })
        });
    }

    static async getConversations() {
        return this.request(`${API_URL}/conversations`);
    }

    static async getMessages(conversationId, limit = 50, before = null) {
        let url = `${API_URL}/conversations/${conversationId}/messages?limit=${limit}`;
        if (before) {
            url += `&before=${before}`;
        }
        return this.request(url);
    }

    static async searchMessages(conversationId, query) {
        return this.request(`${API_URL}/conversations/${conversationId}/search/${query}`);
    }

    // Message API
    static async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const headers = { ...this.getHeaders() };
        delete headers['Content-Type'];

        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }
        return data;
    }

    static async deleteMessage(messageId) {
        return this.request(`${API_URL}/messages/${messageId}`, {
            method: 'DELETE'
        });
    }

    static async reportMessage(messageId, reason, description) {
        return this.request(`${API_URL}/messages/${messageId}/report`, {
            method: 'POST',
            body: JSON.stringify({ reason, description })
        });
    }

    static async getMessageReadStatus(messageId) {
        return this.request(`${API_URL}/messages/${messageId}/read-status`);
    }

    // Socket.io connection
    static connectSocket(token) {
        return new Promise((resolve, reject) => {
            try {
                this.socket = io(SOCKET_URL, {
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionDelay: 1000,
                    reconnectionAttempts: 5
                });

                this.socket.on('connect', () => {
                    console.log('✅ Socket connected');
                    this.socket.emit('authenticate', token);
                    resolve(this.socket);
                });

                this.socket.on('disconnect', () => {
                    console.log('🔌 Socket disconnected');
                });

                this.socket.on('connect_error', (error) => {
                    console.error('❌ Connection error:', error);
                    reject(error);
                });

                this.socket.on('authentication-error', (data) => {
                    console.error('❌ Authentication error:', data);
                    reject(new Error('Authentication failed'));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}
