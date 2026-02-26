// 관리자 계정 생성 스크립트
// 사용법: node create-admin.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
  grade: String,
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
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skypass');
    console.log('MongoDB 연결 성공!');

    // 기존 관리자 확인
    const existing = await User.findOne({ email: 'admin@skypass.com' });
    if (existing) {
      // 이미 있으면 role만 admin으로 업데이트
      existing.role = 'admin';
      await existing.save();
      console.log('✅ 기존 계정을 관리자로 업그레이드했습니다!');
      console.log('📧 이메일: admin@skypass.com');
      console.log('🔑 기존 비밀번호를 사용하세요');
    } else {
      // 새로 생성
      const hashedPassword = await bcrypt.hash('admin1234', 10);
      const admin = new User({
        email: 'admin@skypass.com',
        password: hashedPassword,
        name: '관리자',
        role: 'admin',
        grade: 'admin'
      });
      await admin.save();
      console.log('✅ 관리자 계정 생성 완료!');
      console.log('📧 이메일: admin@skypass.com');
      console.log('🔑 비밀번호: admin1234');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

createAdmin();
