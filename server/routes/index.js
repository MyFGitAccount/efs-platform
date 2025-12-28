import express from 'express';

const router = express.Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Server is healthy',
    timestamp: new Date().toISOString()
  });
});

// Home endpoint
router.get('/', (req, res) => {
  res.json({ 
    ok: true, 
    message: 'Course Timetable API',
    endpoints: {
      auth: '/api/auth',
      courses: '/api/courses',
      calendar: '/api/calendar'
    },
    version: '1.0.0'
  });
});

// API info endpoint
router.get('/info', (req, res) => {
  res.json({
    ok: true,
    name: 'Course Timetable System API',
    description: 'API for managing courses, timetables, and user schedules',
    version: '1.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Test database connection
router.get('/test-db', async (req, res) => {
  try {
    const connectDB = (await import('../db/connection.js')).default;
    const db = await connectDB();
    
    // Try a simple query
    const collections = await db.listCollections().toArray();
    
    res.json({
      ok: true,
      message: 'Database connection successful',
      collections: collections.map(c => c.name)
    });
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({
      ok: false,
      error: 'Database connection failed',
      message: err.message
    });
  }
});

export default router;