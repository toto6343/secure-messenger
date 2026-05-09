const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Upload Directory Setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-messenger', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB Connected');
}).catch(err => {
  console.error('❌ MongoDB Connection Error:', err);
});

// MongoDB Schemas
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  publicKey: { type: String, required: true },
  avatar: { type: String, default: '' },
  status: { type: String, default: 'offline' },
  lastSeen: { type: Date, default: Date.now },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['direct', 'group'], default: 'direct' },
  name: { type: String },
  avatar: { type: String },
  createdAt: { type: Date, default: Date.now },
  lastMessage: {
    content: String,
    senderId: mongoose.Schema.Types.ObjectId,
    timestamp: Date
  }
});

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  encryptedContent: { type: String, required: true },
  iv: { type: String, required: true },
  messageType: { type: String, enum: ['text', 'image', 'file', 'voice'], default: 'text' },
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  timestamp: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deleted: { type: Boolean, default: false },
  reported: { type: Boolean, default: false },
  expirySeconds: { type: Number, default: 0 }, // 0 means no auto-delete
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } } // MongoDB TTL Index
});

const ReportSchema = new mongoose.Schema({
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);
const Report = mongoose.model('Report', ReportSchema);

// JWT Secret - Enforce environment variable for security
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-super-secret-key') {
  console.error('❌ FATAL ERROR: JWT_SECRET is not defined or using default value in .env');
  console.error('Please set a strong JWT_SECRET in your .env file.');
  process.exit(1);
}

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Socket.io Connection Management
const activeUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // User Authentication
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      activeUsers.set(decoded.userId, socket.id);
      
      // Update user status
      await User.findByIdAndUpdate(decoded.userId, { 
        status: 'online',
        lastSeen: new Date()
      });

      // Notify friends
      socket.broadcast.emit('user-status-changed', {
        userId: decoded.userId,
        status: 'online'
      });

      console.log(`✅ User authenticated: ${decoded.userId}`);
    } catch (error) {
      console.error('❌ Authentication error:', error);
      socket.emit('authentication-error', { error: 'Invalid token' });
    }
  });

  // Join Conversation Room
  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  });

  // Send Message
  socket.on('send-message', async (data) => {
    try {
      const { conversationId, encryptedContent, iv, messageType, fileUrl, fileName, fileSize, expirySeconds } = data;

      const message = new Message({
        conversationId,
        senderId: socket.userId,
        encryptedContent,
        iv,
        messageType,
        fileUrl,
        fileName,
        fileSize,
        readBy: [socket.userId],
        expirySeconds: expirySeconds || 0
      });

      await message.save();

      // Update conversation last message
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: {
          content: messageType === 'text' ? encryptedContent.substring(0, 50) : `[${messageType}]`,
          senderId: socket.userId,
          timestamp: new Date()
        }
      });

      // Send to all participants
      io.to(conversationId).emit('new-message', {
        _id: message._id,
        conversationId,
        senderId: socket.userId,
        encryptedContent,
        iv,
        messageType,
        fileUrl,
        fileName,
        fileSize,
        timestamp: message.timestamp,
        expirySeconds: message.expirySeconds
      });

    } catch (error) {
      console.error('❌ Send message error:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // Typing Indicator
  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user-typing', {
      userId: socket.userId,
      conversationId: data.conversationId
    });
  });

  socket.on('stop-typing', (data) => {
    socket.to(data.conversationId).emit('user-stop-typing', {
      userId: socket.userId,
      conversationId: data.conversationId
    });
  });

  // Message Read Receipt
  socket.on('mark-read', async (data) => {
    try {
      const message = await Message.findById(data.messageId);
      if (!message) return;

      const isFirstRead = !message.readBy.includes(socket.userId);
      
      if (isFirstRead) {
        message.readBy.push(socket.userId);
        
        // Handle Auto-delete timer
        // Start timer when ANY participant (other than sender) reads it
        if (message.expirySeconds > 0 && !message.expiresAt && socket.userId !== message.senderId.toString()) {
          const expiryDate = new Date();
          expiryDate.setSeconds(expiryDate.getSeconds() + message.expirySeconds);
          message.expiresAt = expiryDate;
          
          io.to(data.conversationId).emit('message-expiry-started', {
            messageId: data.messageId,
            expiresAt: message.expiresAt
          });
        }
        
        await message.save();
      }

      io.to(data.conversationId).emit('message-read', {
        messageId: data.messageId,
        userId: socket.userId
      });
    } catch (error) {
      console.error('❌ Mark read error:', error);
    }
  });

  // WebRTC Signaling for Voice/Video Calls
  socket.on('call-user', (data) => {
    socket.to(data.conversationId).emit('incoming-call', {
      callerId: socket.userId,
      signal: data.signalData,
      conversationId: data.conversationId,
      isVideo: data.isVideo
    });
  });

  socket.on('answer-call', (data) => {
    socket.to(data.conversationId).emit('call-answered', {
      signal: data.signalData,
      conversationId: data.conversationId
    });
  });

  socket.on('webrtc-ice-candidate', (data) => {
    socket.to(data.conversationId).emit('webrtc-ice-candidate', {
      candidate: data.candidate,
      conversationId: data.conversationId
    });
  });

  socket.on('end-call', (data) => {
    socket.to(data.conversationId).emit('call-ended', {
      conversationId: data.conversationId
    });
  });

  // Group Management Socket Events
  socket.on('group-add-member', async (data) => {
    try {
      const { conversationId, userId } = data;
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation.admins.includes(socket.userId)) {
        return socket.emit('error', { message: 'Only admins can add members' });
      }

      if (!conversation.participants.includes(userId)) {
        conversation.participants.push(userId);
        await conversation.save();
        io.to(conversationId).emit('member-added', { conversationId, userId });
      }
    } catch (error) {
      console.error('❌ Add member error:', error);
    }
  });

  socket.on('group-remove-member', async (data) => {
    try {
      const { conversationId, userId } = data;
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation.admins.includes(socket.userId)) {
        return socket.emit('error', { message: 'Only admins can remove members' });
      }
      
      if (userId === conversation.creator.toString()) {
        return socket.emit('error', { message: 'Cannot remove group creator' });
      }

      conversation.participants = conversation.participants.filter(p => p.toString() !== userId);
      conversation.admins = conversation.admins.filter(a => a.toString() !== userId);
      await conversation.save();
      
      io.to(conversationId).emit('member-removed', { conversationId, userId });
    } catch (error) {
      console.error('❌ Remove member error:', error);
    }
  });

  socket.on('group-promote-admin', async (data) => {
    try {
      const { conversationId, userId } = data;
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation.admins.includes(socket.userId)) {
        return socket.emit('error', { message: 'Only admins can promote others' });
      }

      if (!conversation.admins.includes(userId)) {
        conversation.admins.push(userId);
        await conversation.save();
        io.to(conversationId).emit('admin-promoted', { conversationId, userId });
      }
    } catch (error) {
      console.error('❌ Promote admin error:', error);
    }
  });

  // Disconnect
  socket.on('disconnect', async () => {
    console.log('🔌 Client disconnected:', socket.id);
    
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      
      await User.findByIdAndUpdate(socket.userId, { 
        status: 'offline',
        lastSeen: new Date()
      });

      socket.broadcast.emit('user-status-changed', {
        userId: socket.userId,
        status: 'offline'
      });
    }
  });
});

