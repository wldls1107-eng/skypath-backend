# SKYPATH Backend Setup Guide (Final Version)

## 🎉 업데이트된 기능

### 🆕 새로 추가된 API

1. **모의고사 성적 기록 (Score History)**
   - POST `/api/users/score-history` - 성적 추가
   - GET `/api/users/score-history` - 성적 조회
   - DELETE `/api/users/score-history/:id` - 성적 삭제
   - 1월~12월 모든 달 지원
   - 연도별 기록 가능

2. **프로필 관리 (Enhanced Profile)**
   - PUT `/api/users/profile` - 이름, 학년, 학교 업데이트
   - PUT `/api/users/password` - 비밀번호 변경
   - `school` 필드 추가

3. **향상된 검색 (Enhanced Search)**
   - GET `/api/videos/search` - 제목, 강사, 설명 검색
   - 학년, 과목 필터링 지원

4. **관리자 기능**
   - `master` 역할 추가 (admin + master 모두 관리자 권한)

---

## 📁 파일 구조

```
backend/
├── .env              # 환경 변수 (MongoDB, AWS S3 설정)
├── server.js         # 메인 서버 파일
├── package.json      # 의존성 관리
└── README.md         # 이 파일
```

---

## 🚀 빠른 시작

### 1단계: 의존성 설치

```bash
npm install
```

### 2단계: 환경 변수 설정

`.env` 파일을 열고 **당신의 MongoDB URI**를 확인하세요:

```env
# MongoDB Configuration (이미 설정되어 있음!)
MONGODB_URI=mongodb://localhost:27017/skypath
# 또는 MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/skypath

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# AWS S3 (영상 업로드용 - 선택사항)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=skypath-videos
```

**✅ 당신의 MongoDB 연결은 이미 설정되어 있으므로 그대로 유지하세요!**

### 3단계: 서버 실행

```bash
node server.js
```

또는 개발 모드 (nodemon 사용):

```bash
npm run dev
```

서버가 시작되면 다음과 같이 표시됩니다:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 SKYPATH API Server (Final Version)                  ║
║                                                           ║
║   📡 Server: http://localhost:3000                       ║
║   📊 MongoDB: Connected                                   ║
║   ☁️  AWS S3: Configured                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 📊 데이터베이스 스키마

### User Collection
```javascript
{
  email: String (unique),
  password: String (hashed),
  name: String,
  role: 'student' | 'teacher' | 'admin' | 'master',
  grade: String,
  school: String,           // 🆕 새로 추가
  subscription: {
    plan: 'free' | 'basic' | 'premium',
    startDate: Date,
    endDate: Date
  },
  scores: {
    korean: Number,
    math: Number,
    english: Number,
    science: Number
  }
}
```

### ScoreHistory Collection (🆕 신규)
```javascript
{
  userId: ObjectId,
  date: String,           // "YYYY-MM" format (e.g., "2025-03")
  korean: Number,         // 0-100
  math: Number,           // 0-100
  english: Number,        // 0-100
  science: Number,        // 0-100
  createdAt: Date
}
```

### Video Collection
```javascript
{
  title: String,
  instructor: String,
  duration: String,
  provider: String,       // 'EBS', '메가스터디', etc.
  grade: String,          // '초1' ~ '고3'
  subject: String,        // '수학', '영어', etc.
  description: String,
  thumbnail: String,
  videoUrl: String,       // S3 URL
  views: Number,
  status: 'active' | 'inactive'
}
```

---

## 🔌 API 엔드포인트

### 인증 (Authentication)

#### 회원가입
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "password123",
  "name": "홍길동",
  "grade": "고2",
  "school": "서울고등학교"
}
```

#### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "password123"
}
```

**응답:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "student@example.com",
    "name": "홍길동",
    "role": "student",
    "grade": "고2",
    "school": "서울고등학교"
  }
}
```

---

### 영상 (Videos)

#### 영상 목록 조회
```http
GET /api/videos?grade=고2&subject=수학&limit=20&page=1
```

#### 영상 검색
```http
GET /api/videos/search?query=이차방정식&grade=중2
```

#### 영상 상세
```http
GET /api/videos/:id
```

#### 영상 업로드 (관리자 전용)
```http
POST /api/videos/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

