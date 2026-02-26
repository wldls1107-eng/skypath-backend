// SKYPATH Backend API Server (Updated for SKYPATH Final)
// Node.js + Express + MongoDB
// Supports: Score History, Profile Management, Search, Video Upload

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection (your existing connection preserved)
console.log("Using env MONGODB_URI?", !!process.env.MONGODB_URI);
console.log("URI contains +srv ?", (process.env.MONGODB_URI || "").includes("+srv"));
console.log("URI host hint:", (process.env.MONGODB_URI || "").match(/@([^/]+)/)?.[1]);
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skypath', {
  // useNewUrlParser: true,
  // useUnifiedTopology: true
}).then(() => {
  console.log('✅ MongoDB connected successfully');
}).catch(err => {
  console.error('❌ MongoDB connection error:', err);
});

// ============================================================
// 데이터베이스 스키마
// ============================================================

// 🆕 Score History Schema (모의고사 성적 기록)
const scoreHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // Format: "YYYY-MM" (e.g., "2025-03")
  korean: { type: Number, required: true, min: 0, max: 100 },
  math: { type: Number, required: true, min: 0, max: 100 },
  english: { type: Number, required: true, min: 0, max: 100 },
  science: { type: Number, required: true, min: 0, max: 100 },
  createdAt: { type: Date, default: Date.now }
});

// Compound index to prevent duplicate entries for same user and date
scoreHistorySchema.index({ userId: 1, date: 1 }, { unique: true });

const ScoreHistory = mongoose.model('ScoreHistory', scoreHistorySchema);

// User Schema (enhanced with school field)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin', 'master'], default: 'student' },
  grade: String,
  school: String, // 🆕 School field
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
    startDate: Date,
    endDate: Date
  },
  scores: {
    korean: { type: Number, default: 0 },
    math: { type: Number, default: 0 },
    english: { type: Number, default: 0 },
    science: { type: Number, default: 0 }
  },
  watchHistory: [{
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
    watchedAt: Date,
    progress: Number,
    completed: Boolean
  }],
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
});

const User = mongoose.model('User', userSchema);

// Video Schema
const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  instructor: { type: String, required: true },
  duration: { type: String, required: true },
  provider: { type: String, required: true },
  grade: { type: String, required: true },
  subject: { type: String, required: true },
  description: String,
  thumbnail: String,
  videoUrl: { type: String, required: true },
  fileName: String,
  fileSize: Number,
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['processing', 'active', 'inactive'], default: 'active' },
  tags: [String]
});

const Video = mongoose.model('Video', videoSchema);

// Progress Schema
const progressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
  progress: { type: Number, default: 0 },
  lastWatchedAt: { type: Date, default: Date.now },
  completed: { type: Boolean, default: false }
});

const Progress = mongoose.model('Progress', progressSchema);

// ============================================================
// AWS S3 Configuration
// ============================================================

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-northeast-2'
});

// Multer Configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 }
});

// ============================================================
// Authentication Middleware
// ============================================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'master') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============================================================
// API Routes
// ============================================================

