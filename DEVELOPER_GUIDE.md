# 🔧 개발자 가이드

## 프로젝트 아키텍처

### 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                         클라이언트                           │
│  ┌──────────────────┐            ┌──────────────────┐       │
│  │  React Native    │            │    Electron      │       │
│  │  (모바일 앱)      │            │  (데스크톱 앱)    │       │
│  └────────┬─────────┘            └─────────┬────────┘       │
│           │                                 │                │
│           │    ┌──────────────────┐        │                │
│           └────┤   암호화 계층     ├────────┘                │
│                └─────────┬────────┘                         │
└──────────────────────────┼──────────────────────────────────┘
                           │
                 ┌─────────┴─────────┐
                 │    WebSocket      │
                 │   (Socket.io)     │
                 └─────────┬─────────┘
                           │
┌──────────────────────────┼──────────────────────────────────┐
│                          ▼                                   │
│                   백엔드 서버                                 │
│  ┌──────────────────────────────────────────────────┐       │
│  │         Node.js + Express + Socket.io            │       │
│  │                                                   │       │
│  │  ┌───────────┐  ┌──────────┐  ┌──────────┐     │       │
│  │  │   인증    │  │  실시간  │  │  메시지  │     │       │
│  │  │  (JWT)    │  │  통신    │  │  라우팅  │     │       │
│  │  └───────────┘  └──────────┘  └──────────┘     │       │
│  └──────────────────────┬───────────────────────────┘       │
│                         │                                    │
│                         ▼                                    │
│                  ┌─────────────┐                            │
│                  │   MongoDB   │                            │
│                  │ (암호화된    │                            │
│                  │   데이터)    │                            │
│                  └─────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

## 데이터 흐름

### 메시지 전송 흐름

```
1. 사용자 입력
   ↓
2. 클라이언트 측 암호화
   - 대화 암호화 키로 메시지 암호화
   - IV(Initialization Vector) 생성
   ↓
3. 암호화된 메시지 전송
   - Socket.io로 서버에 전송
   ↓
4. 서버 저장 및 전달
   - MongoDB에 암호화된 메시지 저장
   - 수신자에게 암호화된 메시지 전달
   ↓
5. 수신자 측 복호화
   - 로컬 암호화 키로 메시지 복호화
   - 화면에 원본 메시지 표시
```

### 인증 흐름

```
1. 회원가입
   ↓
2. 클라이언트에서 키 쌍 생성
   - 공개키: 서버로 전송
   - 개인키: 디바이스에 안전하게 저장
   ↓
3. JWT 토큰 발급
   - 서버에서 JWT 생성
   - 클라이언트에 전달
   ↓
4. 토큰 저장
   - 모바일: AsyncStorage
   - 데스크톱: Electron Store
   ↓
5. 인증된 요청
   - Authorization 헤더에 토큰 포함
   - Socket 연결 시 토큰 인증
```

## API 엔드포인트

### REST API

```
POST   /api/auth/register          # 회원가입
POST   /api/auth/login             # 로그인
GET    /api/users/:userId          # 사용자 프로필 조회
GET    /api/users/search/:query    # 사용자 검색
POST   /api/conversations          # 대화 생성
GET    /api/conversations          # 대화 목록 조회
GET    /api/conversations/:id/messages  # 메시지 조회
DELETE /api/messages/:id           # 메시지 삭제
POST   /api/messages/:id/report    # 메시지 신고
```

### Socket.io 이벤트

#### 클라이언트 → 서버

```javascript
// 인증
socket.emit('authenticate', token)

// 대화방 입장
socket.emit('join-conversation', conversationId)

// 메시지 전송
socket.emit('send-message', {
  conversationId,
  encryptedContent,
  iv,
  messageType
})

// 입력 중 표시
socket.emit('typing', { conversationId })
socket.emit('stop-typing', { conversationId })

// 읽음 확인
socket.emit('mark-read', { messageId, conversationId })
```

#### 서버 → 클라이언트

```javascript
// 새 메시지
socket.on('new-message', (message) => {})

// 사용자 상태 변경
socket.on('user-status-changed', ({ userId, status }) => {})

// 입력 중 표시
socket.on('user-typing', ({ userId, conversationId }) => {})
socket.on('user-stop-typing', ({ userId, conversationId }) => {})

// 메시지 읽음
socket.on('message-read', ({ messageId, userId }) => {})

// 메시지 삭제
socket.on('message-deleted', ({ messageId, conversationId }) => {})
```

## 데이터베이스 스키마

### User Collection

```javascript
{
  _id: ObjectId,
  username: String,
  email: String (lowercased),
  password: String (hashed),
  publicKey: String,
  avatar: String,
  status: String ('online', 'offline'),
  lastSeen: Date,
  friends: [ObjectId],          // 친구 ID 배열
  resetPasswordToken: String,    // 비밀번호 재설정 토큰
  resetPasswordExpires: Date,   // 토큰 만료 시간
  createdAt: Date
}
```

### Conversation Collection