{
  "title": "중학 수학 - 이차방정식",
  "instructor": "김수학",
  "duration": "45:30",
  "provider": "대성마이맥",
  "grade": "중2",
  "subject": "수학",
  "video": [파일]
}
```

---

### 사용자 (User)

#### 내 정보 조회
```http
GET /api/users/me
Authorization: Bearer {token}
```

#### 프로필 업데이트 (🆕)
```http
PUT /api/users/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "홍길동",
  "grade": "고3",
  "school": "서울대학교부설고등학교"
}
```

#### 비밀번호 변경 (🆕)
```http
PUT /api/users/password
Authorization: Bearer {token}
Content-Type: application/json

{
  "currentPassword": "oldpass123",
  "newPassword": "newpass456"
}
```

#### 현재 성적 업데이트
```http
PUT /api/users/scores
Authorization: Bearer {token}
Content-Type: application/json

{
  "korean": 85,
  "math": 72,
  "english": 88,
  "science": 79
}
```

---

### 모의고사 성적 기록 (Score History) 🆕

#### 성적 추가
```http
POST /api/users/score-history
Authorization: Bearer {token}
Content-Type: application/json

{
  "date": "2025-03",
  "korean": 85,
  "math": 72,
  "english": 88,
  "science": 79
}
```

**날짜 형식:**
- `"2025-01"` - 2025년 1월
- `"2025-03"` - 2025년 3월
- `"2025-12"` - 2025년 12월

**응답:**
```json
{
  "message": "Score history added successfully",
  "scoreHistory": {
    "_id": "...",
    "userId": "...",
    "date": "2025-03",
    "korean": 85,
    "math": 72,
    "english": 88,
    "science": 79,
    "createdAt": "2025-02-23T10:00:00.000Z"
  }
}
```

#### 성적 조회
```http
GET /api/users/score-history
Authorization: Bearer {token}
```

**응답:**
```json
{
  "scoreHistory": [
    {
      "_id": "...",
      "date": "2025-01",
      "korean": 80,
      "math": 70,
      "english": 85,
      "science": 75
    },
    {
      "_id": "...",
      "date": "2025-03",
      "korean": 85,
      "math": 72,
      "english": 88,
      "science": 79
    }
  ],
  "count": 2
}
```

#### 성적 삭제
```http
DELETE /api/users/score-history/:id
Authorization: Bearer {token}
```

---

### 학습 (Learning)

#### AI 맞춤 추천
```http
GET /api/recommendations
Authorization: Bearer {token}
```

**응답:**
```json
{
  "weakSubjects": ["수학", "과학"],
  "recommendations": [
    {
      "title": "중학 수학 - 이차방정식",
      "instructor": "김수학",
      "subject": "수학",
      "grade": "중2"
    }
  ]
}
```

---

## 🧪 API 테스트

### Postman 사용

1. **회원가입**
   ```
   POST http://localhost:3000/api/auth/register
   Body: { "email": "test@test.com", "password": "test123", "name": "테스트", "grade": "고1", "school": "테스트고" }
   ```

2. **로그인** (토큰 받기)
   ```
   POST http://localhost:3000/api/auth/login
   Body: { "email": "test@test.com", "password": "test123" }
   ```

3. **성적 추가** (받은 토큰 사용)
   ```
   POST http://localhost:3000/api/users/score-history
   Headers: { "Authorization": "Bearer YOUR_TOKEN_HERE" }
   Body: { "date": "2025-03", "korean": 85, "math": 72, "english": 88, "science": 79 }
   ```

4. **성적 조회**
   ```
   GET http://localhost:3000/api/users/score-history
   Headers: { "Authorization": "Bearer YOUR_TOKEN_HERE" }
   ```

### cURL 사용

```bash
# 회원가입
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"테스트","grade":"고1","school":"테스트고"}'

# 로그인
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 성적 추가
curl -X POST http://localhost:3000/api/users/score-history \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"date":"2025-03","korean":85,"math":72,"english":88,"science":79}'
```

---

## 🔐 관리자 계정

마스터 계정은 프론트엔드에서 하드코딩되어 있습니다:

```javascript
// SKYPATH_Final.html에서
master@skypath.com / master123
admin@skypath.com / admin123
```

실제 사용을 위해서는 DB에 관리자 계정을 생성해야 합니다:

```javascript
const createAdmin = async () => {
  const admin = new User({
    email: 'admin@skypath.com',
    password: await bcrypt.hash('admin123', 10),
    name: '관리자',
    role: 'admin',
    grade: '고3',
    school: 'SKYPATH 고등학교'
  });
  await admin.save();
};
```

---

## 📱 프론트엔드 연동

### API URL 설정

`SKYPATH_Final.html`에서:

```javascript
const API = 'http://localhost:3000';
```

### 로그인 예시

```javascript
const handleLogin = async () => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  
  if (res.ok) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }
};
```

### 성적 기록 가져오기

```javascript
const fetchScoreHistory = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}/api/users/score-history`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  
  if (res.ok) {
    setScoreHistory(data.scoreHistory);
  }
};
```