// 회원가입
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, grade, school } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email, password: hashedPassword, name, grade, school, role: 'student'
    });
    await user.save();
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    res.status(201).json({
      message: 'User registered successfully', token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role, grade: user.grade, school: user.school }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 로그인
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    user.lastLogin = new Date();
    await user.save();
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
    res.json({
      message: 'Login successful', token,
      user: { id: user._id, email: user.email, name: user.name, role: user.role, grade: user.grade, school: user.school, subscription: user.subscription }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 영상 목록 조회
app.get('/api/videos', async (req, res) => {
  try {
    const { grade, subject, provider, search, limit = 50, page = 1 } = req.query;
    let query = { status: 'active' };
    if (grade) query.grade = grade;
    if (subject) query.subject = subject;
    if (provider) query.provider = provider;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { instructor: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    const videos = await Video.find(query)
      .sort({ uploadDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    const total = await Video.countDocuments(query);
    res.json({
      videos,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// 영상 검색
app.get('/api/videos/search', async (req, res) => {
  try {
    const { query, grade, subject } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }
    let filter = {
      status: 'active',
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { instructor: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ]
    };
    if (grade) filter.grade = grade;
    if (subject) filter.subject = subject;
    const videos = await Video.find(filter).limit(20);
    res.json({ query, results: videos, count: videos.length });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// 영상 상세 조회
app.get('/api/videos/:id', async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    video.views += 1;
    await video.save();
    res.json(video);
  } catch (error) {
    console.error('Get video error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// 영상 업로드
app.post('/api/videos/upload', authenticateToken, isAdmin, upload.single('video'), async (req, res) => {
  try {
    const { title, instructor, duration, provider, grade, subject, description, thumbnail } = req.body;
    const videoFile = req.file;
    if (!videoFile) {
      return res.status(400).json({ error: 'Video file required' });
    }
    const fileName = `videos/${Date.now()}-${videoFile.originalname}`;
    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: videoFile.buffer,
      ContentType: videoFile.mimetype,
    };
    const s3Result = await s3.upload(s3Params).promise();
    const video = new Video({
      title, instructor, duration, provider, grade, subject, description,
      thumbnail: thumbnail || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      videoUrl: s3Result.Location,
      fileName: videoFile.originalname,
      fileSize: videoFile.size,
      uploadedBy: req.user.userId
    });
    await video.save();
    res.status(201).json({ message: 'Video uploaded successfully', video });
  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({ error: 'Failed to upload video', details: error.message });
  }
});

// 내 정보 조회
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// 프로필 업데이트
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const { name, grade, school } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name, grade, school },
      { new: true }
    ).select('-password');
    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// 비밀번호 변경
app.put('/api/users/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// 현재 성적 업데이트
app.put('/api/users/scores', authenticateToken, async (req, res) => {
  try {
    const { korean, math, english, science } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { scores: { korean, math, english, science } },
      { new: true }
    ).select('-password');
    res.json({ message: 'Scores updated successfully', user });
  } catch (error) {
    console.error('Update scores error:', error);
    res.status(500).json({ error: 'Failed to update scores' });
  }
});

// 모의고사 성적 추가
app.post('/api/users/score-history', authenticateToken, async (req, res) => {
  try {
    const { date, korean, math, english, science } = req.body;
    if (!date || korean === undefined || math === undefined || english === undefined || science === undefined) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (!/^\d{4}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM' });
    }
    const scores = [korean, math, english, science];
    if (scores.some(score => score < 0 || score > 100)) {
      return res.status(400).json({ error: 'Scores must be between 0 and 100' });
    }
    const existing = await ScoreHistory.findOne({ userId: req.user.userId, date });
    if (existing) {
      return res.status(400).json({ error: 'Score for this date already exists' });
    }
    const scoreHistory = new ScoreHistory({
      userId: req.user.userId, date,
      korean: parseInt(korean), math: parseInt(math),
      english: parseInt(english), science: parseInt(science)
    });
    await scoreHistory.save();
    res.status(201).json({ message: 'Score history added successfully', scoreHistory });
  } catch (error) {
    console.error('Add score history error:', error);
    res.status(500).json({ error: 'Failed to add score history' });
  }
});

// 모의고사 성적 조회
app.get('/api/users/score-history', authenticateToken, async (req, res) => {
  try {
    const scoreHistory = await ScoreHistory.find({ userId: req.user.userId }).sort({ date: 1 });
    res.json({ scoreHistory, count: scoreHistory.length });
  } catch (error) {
    console.error('Get score history error:', error);
    res.status(500).json({ error: 'Failed to fetch score history' });
  }
});

// 모의고사 성적 삭제
app.delete('/api/users/score-history/:id', authenticateToken, async (req, res) => {
  try {
    const scoreHistory = await ScoreHistory.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.userId
    });
    if (!scoreHistory) {
      return res.status(404).json({ error: 'Score history not found' });
    }
    res.json({ message: 'Score history deleted successfully' });
  } catch (error) {
    console.error('Delete score history error:', error);
    res.status(500).json({ error: 'Failed to delete score history' });
  }
});

// AI 맞춤 추천
app.get('/api/recommendations', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const weakSubjects = [];
    if (user.scores.korean < 80) weakSubjects.push('국어');
    if (user.scores.math < 80) weakSubjects.push('수학');
    if (user.scores.english < 80) weakSubjects.push('영어');
    if (user.scores.science < 80) weakSubjects.push('과학');
    const recommendations = await Video.find({
      subject: { $in: weakSubjects },
      grade: user.grade,
      status: 'active'
    }).limit(10);
    res.json({ weakSubjects, recommendations });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

app.use(express.static(path.join(__dirname, '../frontend-web')));

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 SKYPATH API Server (Final Version)                  ║
║                                                           ║
║   📡 Server: http://localhost:${PORT}                       ║
║   📊 MongoDB: Connected                                   ║
║   ☁️  AWS S3: Configured                                  ║
║                                                           ║
║   🆕 New Features:                                        ║
║   ✅ Score History (모의고사 기록)                         ║
║   ✅ Profile Management (학교 정보)                        ║
║   ✅ Enhanced Search (검색 개선)                           ║
║   ✅ Mobile Optimized (모바일 최적화)                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '2.0.0'
  });
});

app.get('/api', (req, res) => {
  res.json({
    message: 'SKYPATH API v2.0',
    endpoints: {
      auth: { register: 'POST /api/auth/register', login: 'POST /api/auth/login' },
      videos: { list: 'GET /api/videos', search: 'GET /api/videos/search', detail: 'GET /api/videos/:id', upload: 'POST /api/videos/upload (admin)' },
      user: { profile: 'GET /api/users/me', updateProfile: 'PUT /api/users/profile', updatePassword: 'PUT /api/users/password', updateScores: 'PUT /api/users/scores' },
      scoreHistory: { add: 'POST /api/users/score-history', list: 'GET /api/users/score-history', delete: 'DELETE /api/users/score-history/:id' },
      learning: { recommendations: 'GET /api/recommendations' }
    }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

module.exports = app;
