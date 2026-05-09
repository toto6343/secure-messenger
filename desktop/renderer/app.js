// Main App Logic for Desktop

class App {
    constructor() {
        this.currentUser = null;
        this.conversations = [];
        this.currentConversation = null;
        this.messages = [];
        this.conversationKeys = new Map();

        // WebRTC State
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.activeCallData = null;
        this.callConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun1.l.google.com:19302' }
            ]
        };
        
        this.currentLang = 'ko';
        this.translations = {
            'ko': {
                'chat': '💬 채팅',
                'newChat': '새 채팅',
                'searchConversations': '대화 검색...',
                'logout': '로그아웃',
                'backup': '데이터 백업',
                'restore': '데이터 복구',
                'selectChat': '대화를 선택해주세요',
                'selectChatDesc': '왼쪽에서 대화를 선택하거나 새 채팅을 시작하세요',
                'searchMessage': '메시지 검색...',
                'typeMessage': '메시지를 입력하세요...',
                'noMessage': '메시지가 없습니다',
                'groupChat': '그룹 채팅'
            },
            'en': {
                'chat': '💬 Chats',
                'newChat': 'New Chat',
                'searchConversations': 'Search conversations...',
                'logout': 'Logout',
                'backup': 'Backup Data',
                'restore': 'Restore Data',
                'selectChat': 'Please select a chat',
                'selectChatDesc': 'Select a conversation from the left or start a new one',
                'searchMessage': 'Search messages...',
                'typeMessage': 'Type a message...',
                'noMessage': 'No messages',
                'groupChat': 'Group Chat',
                'incomingCall': 'Incoming call...',
                'voiceCall': 'Voice call',
                'videoCall': 'Video call'
            }
        };

        this.init();
    }

    async init() {
        // Load saved theme
        const savedTheme = await window.electron.store.get('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeBtnIcon(savedTheme);

        // Load saved language
        this.currentLang = await window.electron.store.get('language') || 'ko';
        this.applyLanguage();

        // Load saved token
        const token = await window.electron.store.get('authToken');
        const user = await window.electron.store.get('user');

        if (token && user) {
            this.currentUser = user;
            API.setToken(token);
            await this.showMainApp();
        } else {
            this.showLoginScreen();
        }

        this.setupEventListeners();
        this.setupMenuListeners();
    }

    updateThemeBtnIcon(theme) {
        const btn = document.getElementById('themeToggleBtn');
        if (btn) {
            btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    }

    async toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        this.updateThemeBtnIcon(newTheme);
        await window.electron.store.set('theme', newTheme);
    }

    async toggleLanguage() {
        this.currentLang = this.currentLang === 'ko' ? 'en' : 'ko';
        await window.electron.store.set('language', this.currentLang);
        this.applyLanguage();
    }

    applyLanguage() {
        const t = this.translations[this.currentLang];
        
        // Update language button icon
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) langBtn.textContent = this.currentLang === 'ko' ? '🇰🇷' : '🇺🇸';

        // Update elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        // Update titles/placeholders
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (t[key]) el.title = t[key];
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (t[key]) el.placeholder = t[key];
        });

        // Update specific dynamic texts if needed
        const noChatIcon = document.querySelector('#noChatSelected h3');
        if(noChatIcon) noChatIcon.textContent = t['selectChat'];
        
        const noChatDesc = document.querySelector('#noChatSelected p');
        if(noChatDesc) noChatDesc.textContent = t['selectChatDesc'];

        const searchConvInput = document.getElementById('searchConversations');
        if(searchConvInput) searchConvInput.placeholder = t['searchConversations'];

        const searchMsgInput = document.getElementById('messageSearchInput');
        if(searchMsgInput) searchMsgInput.placeholder = t['searchMessage'];

        const typeMsgInput = document.getElementById('messageInput');
        if(typeMsgInput) typeMsgInput.placeholder = t['typeMessage'];
    }

    setupEventListeners() {
        // Theme Toggle
        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Language Toggle
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.addEventListener('click', () => this.toggleLanguage());
        }

        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Register
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterScreen();
        });
        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginScreen();
        });
        document.getElementById('registerBtn').addEventListener('click', () => this.handleRegister());

        // Forgot Password
        document.getElementById('showForgotPassword').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPasswordModal();
        });
        document.getElementById('closeForgotPasswordModal').addEventListener('click', () => this.hideForgotPasswordModal());
        document.getElementById('requestTokenBtn').addEventListener('click', () => this.handleRequestToken());
        document.getElementById('resetPasswordBtn').addEventListener('click', () => this.handleResetPassword());
        document.getElementById('backToStep1').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('fpStep1').classList.remove('hidden');
            document.getElementById('fpStep2').classList.add('hidden');
        });

        // Sidebar Tabs
        const tabConversations = document.getElementById('tabConversations');
        const tabFriends = document.getElementById('tabFriends');
        const conversationsList = document.getElementById('conversationsList');
        const friendsList = document.getElementById('friendsList');

        if (tabConversations && tabFriends) {
            tabConversations.addEventListener('click', () => {
                tabConversations.classList.add('active');
                tabFriends.classList.remove('active');
                tabConversations.style.borderBottom = '2px solid var(--primary-color)';
                tabConversations.style.color = 'var(--text-primary)';
                tabFriends.style.borderBottom = '2px solid transparent';
                tabFriends.style.color = 'var(--text-secondary)';
                conversationsList.classList.remove('hidden');
                friendsList.classList.add('hidden');
            });

            tabFriends.addEventListener('click', () => {
                tabFriends.classList.add('active');
                tabConversations.classList.remove('active');
                tabFriends.style.borderBottom = '2px solid var(--primary-color)';
                tabFriends.style.color = 'var(--text-primary)';
                tabConversations.style.borderBottom = '2px solid transparent';
                tabConversations.style.color = 'var(--text-secondary)';
                friendsList.classList.remove('hidden');
                conversationsList.classList.add('hidden');
                this.loadFriends();
            });
        }

        // New Chat
        document.getElementById('newChatBtn').addEventListener('click', () => this.showNewChatModal());
        document.getElementById('closeNewChatModal').addEventListener('click', () => this.hideNewChatModal());
        document.getElementById('searchUsersBtn').addEventListener('click', () => this.searchUsers());

        // Message Search
        const toggleSearchBtn = document.getElementById('toggleSearchBtn');
        const messageSearchInput = document.getElementById('messageSearchInput');
        if (toggleSearchBtn && messageSearchInput) {
            toggleSearchBtn.addEventListener('click', () => {
                messageSearchInput.classList.toggle('hidden');
                if (!messageSearchInput.classList.contains('hidden')) {
                    messageSearchInput.focus();
                } else {
                    messageSearchInput.value = '';
                    this.searchMessages(''); // Clear search
                }
            });

            messageSearchInput.addEventListener('input', (e) => {
                this.searchMessages(e.target.value.toLowerCase());
            });
        }

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Voice/Video Call
        const voiceBtn = document.getElementById('voiceCallBtn');
        const videoBtn = document.getElementById('videoCallBtn');
        
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => {
                if (!this.currentConversation) return;
                this.startCall(false);
            });
        }
        
        if (videoBtn) {
            videoBtn.addEventListener('click', () => {
                if (!this.currentConversation) return;
                this.startCall(true);
            });
        }

        // Call Modal Buttons
        const acceptCallBtn = document.getElementById('acceptCallBtn');
        const rejectCallBtn = document.getElementById('rejectCallBtn');
        const endCallBtn = document.getElementById('endCallBtn');

        if (acceptCallBtn) acceptCallBtn.addEventListener('click', () => this.acceptCall());
        if (rejectCallBtn) rejectCallBtn.addEventListener('click', () => this.rejectCall());
        if (endCallBtn) endCallBtn.addEventListener('click', () => this.endCall());

        // Backup & Restore
        document.getElementById('backupBtn').addEventListener('click', () => this.handleBackup());
        document.getElementById('restoreBtn').addEventListener('click', () => {
            document.getElementById('restoreInput').click();
        });
        document.getElementById('restoreInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleRestore(e.target.files[0]);
                e.target.value = '';
            }
        });

        // Send Message
        document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // File Attachment
        document.getElementById('attachBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
            e.target.value = ''; // Reset
        });

        // Typing indicator
        let typingTimeout;
        document.getElementById('messageInput').addEventListener('input', () => {
            if (this.currentConversation) {
                API.socket.emit('typing', { conversationId: this.currentConversation._id });
                
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    API.socket.emit('stop-typing', { conversationId: this.currentConversation._id });
                }, 2000);
            }
        });

        // Profile Editing (Identity Focus)
        const userAvatar = document.getElementById('userAvatar');
        const userName = document.getElementById('userName');
        if (userAvatar && userName) {
            userAvatar.addEventListener('click', () => this.showProfileModal());
            userName.addEventListener('click', () => this.showProfileModal());
        }
        document.getElementById('closeProfileModal').addEventListener('click', () => this.hideProfileModal());
        document.getElementById('saveProfileBtn').addEventListener('click', () => this.handleUpdateProfile());

        // Avatar Image Container Click to change (Using File Upload instead of prompt)
        const avatarContainer = document.getElementById('avatarEditContainer');
        const profileFileInput = document.getElementById('profileFileInput');
        
        if (avatarContainer && profileFileInput) {
            avatarContainer.addEventListener('click', () => {
                profileFileInput.click(); // Trigger hidden file input
            });

            profileFileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                try {
                    // Show loading state if desired, for now direct upload
                    const uploadData = await API.uploadFile(file);
                    
                    // Update the preview and the URL input field
                    document.getElementById('editAvatarUrl').value = uploadData.fileUrl;
                    document.getElementById('editUserAvatar').src = uploadData.fileUrl;
                    
                    console.log('✅ Profile image uploaded:', uploadData.fileUrl);
                } catch (error) {
                    console.error('File upload error:', error);
                    alert('이미지 업로드에 실패했습니다.');
                }
            });
        }

        // System Settings (App Options Focus)
        document.getElementById('closeSettingsModal').addEventListener('click', () => this.hideSettingsModal());
        document.getElementById('modalThemeToggle').addEventListener('click', () => this.toggleTheme());
        document.getElementById('modalLangToggle').addEventListener('click', () => this.toggleLanguage());
        document.getElementById('modalBackupBtn').addEventListener('click', () => this.handleBackup());
        document.getElementById('modalRestoreBtn').addEventListener('click', () => document.getElementById('restoreInput').click());
        document.getElementById('modalLogoutBtn').addEventListener('click', () => this.handleLogout());
    }

    setupMenuListeners() {
        window.electron.menu.onNewChat(() => this.showNewChatModal());
        window.electron.menu.onSettings(() => this.showSettingsModal());
        window.electron.menu.onAbout(() => alert('Secure Messenger v1.0.0\nE2E Encrypted Messenger\nMade by 김우혁'));
    }

    showSettingsModal() {
        document.getElementById('settingsModal').classList.remove('hidden');
    }

    hideSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
    }

    showProfileModal() {
        document.getElementById('profileModal').classList.remove('hidden');
        document.getElementById('editUsername').value = this.currentUser.username;
        document.getElementById('editAvatarUrl').value = this.currentUser.avatar;
        document.getElementById('editUserAvatar').src = this.currentUser.avatar;
    }

    hideProfileModal() {
        document.getElementById('profileModal').classList.add('hidden');
    }

    async handleUpdateProfile() {
        const username = document.getElementById('editUsername').value.trim();
        const avatar = document.getElementById('editAvatarUrl').value.trim();

        if (!username) {
            alert('사용자 이름을 입력해주세요.');
            return;
        }

        try {
            const updatedUser = await API.updateProfile({ username, avatar });
            
            // Update local state
            this.currentUser = updatedUser;
            await window.electron.store.set('user', updatedUser);
            
            // Update UI
            document.getElementById('userName').textContent = updatedUser.username;
            document.getElementById('userAvatar').src = updatedUser.avatar;
            
            this.hideProfileModal();
            alert('프로필이 성공적으로 업데이트되었습니다.');
        } catch (error) {
            alert('프로필 업데이트 실패: ' + error.message);
        }
    }

    setupSocketListeners() {
        // New message
        API.socket.on('new-message', async (message) => {
            if (this.currentConversation && message.conversationId === this.currentConversation._id) {
                await this.addMessage(message);
            }
            await this.loadConversations();
        });

        // Typing indicators
        API.socket.on('user-typing', (data) => {
            if (this.currentConversation && data.conversationId === this.currentConversation._id) {
                document.getElementById('typingIndicator').classList.remove('hidden');
            }
        });

        API.socket.on('user-stop-typing', (data) => {
            if (this.currentConversation && data.conversationId === this.currentConversation._id) {
                document.getElementById('typingIndicator').classList.add('hidden');
            }
        });

        // Message deleted
        API.socket.on('message-deleted', (data) => {
            if (this.currentConversation && data.conversationId === this.currentConversation._id) {
                this.removeMessage(data.messageId);
            }
        });

        // User status changed
        API.socket.on('user-status-changed', () => {
            this.loadConversations();
        });

        // WebRTC Signaling
        API.socket.on('incoming-call', (data) => this.handleIncomingCall(data));
        
        API.socket.on('call-answered', async (data) => {
            if (this.peerConnection && data.signal && data.signal.type === 'answer') {
                try {
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
                } catch (err) {
                    console.error('Failed to set remote description on answer:', err);
                }
            }
        });

        API.socket.on('webrtc-ice-candidate', async (data) => {
            if (this.peerConnection && data.candidate) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (err) {
                    console.error('Failed to add ICE candidate:', err);
                }
            }
        });

        API.socket.on('call-ended', () => {
            this.closeWebRTC();
        });
    }

    // --- WebRTC Logic ---
    async startCall(isVideo) {
        this.activeCallData = { conversationId: this.currentConversation._id, isVideo, isInitiator: true };
        await this.setupWebRTC(isVideo, true);
    }

    async handleIncomingCall(data) {
        this.activeCallData = { conversationId: data.conversationId, isVideo: data.isVideo, isInitiator: false, signal: data.signal, callerId: data.callerId };
        
        // Show incoming call modal
        document.getElementById('incomingCallModal').classList.remove('hidden');
        document.getElementById('callTypeLabel').textContent = data.isVideo ? '영상 통화 요청 중...' : '음성 통화 요청 중...';
        
        // Try to get caller info
        try {
            const caller = await API.getUser(data.callerId);
            document.getElementById('callerName').textContent = caller.username || '사용자';
            if (caller.avatar) {
                document.getElementById('callerAvatar').src = caller.avatar;
            } else {
                document.getElementById('callerAvatar').src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="%23ccc"/><text x="40" y="50" font-size="30" text-anchor="middle" fill="white">?</text></svg>';
            }
        } catch (e) {
            document.getElementById('callerName').textContent = '사용자';
            document.getElementById('callerAvatar').src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="%23ccc"/><text x="40" y="50" font-size="30" text-anchor="middle" fill="white">?</text></svg>';
        }
    }

    async acceptCall() {
        document.getElementById('incomingCallModal').classList.add('hidden');
        if (!this.activeCallData) return;
        await this.setupWebRTC(this.activeCallData.isVideo, false);
    }

    rejectCall() {
        document.getElementById('incomingCallModal').classList.add('hidden');
        if (this.activeCallData) {
            API.socket.emit('end-call', { conversationId: this.activeCallData.conversationId });
            this.activeCallData = null;
        }
    }

    async setupWebRTC(isVideo, isInitiator) {
        try {
            // Get local media
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            
            // Show active call modal
            const activeCallModal = document.getElementById('activeCallModal');
            activeCallModal.classList.remove('hidden');
            document.getElementById('activeCallName').textContent = isVideo ? '영상 통화 중' : '음성 통화 중';
            
            const localVideo = document.getElementById('localVideo');
            localVideo.srcObject = this.localStream;
            
            const audioPlaceholder = document.getElementById('audioOnlyPlaceholder');
            const remoteVideo = document.getElementById('remoteVideo');
            if (isVideo) {
                audioPlaceholder.style.display = 'none';
                remoteVideo.style.display = 'block';
                localVideo.style.display = 'block';
            } else {
                audioPlaceholder.style.display = 'block';
                remoteVideo.style.display = 'none';
                localVideo.style.display = 'none'; // hide local video in audio call
            }

            // Create peer connection
            this.peerConnection = new RTCPeerConnection(this.callConfig);

            // Add local stream tracks
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                const [remoteStream] = event.streams;
                this.remoteStream = remoteStream;
                document.getElementById('remoteVideo').srcObject = remoteStream;
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    API.socket.emit('webrtc-ice-candidate', {
                        candidate: event.candidate,
                        conversationId: this.activeCallData.conversationId
                    });
                }
            };

            if (isInitiator) {
                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);
                API.socket.emit('call-user', {
                    conversationId: this.activeCallData.conversationId,
                    isVideo: isVideo,
                    signalData: offer
                });
            } else {
                if (this.activeCallData.signal && this.activeCallData.signal.type === 'offer') {
                    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.activeCallData.signal));
                    const answer = await this.peerConnection.createAnswer();
                    await this.peerConnection.setLocalDescription(answer);
                    API.socket.emit('answer-call', {
                        conversationId: this.activeCallData.conversationId,
                        signalData: answer
                    });
                }
            }
        } catch (error) {
            console.error('Error starting WebRTC:', error);
            alert('미디어 접근 권한이 없거나 오류가 발생했습니다: ' + error.message);
            this.closeWebRTC();
        }
    }

    endCall() {
        if (this.activeCallData) {
            API.socket.emit('end-call', { conversationId: this.activeCallData.conversationId });
        }
        this.closeWebRTC();
    }

    closeWebRTC() {
        document.getElementById('activeCallModal').classList.add('hidden');
        document.getElementById('incomingCallModal').classList.add('hidden');
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => track.stop());
            this.remoteStream = null;
        }

        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
        
        this.activeCallData = null;
    }
    // --- End WebRTC Logic ---

    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('registerScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    hideRegisterScreen() {
        document.getElementById('registerScreen').classList.add('hidden');
    }

    showForgotPasswordModal() {
        document.getElementById('forgotPasswordModal').classList.remove('hidden');
        document.getElementById('fpStep1').classList.remove('hidden');
        document.getElementById('fpStep2').classList.add('hidden');
        document.getElementById('fpEmail').value = '';
        document.getElementById('fpToken').value = '';
        document.getElementById('fpNewPassword').value = '';
    }

    hideForgotPasswordModal() {
        document.getElementById('forgotPasswordModal').classList.add('hidden');
    }

    async handleRequestToken() {
        const email = document.getElementById('fpEmail').value.trim();
        if (!email) {
            alert('이메일을 입력해주세요.');
            return;
        }

        try {
            const response = await API.forgotPassword(email);
            if (response.token) {
                alert(`테스트용 인증 코드가 발급되었습니다: ${response.token}`);
            } else {
                alert('비밀번호 재설정 인증 코드가 이메일로 전송되었습니다.');
            }
            document.getElementById('fpStep1').classList.add('hidden');
            document.getElementById('fpStep2').classList.remove('hidden');
        } catch (error) {
            alert('요청 실패: ' + error.message);
        }
    }

    async handleResetPassword() {
        const email = document.getElementById('fpEmail').value.trim();
        const token = document.getElementById('fpToken').value.trim();
        const newPassword = document.getElementById('fpNewPassword').value.trim();

        if (!token || !newPassword) {
            alert('인증 코드와 새 비밀번호를 입력해주세요.');
            return;
        }

        if (newPassword.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        try {
            await API.resetPassword(email, token, newPassword);
            alert('비밀번호가 성공적으로 변경되었습니다. 새로운 비밀번호로 로그인해주세요.');
            this.hideForgotPasswordModal();
        } catch (error) {
            alert('비밀번호 변경 실패: ' + error.message);
        }
    }

    async showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('registerScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');

        // Load user info
        document.getElementById('userName').textContent = this.currentUser.username;
        document.getElementById('userAvatar').src = this.currentUser.avatar;

        // Connect socket
        try {
            await API.connectSocket(await window.electron.store.get('authToken'));
            this.setupSocketListeners();
        } catch (error) {
            console.error('Socket connection error:', error);
        }

        // Load conversations
        await this.loadConversations();
    }

    async handleLogin() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            alert('이메일과 비밀번호를 입력해주세요.');
            return;
        }

        try {
            const response = await API.login(email, password);
            
            // Save token and user
            await window.electron.store.set('authToken', response.token);
            await window.electron.store.set('user', response.user);
            
            this.currentUser = response.user;
            API.setToken(response.token);
            
            await this.showMainApp();
        } catch (error) {
            alert('로그인 실패: ' + error.message);
        }
    }

    async handleRegister() {
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;

        // Validation
        if (!username || !email || !password || !confirmPassword) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        if (password !== confirmPassword) {
            alert('비밀번호가 일치하지 않습니다.');
            return;
        }

        if (password.length < 6) {
            alert('비밀번호는 최소 6자 이상이어야 합니다.');
            return;
        }

        try {
            // Generate key pair
            const { publicKey, privateKey } = await CryptoUtils.generateKeyPair();
            
            // Store private key
            await window.electron.store.set('privateKey', privateKey);

            // Register
            const response = await API.register(username, email, password, publicKey);
            
            // Save token and user
            await window.electron.store.set('authToken', response.token);
            await window.electron.store.set('user', response.user);
            
            this.currentUser = response.user;
            API.setToken(response.token);
            
            await this.showMainApp();
        } catch (error) {
            alert('회원가입 실패: ' + error.message);
        }
    }

    async handleLogout() {
        const confirmed = confirm('정말 로그아웃 하시겠습니까?');
        if (!confirmed) return;

        API.disconnectSocket();
        await window.electron.store.clear();
        
        this.currentUser = null;
        this.conversations = [];
        this.currentConversation = null;
        this.messages = [];
        
        this.showLoginScreen();
    }

    async handleBackup() {
        const password = prompt('백업 파일 암호화에 사용할 비밀번호를 입력하세요 (비밀번호를 분실하면 복구할 수 없습니다):');
        if (!password) return;

        try {
            const dataToBackup = {
                authToken: await window.electron.store.get('authToken'),
                user: await window.electron.store.get('user'),
                privateKey: await window.electron.store.get('privateKey'),
                theme: await window.electron.store.get('theme'),
                backupTime: new Date().toISOString()
            };

            // Get conversation keys
            for (const [convId, key] of this.conversationKeys.entries()) {
                dataToBackup[`conv_${convId}`] = key;
            }

            // Encrypt the backup data
            const jsonData = JSON.stringify(dataToBackup);
            const { encryptedContent, iv } = await CryptoUtils.encryptMessage(jsonData, password);
            
            const encryptedBackup = JSON.stringify({
                version: '2.0',
                encryptedContent,
                iv,
                isCloud: true
            });

            // Option: Local Download or Cloud Sync (Simulated)
            const choice = confirm('백업 데이터를 클라우드(시뮬레이션)에 연동하시겠습니까?\n[취소] 클릭 시 로컬 파일로 다운로드됩니다.');
            
            if (choice) {
                // Simulation of Cloud Upload (e.g., to S3 or Google Drive)
                console.log('☁️ Uploading encrypted backup to Cloud Storage...');
                
                setTimeout(() => {
                    alert('✅ 클라우드 암호화 백업 연동이 완료되었습니다.\n(참고: 현재는 시뮬레이션 모드로 콘솔에 데이터가 기록되었습니다.)');
                    console.log('Encrypted Cloud Backup Payload:', encryptedBackup);
                }, 1500);
            } else {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(encryptedBackup);
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href",     dataStr);
                downloadAnchorNode.setAttribute("download", `secure_backup_${new Date().getTime()}.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
                alert('데이터 암호화 백업 파일 다운로드가 완료되었습니다.');
            }
        } catch (error) {
            console.error('Backup error:', error);
            alert('백업 중 오류가 발생했습니다: ' + error.message);
        }
    }

    handleRestore(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                
                if (backupData.version !== '2.0') {
                    throw new Error('지원되지 않는 백업 버전입니다. 최신 버전의 백업 파일을 사용해주세요.');
                }

                const password = prompt('백업 비밀번호를 입력하세요:');
                if (!password) return;

                const decryptedJson = await CryptoUtils.decryptMessage(
                    backupData.encryptedContent, 
                    backupData.iv, 
                    password
                );
                
                if (decryptedJson.startsWith('[암호화')) throw new Error('비밀번호가 틀렸거나 데이터가 손상되었습니다.');
                
                const data = JSON.parse(decryptedJson);

                for (const key in data) {
                    await window.electron.store.set(key, data[key]);
                }
                
                alert('데이터 복구가 완료되었습니다. 앱을 재시작합니다.');
                window.location.reload();
            } catch (error) {
                console.error('Restore error:', error);
                alert('복구 중 오류가 발생했습니다: ' + error.message);
            }
        };
        reader.readAsText(file);
    }

    async showReadStatus(messageId) {
        try {
            const readByList = await API.getMessageReadStatus(messageId);
            
            let statusHtml = '<div style="max-height: 300px; overflow-y: auto; text-align: left;">';
            if (readByList.length === 0) {
                statusHtml += '<p style="padding: 20px; text-align: center; color: var(--text-secondary);">아직 아무도 읽지 않았습니다.</p>';
            } else {
                readByList.forEach(user => {
                    statusHtml += `
                        <div style="display: flex; align-items: center; padding: 10px; border-bottom: 1px solid var(--border-color);">
                            <img src="${user.avatar || 'data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'><circle cx=\'20\' cy=\'20\' r=\'20\' fill=\'%23ccc\'/></svg>'}" 
                                 style="width: 32px; height: 32px; border-radius: 50%; margin-right: 10px;">
                            <div>
                                <div style="font-weight: bold; color: var(--text-primary);">${user.username}</div>
                                <div style="font-size: 12px; color: ${user.status === 'online' ? '#4cd964' : '#8e8e93'}">
                                    ${user.status === 'online' ? '현재 접속 중' : '최근 접속: ' + this.formatTime(user.lastSeen)}
                                </div>
                            </div>
                        </div>
                    `;
                });
            }
            statusHtml += '</div>';

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.style.zIndex = '1000';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 350px;">
                    <div class="modal-header">
                        <h3>메시지 읽음 정보</h3>
                        <button class="close-modal" id="closeReadStatusModal">×</button>
                    </div>
                    <div class="modal-body">${statusHtml}</div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('closeReadStatusModal').onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        } catch (error) {
            console.error('Read status error:', error);
            alert('읽음 정보를 가져올 수 없습니다.');
        }
    }

    async loadConversations() {
        try {
            this.conversations = await API.getConversations();
            this.renderConversations();
        } catch (error) {
            console.error('Load conversations error:', error);
        }
    }

    async loadFriends() {
        try {
            const friends = await API.getFriends();
            this.renderFriends(friends);
        } catch (error) {
            console.error('Load friends error:', error);
        }
    }

    renderFriends(friends) {
        const container = document.getElementById('friendsList');
        container.innerHTML = '';

        if (friends.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-secondary);">친구 목록이 비어 있습니다.</div>';
            return;
        }

        friends.forEach(friend => {
            const isOnline = friend.status === 'online';
            const element = document.createElement('div');
            element.className = 'conversation-item'; // Reuse styling

            element.innerHTML = `
                <img src="${friend.avatar}" class="conversation-avatar" alt="Avatar">
                ${isOnline ? '<div class="online-indicator"></div>' : ''}
                <div class="conversation-info">
                    <div class="conversation-header">
                        <span class="conversation-name">${friend.username}</span>
                    </div>
                    <div class="conversation-message">${isOnline ? '온라인' : '오프라인'}</div>
                </div>
                <div class="friend-actions" style="margin-left: auto; display: flex; gap: 5px;">
                    <button class="icon-btn remove-friend-btn" title="친구 삭제" data-id="${friend._id}">❌</button>
                </div>
            `;

            element.querySelector('.remove-friend-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleRemoveFriend(friend);
            });

            element.addEventListener('click', () => this.startChat(friend));
            container.appendChild(element);
        });
    }

    async handleRemoveFriend(friend) {
        if (confirm(`${friend.username}님을 친구 목록에서 삭제하시겠습니까?`)) {
            try {
                await API.removeFriend(friend._id);
                this.loadFriends();
            } catch (error) {
                alert('친구 삭제 실패: ' + error.message);
            }
        }
    }

    renderConversations() {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '';

        this.conversations.forEach(conv => {
            const otherParticipant = conv.participants.find(p => p._id !== this.currentUser._id);
            const name = conv.type === 'group' ? (conv.name || '그룹 채팅') : otherParticipant?.username;
            const avatar = conv.type === 'group' ? conv.avatar : otherParticipant?.avatar;
            const isOnline = otherParticipant?.status === 'online';

            const element = document.createElement('div');
            element.className = 'conversation-item';
            if (this.currentConversation && this.currentConversation._id === conv._id) {
                element.classList.add('active');
            }

            element.innerHTML = `
                <img src="${avatar}" class="conversation-avatar" alt="Avatar">
                ${isOnline ? '<div class="online-indicator"></div>' : ''}
                <div class="conversation-info">
                    <div class="conversation-header">
                        <span class="conversation-name">${name}</span>
                        ${conv.lastMessage ? `<span class="conversation-time">${this.formatTime(conv.lastMessage.timestamp)}</span>` : ''}
                    </div>
                    <div class="conversation-message">${conv.lastMessage?.content || '메시지가 없습니다'}</div>
                </div>
            `;

            element.addEventListener('click', () => this.selectConversation(conv));
            container.appendChild(element);
        });
    }

    async selectConversation(conversation) {
        this.currentConversation = conversation;
        
        // Update UI
        document.getElementById('noChatSelected').classList.add('hidden');
        document.getElementById('chatContainer').classList.remove('hidden');

        // Update header
        const otherParticipant = conversation.participants.find(p => p._id !== this.currentUser._id);
        const name = conversation.type === 'group' ? (conversation.name || '그룹 채팅') : otherParticipant?.username;
        const avatar = conversation.type === 'group' ? conversation.avatar : otherParticipant?.avatar;
        const status = otherParticipant?.status === 'online' ? '온라인' : '오프라인';

        document.getElementById('chatName').textContent = name;
        document.getElementById('chatAvatar').src = avatar;
        document.getElementById('chatStatus').textContent = status;

        // Join room
        API.socket.emit('join-conversation', conversation._id);

        // Load conversation key
        await this.loadConversationKey(conversation);

        // Load messages
        await this.loadMessages();

        // Update conversations list
        this.renderConversations();
    }

    async loadConversationKey(conversation) {
        const storedKey = await window.electron.store.get(`conv_${conversation._id}`);
        
        if (storedKey) {
            this.conversationKeys.set(conversation._id, storedKey);
        } else {
            const participantKeys = conversation.participants.map(p => p.publicKey);
            const key = await CryptoUtils.createConversationKey(conversation._id, participantKeys);
            await window.electron.store.set(`conv_${conversation._id}`, key);
            this.conversationKeys.set(conversation._id, key);
        }
    }

    async loadMessages() {
        if (!this.currentConversation) return;

        try {
            this.messages = await API.getMessages(this.currentConversation._id);
            await this.renderMessages();
        } catch (error) {
            console.error('Load messages error:', error);
        }
    }

    async renderMessages() {
        const container = document.getElementById('messagesList');
        container.innerHTML = '';

        const key = this.conversationKeys.get(this.currentConversation._id);

        for (const msg of this.messages) {
            await this.renderMessage(msg, key);
        }

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    async renderMessage(message, key) {
        const container = document.getElementById('messagesList');
        const isSent = message.senderId._id === this.currentUser._id;

        // Decrypt message
        let text = '🔒 암호화된 메시지';
        if (key) {
            text = await CryptoUtils.decryptMessage(message.encryptedContent, message.iv, key);
        }

        const element = document.createElement('div');
        element.className = `message ${isSent ? 'sent' : 'received'}`;
        element.dataset.messageId = message._id;

        let contentHtml = '';
        if (message.messageType === 'image' && message.fileUrl) {
            contentHtml = `<div class="message-image-container" style="margin-bottom: 8px;">
                <img src="${message.fileUrl}" class="message-image" alt="${message.fileName}" style="max-width: 250px; border-radius: 8px; cursor: pointer;" onclick="window.open('${message.fileUrl}', '_blank')">
            </div>`;
        } else if (message.messageType === 'file' && message.fileUrl) {
            contentHtml = `<div class="message-file-container" style="background: ${isSent ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)'}; padding: 10px; border-radius: 8px; margin-bottom: 8px;">
                <a href="${message.fileUrl}" target="_blank" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 24px;">📁</span>
                    <div>
                        <div style="font-weight: bold; word-break: break-all;">${message.fileName}</div>
                        <div style="font-size: 0.8em; opacity: 0.8;">${(message.fileSize / 1024).toFixed(1)} KB</div>
                    </div>
                </a>
            </div>`;
        }

        element.innerHTML = `
            <div class="message-content">
                ${contentHtml}
                <div class="message-text">${this.escapeHtml(text)}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
            </div>
        `;

        // Right-click menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showMessageContextMenu(message, isSent);
        });

        container.appendChild(element);
    }

    async addMessage(message) {
        const key = this.conversationKeys.get(this.currentConversation._id);
        await this.renderMessage(message, key);
        
        // Scroll to bottom
        const container = document.getElementById('messagesList');
        container.scrollTop = container.scrollHeight;
    }

    removeMessage(messageId) {
        const element = document.querySelector(`[data-message-id="${messageId}"]`);
        if (element) {
            element.remove();
        }
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();

        if (!text || !this.currentConversation) return;

        const key = this.conversationKeys.get(this.currentConversation._id);
        if (!key) {
            alert('암호화 키를 불러올 수 없습니다.');
            return;
        }

        try {
            // Encrypt message
            const { encryptedContent, iv } = await CryptoUtils.encryptMessage(text, key);

            // Send via socket
            API.socket.emit('send-message', {
                conversationId: this.currentConversation._id,
                encryptedContent,
                iv,
                messageType: 'text'
            });

            input.value = '';
        } catch (error) {
            console.error('Send message error:', error);
            alert('메시지 전송에 실패했습니다.');
        }
    }

    async handleFileUpload(file) {
        if (!file || !this.currentConversation) return;

        const key = this.conversationKeys.get(this.currentConversation._id);
        if (!key) {
            alert('암호화 키를 불러올 수 없습니다.');
            return;
        }

        try {
            // Upload file
            const uploadData = await API.uploadFile(file);
            
            // Encrypt a placeholder text for the file
            const textToEncrypt = `[파일] ${uploadData.fileName}`;
            const { encryptedContent, iv } = await CryptoUtils.encryptMessage(textToEncrypt, key);

            let msgType = 'file';
            if (uploadData.mimetype && uploadData.mimetype.startsWith('image/')) {
                msgType = 'image';
            }

            // Send via socket
            API.socket.emit('send-message', {
                conversationId: this.currentConversation._id,
                encryptedContent,
                iv,
                messageType: msgType,
                fileUrl: uploadData.fileUrl,
                fileName: uploadData.fileName,
                fileSize: uploadData.fileSize
            });

        } catch (error) {
            console.error('File upload error:', error);
            alert('파일 업로드에 실패했습니다.');
        }
    }

    async searchMessages(query) {
        if (!query) {
            // Load original messages if search is cleared
            await this.loadMessages();
            return;
        }

        if (query.length < 2) return;

        try {
            // Fetch messages from server to search through
            // Note: Since messages are E2E encrypted, we must search locally after fetching.
            const searchPool = await API.searchMessages(this.currentConversation._id, query);
            const key = this.conversationKeys.get(this.currentConversation._id);
            
            if (!key) return;

            // Decrypt and filter
            const filteredResults = [];
            for (const msg of searchPool) {
                const decryptedText = await CryptoUtils.decryptMessage(msg.encryptedContent, msg.iv, key);
                if (decryptedText.toLowerCase().includes(query.toLowerCase())) {
                    msg.decryptedText = decryptedText; // Store for highlighting
                    filteredResults.push(msg);
                }
            }

            // Render results
            const container = document.getElementById('messagesList');
            container.innerHTML = `<div class="search-results-info" style="padding: 10px; text-align: center; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); margin-bottom: 10px;">
                '${query}'에 대한 검색 결과: ${filteredResults.length}개
            </div>`;

            if (filteredResults.length === 0) {
                container.innerHTML += `<div style="text-align: center; margin-top: 50px; color: var(--text-secondary);">검색 결과가 없습니다.</div>`;
            } else {
                for (const msg of filteredResults) {
                    await this.renderSearchResult(msg, query);
                }
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    async renderSearchResult(message, query) {
        const container = document.getElementById('messagesList');
        const isSent = message.senderId._id === this.currentUser._id;
        const text = message.decryptedText;

        const element = document.createElement('div');
        element.className = `message ${isSent ? 'sent' : 'received'}`;
        
        // Highlight matching text
        const regex = new RegExp(`(${query.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
        const highlightedText = this.escapeHtml(text).replace(regex, '<mark style="background-color: #ffd700; color: #000; border-radius: 2px;">$1</mark>');

        element.innerHTML = `
            <div class="message-content">
                <div class="message-text">${highlightedText}</div>
                <div class="message-time">${this.formatTime(message.timestamp)}</div>
            </div>
        `;

        container.appendChild(element);
    }

    showNewChatModal() {
        document.getElementById('newChatModal').classList.remove('hidden');
        document.getElementById('searchUsers').value = '';
        document.getElementById('userSearchResults').innerHTML = '';
    }

    hideNewChatModal() {
        document.getElementById('newChatModal').classList.add('hidden');
    }

    async searchUsers() {
        const query = document.getElementById('searchUsers').value.trim();
        if (!query) return;

        try {
            const users = await API.searchUsers(query);
            this.renderUserSearchResults(users);
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    renderUserSearchResults(users) {
        const container = document.getElementById('userSearchResults');
        container.innerHTML = '';

        if (users.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">검색 결과가 없습니다</div>';
            return;
        }

        users.forEach(user => {
            const element = document.createElement('div');
            element.className = 'user-item';
            element.innerHTML = `
                <img src="${user.avatar}" class="user-item-avatar" alt="Avatar">
                <div class="user-item-info">
                    <div class="user-item-name">${user.username}</div>
                    <div class="user-item-email">${user.email}</div>
                </div>
                <div class="user-item-actions" style="margin-left: auto; display: flex; gap: 5px;">
                    <button class="icon-btn add-friend-btn" title="친구 추가">👤+</button>
                    <button class="icon-btn start-chat-btn" title="채팅 시작">💬</button>
                </div>
            `;

            element.querySelector('.add-friend-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleAddFriend(user);
            });

            element.querySelector('.start-chat-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.startChat(user);
            });

            element.addEventListener('click', () => this.startChat(user));
            container.appendChild(element);
        });
    }

    async handleAddFriend(user) {
        try {
            await API.addFriend(user._id);
            alert(`${user.username}님을 친구로 추가했습니다.`);
            this.loadFriends();
        } catch (error) {
            alert('친구 추가 실패: ' + error.message);
        }
    }

    async startChat(user) {
        try {
            const conversation = await API.createConversation([user._id], 'direct');
            await this.loadConversations();
            await this.selectConversation(conversation);
            this.hideNewChatModal();
        } catch (error) {
            console.error('Start chat error:', error);
        }
    }

    showMessageContextMenu(message, isSent) {
        const options = ['읽음 정보 확인'];
        if (isSent) options.push('삭제');
        else options.push('신고');

        const choice = confirm(`메시지 옵션:\n1. 읽음 정보 확인\n2. ${isSent ? '삭제' : '신고'}\n\n[확인]을 누르면 1번, [취소]를 누르면 2번이 실행됩니다.`);
        
        if (choice) {
            this.showReadStatus(message._id);
        } else {
            if (isSent) {
                if (confirm('이 메시지를 삭제하시겠습니까?')) {
                    this.deleteMessage(message._id);
                }
            } else {
                const reason = prompt('신고 사유를 입력해주세요:');
                if (reason) {
                    this.reportMessage(message._id, reason);
                }
            }
        }
    }

    async deleteMessage(messageId) {
        try {
            await API.deleteMessage(messageId);
        } catch (error) {
            alert('메시지 삭제에 실패했습니다.');
        }
    }

    async reportMessage(messageId, reason) {
        try {
            await API.reportMessage(messageId, reason, '');
            alert('신고가 접수되었습니다.');
        } catch (error) {
            alert('신고에 실패했습니다.');
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}시간 전`;

        return date.toLocaleDateString('ko-KR');
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Initialize app
const app = new App();
