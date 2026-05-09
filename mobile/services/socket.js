import io from 'socket.io-client';
import { storage } from './api';

const SOCKET_URL = 'http://localhost:5000'; // Change to your server URL

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  // Connect to socket
  async connect() {
    try {
      const token = await storage.getToken();
      if (!token) {
        throw new Error('No auth token found');
      }

      this.socket = io(SOCKET_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected');
        this.socket.emit('authenticate', token);
      });

      this.socket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
      });

      this.socket.on('authentication-error', (data) => {
        console.error('❌ Authentication error:', data);
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
      });

    } catch (error) {
      console.error('❌ Socket connection error:', error);
      throw error;
    }
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  // Join conversation room
  joinConversation(conversationId) {
    if (this.socket) {
      this.socket.emit('join-conversation', conversationId);
    }
  }

  // Send message
  sendMessage(data) {
    if (this.socket) {
      this.socket.emit('send-message', data);
    }
  }

  // Typing indicator
  typing(conversationId) {
    if (this.socket) {
      this.socket.emit('typing', { conversationId });
    }
  }

  stopTyping(conversationId) {
    if (this.socket) {
      this.socket.emit('stop-typing', { conversationId });
    }
  }

  // Mark message as read
  markRead(messageId, conversationId) {
    if (this.socket) {
      this.socket.emit('mark-read', { messageId, conversationId });
    }
  }

  // Listen for new messages
  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new-message', callback);
      this.listeners.set('new-message', callback);
    }
  }

  // Listen for typing
  onUserTyping(callback) {
    if (this.socket) {
      this.socket.on('user-typing', callback);
      this.listeners.set('user-typing', callback);
    }
  }

  onUserStopTyping(callback) {
    if (this.socket) {
      this.socket.on('user-stop-typing', callback);
      this.listeners.set('user-stop-typing', callback);
    }
  }

  // Listen for message read
  onMessageRead(callback) {
    if (this.socket) {
      this.socket.on('message-read', callback);
      this.listeners.set('message-read', callback);
    }
  }

  // Listen for message deleted
  onMessageDeleted(callback) {
    if (this.socket) {
      this.socket.on('message-deleted', callback);
      this.listeners.set('message-deleted', callback);
    }
  }

  // Listen for user status changes
  onUserStatusChanged(callback) {
    if (this.socket) {
      this.socket.on('user-status-changed', callback);
      this.listeners.set('user-status-changed', callback);
    }
  }

  // Listen for message expiry started
  onMessageExpiryStarted(callback) {
    if (this.socket) {
      this.socket.on('message-expiry-started', callback);
      this.listeners.set('message-expiry-started', callback);
    }
  }

  // Group Management
  addMember(conversationId, userId) {
    if (this.socket) {
      this.socket.emit('group-add-member', { conversationId, userId });
    }
  }

  removeMember(conversationId, userId) {
    if (this.socket) {
      this.socket.emit('group-remove-member', { conversationId, userId });
    }
  }

  promoteAdmin(conversationId, userId) {
    if (this.socket) {
      this.socket.emit('group-promote-admin', { conversationId, userId });
    }
  }

  onMemberAdded(callback) {
    if (this.socket) {
      this.socket.on('member-added', callback);
      this.listeners.set('member-added', callback);
    }
  }

  onMemberRemoved(callback) {
    if (this.socket) {
      this.socket.on('member-removed', callback);
      this.listeners.set('member-removed', callback);
    }
  }

  onAdminPromoted(callback) {
    if (this.socket) {
      this.socket.on('admin-promoted', callback);
      this.listeners.set('admin-promoted', callback);
    }
  }

  // Remove listener
  off(event) {
    if (this.socket) {
      this.socket.off(event);
      this.listeners.delete(event);
    }
  }

  // Remove all listeners
  offAll() {
    if (this.socket) {
      this.listeners.forEach((callback, event) => {
        this.socket.off(event, callback);
      });
      this.listeners.clear();
    }
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
