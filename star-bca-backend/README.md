# star-bca-backend

A scalable Express.js + MongoDB backend for the Student Activity Reward Point Management System.

## Features
- JWT authentication for students and teachers
- Role-based authorization
- File upload support for certificates via Multer
- Student submission workflow
- Teacher approval/rejection flow
- Dashboard statistics
- Modular MVC structure

## Setup
1. Install dependencies: npm install
2. Start MongoDB locally
3. Copy .env and update values if needed
4. Run seed data: npm run seed
5. Start server: npm run dev

## API Overview
- Auth: /api/auth/student/login, /api/auth/teacher/login
- Student: /api/student/profile, /api/student/submission, /api/student/submissions, /api/student/points
- Teacher: /api/teacher/submissions/pending, /api/teacher/submission/:id/approve, /api/teacher/submission/:id/reject, /api/teacher/dashboard