```javascript
{
  _id: ObjectId,
  participants: [ObjectId],
  type: String ('direct', 'group'),
  name: String,
  avatar: String,
  lastMessage: {
    content: String,
    senderId: ObjectId,
    timestamp: Date
  },
  createdAt: Date
}
```

### Message Collection

```javascript
{
  _id: ObjectId,
  conversationId: ObjectId,
  senderId: ObjectId,
  encryptedContent: String,
  iv: String,
  messageType: String ('text', 'image', 'file', 'voice'),
  fileUrl: String,
  fileName: String,
  fileSize: Number,
  timestamp: Date,
  readBy: [ObjectId],
  deleted: Boolean,
  reported: Boolean
}
```

### Report Collection

```javascript
{
  _id: ObjectId,
  messageId: ObjectId,
  reporterId: ObjectId,
  reason: String,
  description: String,
  status: String ('pending', 'reviewed', 'resolved'),
  createdAt: Date
}
```

## 암호화 구현

### 현재 구현

이 프로젝트는 강력한 산업 표준 암호화 방식을 채택하고 있습니다:

1. **사용자 신원 (RSA-OAEP 2048)**
   - 회원가입 시 각 클라이언트는 RSA-OAEP 2048 키 쌍을 생성합니다.
   - 공개키는 서버에 공유되며, 개인키는 디바이스의 안전한 저장소(SecureStore/Keychain)에 보관됩니다.

2. **메시지 암호화 (AES-GCM 256)**
   - 각 대화방마다 고유한 256비트 대칭키가 생성됩니다.
   - 모든 메시지는 AES-GCM 모드로 암호화되어 데이터 무결성과 기밀성을 동시에 보장합니다.
   - IV(Initialization Vector)는 메시지마다 무작위로 생성되어 재전송 공격을 방지합니다.

3. **키 유도 로직**
   - 대화 참여자들의 공개 정보를 조합하여 SHA-256 기반으로 대화 키를 유도하거나 공유합니다.

### 코드 예시 (AES-GCM)

```javascript
// Web Crypto API를 이용한 암호화 (Desktop)
const encrypted = await window.crypto.subtle.encrypt(
  { name: "AES-GCM", iv: iv },
  keyMaterial,
  new TextEncoder().encode(message)
);

// CryptoJS를 이용한 암호화 (Mobile)
const encrypted = CryptoJS.AES.encrypt(message, key, {
  iv: iv,
  mode: CryptoJS.mode.GCM,
  padding: CryptoJS.pad.NoPadding
});
```

## 개발 환경 설정

### 필수 도구

- Node.js v16+
- MongoDB v5+
- Expo CLI (모바일)
- Electron (데스크톱)

### VSCode 추천 확장

- ESLint
- Prettier
- React Native Tools
- MongoDB for VS Code

### 환경 변수

```bash
# backend/.env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/secure-messenger
JWT_SECRET=your-super-secret-key
```

## 디버깅

### 백엔드 디버깅

```bash
# 개발 모드로 실행
cd backend
npm run dev

# 로그 확인
tail -f logs/app.log
```

### 모바일 디버깅

```bash
# React Native Debugger 실행
npx react-devtools

# 로그 확인
npx react-native log-android
npx react-native log-ios
```

### 데스크톱 디버깅

```bash
# DevTools와 함께 실행
cd desktop
npm run dev
```

## 테스트

### 단위 테스트

```bash
# 백엔드 테스트
cd backend
npm test

# 모바일 테스트
cd mobile
npm test
```

### E2E 테스트

```bash
# Detox (모바일)
cd mobile
npm run test:e2e

# Spectron (데스크톱)
cd desktop
npm run test:e2e
```

## 배포

### 백엔드 배포

```bash
# Docker 이미지 빌드
docker build -t secure-messenger-backend .

# Docker 실행
docker run -p 5000:5000 secure-messenger-backend
```

### 모바일 배포

```bash
# Android APK 빌드
cd mobile
expo build:android

# iOS IPA 빌드
expo build:ios
```

### 데스크톱 배포

```bash
# 모든 플랫폼 빌드
cd desktop
npm run build

# 특정 플랫폼
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

## 성능 최적화

### 백엔드

- MongoDB 인덱싱
- Redis 캐싱
- 메시지 페이지네이션
- 압축 미들웨어

### 프론트엔드

- React 메모이제이션
- 이미지 최적화
- 코드 스플리팅
- 지연 로딩

## 보안 체크리스트

- [ ] HTTPS/TLS 사용
- [ ] 강력한 암호화 알고리즘
- [ ] 안전한 키 저장
- [ ] XSS 방지
- [ ] CSRF 방지
- [ ] SQL/NoSQL 인젝션 방지
- [ ] 레이트 리미팅
- [ ] 입력 검증
- [ ] 보안 헤더
- [ ] 정기적인 의존성 업데이트

## 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스

MIT License - 자유롭게 사용하세요!

---

질문이나 제안사항이 있으시면 이슈를 생성해주세요.
nse - 자유롭게 사용하세요!

---

질문이나 제안사항이 있으시면 이슈를 생성해주세요.
