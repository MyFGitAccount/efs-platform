import express from 'express';
//import dotenv from 'dotenv';
import connectDB from '../db/connection.js';

//dotenv.config();

const router = express.Router();

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  try {
    const sid = req.headers['x-sid'] || req.query.sid || req.body.sid;
    if (!sid) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ sid });
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /api/me - Get current user
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne(
      { sid: req.user.sid },
      { projection: { password: 0, token: 0 } } // Exclude sensitive data
    );
    
    res.json({ ok: true, data: user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/me/credits - Get user credits
router.get('/credits', requireAuth, async (req, res) => {
  try {
    res.json({ 
      ok: true, 
      credits: req.user.credits || 0 
    });
  } catch (err) {
    console.error('Get credits error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/me/token - Get user token
router.get('/token', requireAuth, async (req, res) => {
  try {
    res.json({ 
      ok: true, 
      token: req.user.token || null 
    });
  } catch (err) {
    console.error('Get token error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/me/update - Update user profile
router.post('/update', requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    const db = await connectDB();
    
    // Remove sensitive fields
    delete updates.password;
    delete updates.token;
    delete updates._id;
    delete updates.sid;
    
    updates.updatedAt = new Date();
    
    await db.collection('users').updateOne(
      { sid: req.user.sid },
      { $set: updates }
    );
    
    res.json({ ok: true, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});


export default router;
