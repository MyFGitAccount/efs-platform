import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

// Import routes
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import adminRoutes from './routes/admin.js';
import groupRoutes from './routes/group.js';
import questionnaireRoutes from './routes/questionnaire.js';
import materialRoutes from './routes/materials.js';
import calendarRoutes from './routes/calendar.js';
import profileRoutes from './routes/profile.js';
import dashboardRoutes from './routes/dashboard.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const materialsDir = path.join(uploadsDir, 'materials');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(materialsDir)) {
  fs.mkdirSync(materialsDir, { recursive: true });
}

// CORS configuration
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://efs-platform.vercel.app',
      'https://efs-platform-*.vercel.app',
      'https://efs-platform-git-*.vercel.app'
    ]
  : [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.some(allowedOrigin => 
      origin === allowedOrigin || 
      allowedOrigin.includes('*') && 
      origin.startsWith(allowedOrigin.split('*')[0])
    )) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploads statically
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/group', groupRoutes);
app.use('/api/questionnaire', questionnaireRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'EFS Platform API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDistPath = path.join(__dirname, '../client/dist');
  
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    ok: false, 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
  });
});

/* vercel is serverless in production environemnt don't use app.listen 
// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📁 API: http://localhost:${PORT}/api`);
    console.log(`📁 Frontend: http://localhost:3000`);
    console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
  });
}
*/

export default app