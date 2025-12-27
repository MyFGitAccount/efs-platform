import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Connect to MongoDB
const connectDB = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  return client.db();
};

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

// GET /api/profile/me - Get user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const user = await db.collection('users').findOne(
      { sid: req.user.sid },
      { projection: { password: 0 } } // Exclude password
    );
    
    res.json({ ok: true, data: user });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/profile/update - Update user profile
router.put('/update', requireAuth, async (req, res) => {
  try {
    const { 
      email, 
      phone, 
      major, 
      gpa, 
      dse_score, 
      skills, 
      courses, 
      year_of_study, 
      about_me 
    } = req.body;
    
    const db = await connectDB();
    
    const updates = {};
    
    // Validate and prepare updates
    if (email !== undefined) {
      if (!email.includes('@')) {
        return res.status(400).json({ ok: false, error: 'Invalid email' });
      }
      updates.email = email.toLowerCase();
    }
    
    if (phone !== undefined) updates.phone = phone;
    if (major !== undefined) updates.major = major;
    
    if (gpa !== undefined) {
      const gpaNum = parseFloat(gpa);
      if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4) {
        return res.status(400).json({ ok: false, error: 'Invalid GPA' });
      }
      updates.gpa = gpaNum;
    }
    
    if (dse_score !== undefined) updates.dse_score = dse_score;
    
    if (skills !== undefined) {
      updates.skills = Array.isArray(skills) 
        ? skills 
        : typeof skills === 'string' 
          ? skills.split(',').map(s => s.trim()).filter(Boolean)
          : [];
    }
    
    if (courses !== undefined) {
      updates.courses = Array.isArray(courses)
        ? courses.map(c => c.toUpperCase())
        : typeof courses === 'string'
          ? courses.split(',').map(c => c.trim().toUpperCase()).filter(Boolean)
          : [];
    }
    
    if (year_of_study !== undefined) {
      const year = parseInt(year_of_study);
      if (isNaN(year) || year < 1 || year > 4) {
        return res.status(400).json({ ok: false, error: 'Invalid year of study' });
      }
      updates.year_of_study = year;
    }
    
    if (about_me !== undefined) updates.about_me = about_me;
    
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

// GET /api/profile/search - Search users
router.get('/search', async (req, res) => {
  try {
    const { q, major, year } = req.query;
    const db = await connectDB();
    
    const filter = {};
    
    if (q) {
      filter.$or = [
        { sid: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { major: { $regex: q, $options: 'i' } },
      ];
    }
    
    if (major) {
      filter.major = { $regex: major, $options: 'i' };
    }
    
    if (year) {
      filter.year_of_study = parseInt(year);
    }
    
    const users = await db.collection('users')
      .find(filter, { projection: { password: 0 } })
      .limit(50)
      .toArray();
    
    res.json({ ok: true, data: users });
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/profile/:sid - Get specific user profile
router.get('/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const db = await connectDB();
    
    const user = await db.collection('users').findOne(
      { sid },
      { projection: { password: 0, token: 0 } } // Exclude sensitive data
    );
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    res.json({ ok: true, data: user });
  } catch (err) {
    console.error('Get user profile error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/profile/upload-photo - Upload profile photo
router.post('/upload-photo', requireAuth, async (req, res) => {
  try {
    // For now, we'll return a success message
    // In a real implementation, you would handle file upload here
    res.json({ 
      ok: true, 
      message: 'Photo upload endpoint ready',
      note: 'File upload handling needs to be implemented with multer'
    });
  } catch (err) {
    console.error('Upload photo error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