### 성적 추가

```javascript
const addScore = async (scoreData) => {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API}/api/users/score-history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(scoreData)
  });
  
  if (res.ok) {
    const data = await res.json();
    console.log('Score added:', data.scoreHistory);
  }
};
```

---

## 🐛 문제 해결

### MongoDB 연결 오류

```
❌ MongoDB connection error
```

**해결:**
1. MongoDB가 실행 중인지 확인
2. `.env`의 `MONGODB_URI` 확인
3. MongoDB Atlas 사용 시 IP 화이트리스트 확인

### JWT 토큰 오류

```
403 Invalid token
```

**해결:**
1. 로그인 후 받은 토큰을 정확히 사용하는지 확인
2. 토큰이 만료되었으면 다시 로그인
3. `Authorization: Bearer {token}` 헤더 형식 확인

### AWS S3 업로드 오류

```
Failed to upload video
```

**해결:**
1. `.env`의 AWS 자격증명 확인
2. S3 버킷 권한 확인
3. 파일 크기 제한 확인 (현재 5GB)

---

## 📊 MongoDB 데이터 확인

### MongoDB Compass 사용

1. MongoDB Compass 실행
2. 연결 문자열 입력: `mongodb://localhost:27017/skypath`
3. Collections 확인:
   - `users` - 사용자 정보
   - `scorehistories` - 모의고사 성적 기록
   - `videos` - 영상 정보

### Mongo Shell 사용

```bash
mongo

use skypath

# 사용자 확인
db.users.find().pretty()

# 성적 기록 확인
db.scorehistories.find().pretty()

# 영상 확인
db.videos.find().pretty()
```

---

## 🚀 배포

### Heroku 배포

1. Heroku CLI 설치
2. 프로젝트 디렉토리에서:

```bash
heroku create skypath-api
heroku config:set MONGODB_URI=your-mongodb-atlas-uri
heroku config:set JWT_SECRET=your-secret-key
git push heroku main
```

### AWS EC2 배포

```bash
# EC2 인스턴스에서
git clone your-repo
cd backend
npm install
pm2 start server.js
```

---

## 📝 변경 이력

### v2.0.0 (2025-02-23)

**🆕 추가:**
- 모의고사 성적 기록 API (1-12월 지원)
- 프로필 업데이트 API (학교 필드 포함)
- 비밀번호 변경 API
- 향상된 검색 API
- `master` 역할 추가
- API 문서 엔드포인트 (`GET /api`)

**🔧 개선:**
- MongoDB 연결 오류 처리 개선
- JWT 토큰 만료 시간 7일로 연장
- 검색 기능 강화 (제목, 강사, 설명)

**🐛 수정:**
- 중복 성적 기록 방지
- 날짜 형식 검증

---

## 💡 팁

1. **개발 중**: `nodemon`을 사용하여 자동 재시작
2. **프로덕션**: PM2를 사용하여 프로세스 관리
3. **보안**: `.env` 파일을 `.gitignore`에 추가
4. **로그**: `morgan`을 사용하여 HTTP 요청 로깅
5. **테스트**: Jest를 사용하여 단위 테스트 작성

---

## 📞 지원

문제가 발생하면:
1. 서버 로그 확인
2. MongoDB 연결 상태 확인
3. API 엔드포인트 URL 확인
4. 토큰이 올바른지 확인

---

## ✅ 체크리스트

백엔드 설정 완료 확인:

- [ ] `npm install` 실행 완료
- [ ] `.env` 파일 설정 완료
- [ ] MongoDB 연결 확인
- [ ] 서버 시작 (`node server.js`)
- [ ] Health check 확인 (`GET /health`)
- [ ] 회원가입 테스트
- [ ] 로그인 테스트
- [ ] 성적 기록 추가 테스트
- [ ] 프론트엔드 연동 확인

---

**🎉 축하합니다! SKYPATH 백엔드가 완벽하게 준비되었습니다!**