// REST API Routes

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, publicKey } = req.body;
    const normalizedEmail = email?.toLowerCase();

    // Validate input
    if (!username || !normalizedEmail || !password || !publicKey) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email: normalizedEmail }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email: normalizedEmail,
      password: hashedPassword,
      publicKey,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
    });

    await user.save();

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        publicKey: user.publicKey
      }
    });

  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.toLowerCase();

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        publicKey: user.publicKey
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ error: 'User with this email does not exist' });
    }

    // Generate numeric token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    console.log(`[AUTH] Reset token for ${normalizedEmail}: ${token}`);
    
    res.json({ 
      message: 'Password reset token generated',
      token: token 
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process forgot password' });
  }
});

// Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    const normalizedEmail = email?.toLowerCase()?.trim();
    const trimmedToken = token?.trim();

    if (!normalizedEmail || !trimmedToken || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    console.log(`[AUTH] Attempting reset for ${normalizedEmail} with token: ${trimmedToken}`);

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.log(`[AUTH] Reset failed: User ${normalizedEmail} not found`);
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.resetPasswordToken !== trimmedToken) {
      console.log(`[AUTH] Reset failed: Token mismatch. Expected ${user.resetPasswordToken}, got ${trimmedToken}`);
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (user.resetPasswordExpires < Date.now()) {
      console.log(`[AUTH] Reset failed: Token expired at ${user.resetPasswordExpires}`);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();
    console.log(`[AUTH] Password successfully reset for ${normalizedEmail}`);

    res.json({ success: true, message: 'Password has been reset' });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get User Profile
app.get('/api/users/:userId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update User Profile
app.patch('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const update = {};
    if (username) update.username = username;
    if (avatar) update.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: update },
      { new: true }
    ).select('-password');

    res.json(user);
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Search Users
app.get('/api/users/search/:query', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({
      $or: [
        { username: new RegExp(req.params.query, 'i') },
        { email: new RegExp(req.params.query, 'i') }
      ],
      _id: { $ne: req.user.userId }
    }).select('-password').limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get Friends
app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('friends', 'username email avatar status lastSeen');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user.friends);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Add Friend
app.post('/api/friends/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    
    if (friendId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }

    const user = await User.findById(req.user.userId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ error: 'User to add not found' });
    }

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ error: 'Already friends' });
    }

    user.friends.push(friendId);
    await user.save();

    // Mutual friendship? (Optional: depending on requirements)
    // For this prototype, let's make it one-sided or mutual. 
    // Usually "adding" in messengers is mutual or requires request.
    // Let's make it simple: if I add you, you are in my friend list.
    
    res.json({ success: true, friend: { _id: friend._id, username: friend.username, avatar: friend.avatar } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

// Remove Friend
app.delete('/api/friends/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;
    
    const user = await User.findById(req.user.userId);
    user.friends = user.friends.filter(id => id.toString() !== friendId);
    await user.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// Create Conversation
app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { participantIds, type, name } = req.body;

    // Check if direct conversation already exists
    if (type === 'direct') {
      const existing = await Conversation.findOne({
        type: 'direct',
        participants: { $all: [req.user.userId, participantIds[0]], $size: 2 }
      });

      if (existing) {
        return res.json(existing);
      }
    }

    const conversation = new Conversation({
      participants: [req.user.userId, ...participantIds],
      admins: type === 'group' ? [req.user.userId] : [],
      creator: req.user.userId,
      type,
      name
    });

    await conversation.save();
    await conversation.populate('participants', '-password');

    res.status(201).json(conversation);
  } catch (error) {
    console.error('❌ Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get User Conversations
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user.userId
    })
    .populate('participants', '-password')
    .sort({ 'lastMessage.timestamp': -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get Conversation Messages
app.get('/api/conversations/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, before } = req.query;
    
    const query = {
      conversationId: req.params.conversationId,
      deleted: false
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('senderId', 'username avatar');

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Delete Message
app.delete('/api/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    message.deleted = true;
    await message.save();

    io.to(message.conversationId.toString()).emit('message-deleted', {
      messageId: message._id,
      conversationId: message.conversationId
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Report Message
app.post('/api/messages/:messageId/report', authenticateToken, async (req, res) => {
  // ... (existing code)
});

// Get Message Read Status
app.get('/api/messages/:messageId/read-status', authenticateToken, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId)
      .populate('readBy', 'username avatar status lastSeen');
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message.readBy);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch read status' });
  }
});

// Search Messages
app.get('/api/conversations/:conversationId/search/:query', authenticateToken, async (req, res) => {
  try {
    const { query } = req.params;
    const { conversationId } = req.params;

    // Verify user is part of the conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user.userId
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Since messages are encrypted, we can't search by content on the server.
    // However, for this demo/prototype, we'll return all messages for the conversation
    // and let the client decrypt and search locally.
    // In a real production app with massive data, you'd need a different approach 
    // like searchable symmetric encryption or client-side indexing.
    
    // For now, we'll just return the last 500 messages to search from.
    const messages = await Message.find({
      conversationId,
      deleted: false
    })
    .sort({ timestamp: -1 })
    .limit(500)
    .populate('senderId', 'username avatar');

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// File Upload Route
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Create URL for the uploaded file
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.json({
      success: true,
      fileUrl: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// 404 Handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   🚀 Secure Messenger Server         ║
  ║   📡 Port: ${PORT}                    ║
  ║   🔒 E2E Encryption Enabled          ║
  ║   ✅ Ready to accept connections     ║
  ╚═══════════════════════════════════════╝
  `);
});
