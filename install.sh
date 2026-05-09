#!/bin/bash

echo "╔═══════════════════════════════════════════════════╗"
echo "║   🔒 Secure Messenger - 빠른 설치 스크립트      ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo "   https://nodejs.org 에서 Node.js를 설치해주세요."
    exit 1
fi

echo "✅ Node.js 버전: $(node -v)"
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB가 실행되고 있지 않습니다."
    echo "   MongoDB를 시작하세요: mongod"
    echo ""
fi

# Install backend dependencies
echo "📦 백엔드 의존성 설치 중..."
cd backend
npm install
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ .env 파일이 생성되었습니다. 필요한 설정을 수정해주세요."
fi
cd ..
echo ""

# Install mobile dependencies
echo "📦 모바일 앱 의존성 설치 중..."
cd mobile
npm install
cd ..
echo ""

# Install desktop dependencies
echo "📦 데스크톱 앱 의존성 설치 중..."
cd desktop
npm install
cd ..
echo ""

echo "╔═══════════════════════════════════════════════════╗"
echo "║   ✅ 설치 완료!                                  ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "다음 명령어로 각 부분을 실행할 수 있습니다:"
echo ""
echo "1️⃣  백엔드 서버:"
echo "   cd backend && npm start"
echo ""
echo "2️⃣  모바일 앱:"
echo "   cd mobile && npm start"
echo ""
echo "3️⃣  데스크톱 앱:"
echo "   cd desktop && npm start"
echo ""
echo "📖 자세한 사용법은 README.md를 참고하세요."
