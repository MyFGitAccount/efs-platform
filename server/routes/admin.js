import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const router = express.Router();

// Connect to MongoDB
const connectDB = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  return client.db();
};

// Generate user token
const generateUserToken = () => {
  const array = new Uint32Array(8);
  crypto.getRandomValues(array);
  let token = '';
  for (const num of array) {
    token += num.toString(36);
  }
  return token;
};

// Middleware to check admin access
const requireAdmin = async (req, res, next) => {
  try {
    const sid = req.headers['x-sid'] || req.query.sid;
    if (!sid) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const db = await connectDB();
    const user = await db.collection('users').findOne({ sid });
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }
    
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};

// Apply admin middleware to all routes
router.use(requireAdmin);

// GET /api/admin/pending/accounts - Get pending account requests
router.get('/pending/accounts', async (req, res) => {
  try {
    const db = await connectDB();
    const pendingAccounts = await db.collection('pending_accounts')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: pendingAccounts });
  } catch (err) {
    console.error('Get pending accounts error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/admin/pending/accounts/:sid/approve - Approve account
router.post('/pending/accounts/:sid/approve', async (req, res) => {
  try {
    const { sid } = req.params;
    const db = await connectDB();
    
    // Get pending account
    const pendingAccount = await db.collection('pending_accounts').findOne({ sid });
    if (!pendingAccount) {
      return res.status(404).json({ ok: false, error: 'Pending account not found' });
    }
    
    // Generate token
    const token = generateUserToken();
    const fullToken = `${sid}-${token}`;
    
    // Create user account with 3 credits
    const user = {
      sid: pendingAccount.sid,
      email: pendingAccount.email,
      password: pendingAccount.password,
      photo_path: pendingAccount.photo_path,
      role: 'user',
      token: fullToken,
      credits: 3, // Initial credits
      createdAt: new Date(),
      updatedAt: new Date(),
      gpa: null,
      dse_score: null,
      phone: null,
      major: null,
      skills: [],
      courses: [],
      year_of_study: 1,
      about_me: '',
    };
    
    // Insert into users collection
    await db.collection('users').insertOne(user);
    
    // Remove from pending
    await db.collection('pending_accounts').deleteOne({ sid });
    
    res.json({ 
      ok: true, 
      message: 'Account approved successfully',
      data: { 
        sid: user.sid,
        email: user.email,
        token: user.token,
        credits: user.credits
      }
    });
  } catch (err) {
    console.error('Approve account error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/admin/pending/accounts/:sid/reject - Reject account
router.post('/pending/accounts/:sid/reject', async (req, res) => {
  try {
    const { sid } = req.params;
    const db = await connectDB();
    
    await db.collection('pending_accounts').deleteOne({ sid });
    
    res.json({ ok: true, message: 'Account rejected successfully' });
  } catch (err) {
    console.error('Reject account error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/admin/pending/courses - Get pending course requests
router.get('/pending/courses', async (req, res) => {
  try {
    const db = await connectDB();
    const pendingCourses = await db.collection('pending_courses')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: pendingCourses });
  } catch (err) {
    console.error('Get pending courses error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/admin/pending/courses/:code/approve - Approve course
router.post('/pending/courses/:code/approve', async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();
    const db = await connectDB();
    
    // Get pending course
    const pendingCourse = await db.collection('pending_courses').findOne({ code: upperCode });
    if (!pendingCourse) {
      return res.status(404).json({ ok: false, error: 'Pending course not found' });
    }
    
    // Create approved course
    const course = {
      code: pendingCourse.code,
      title: pendingCourse.title,
      description: pendingCourse.description || '',
      materials: pendingCourse.materials || [],
      mock: pendingCourse.mock || '',
      timetable: pendingCourse.timetable || [],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: pendingCourse.requestedBy,
    };
    
    // Insert into courses collection
    await db.collection('courses').insertOne(course);
    
    // Remove from pending
    await db.collection('pending_courses').deleteOne({ code: upperCode });
    
    res.json({ 
      ok: true, 
      message: 'Course approved successfully',
      data: course 
    });
  } catch (err) {
    console.error('Approve course error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/admin/pending/courses/:code/reject - Reject course
router.post('/pending/courses/:code/reject', async (req, res) => {
  try {
    const { code } = req.params;
    const db = await connectDB();
    
    await db.collection('pending_courses').deleteOne({ code: code.toUpperCase() });
    
    res.json({ ok: true, message: 'Course rejected successfully' });
  } catch (err) {
    console.error('Reject course error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
  try {
    const db = await connectDB();
    const users = await db.collection('users')
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({ ok: true, data: users });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/admin/users/:sid - Update user
router.put('/users/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const updates = req.body;
    const db = await connectDB();
    
    // Remove sensitive fields
    delete updates.password;
    delete updates.token;
    
    await db.collection('users').updateOne(
      { sid },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    
    res.json({ ok: true, message: 'User updated successfully' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/admin/users/:sid/credits - Add credits to user
router.post('/users/:sid/credits', async (req, res) => {
  try {
    const { sid } = req.params;
    const { amount } = req.body;
    const db = await connectDB();
    
    if (!amount || amount < 1) {
      return res.status(400).json({ ok: false, error: 'Valid amount required' });
    }
    
    await db.collection('users').updateOne(
      { sid },
      { $inc: { credits: amount } }
    );
    
    const user = await db.collection('users').findOne({ sid });
    
    res.json({ 
      ok: true, 
      message: `Added ${amount} credits to user`,
      data: { credits: user.credits }
    });
  } catch (err) {
    console.error('Add credits error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/admin/stats - Get platform statistics
router.get('/stats', async (req, res) => {
  try {
    const db = await connectDB();
    
    const [
      totalUsers,
      totalCourses,
      pendingAccounts,
      pendingCourses,
      totalQuestionnaires,
      totalMaterials
    ] = await Promise.all([
      db.collection('users').countDocuments(),
      db.collection('courses').countDocuments(),
      db.collection('pending_accounts').countDocuments(),
      db.collection('pending_courses').countDocuments(),
      db.collection('questionnaires').countDocuments(),
      db.collection('courses').aggregate([
        { $unwind: '$materials' },
        { $count: 'count' }
      ]).toArray()
    ]);
    
    res.json({
      ok: true,
      data: {
        totalUsers,
        totalCourses,
        pendingAccounts,
        pendingCourses,
        totalQuestionnaires: totalQuestionnaires || 0,
        totalMaterials: totalMaterials[0]?.count || 0,
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// DELETE /api/admin/courses/:code - Delete course
router.delete('/courses/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const db = await connectDB();
    
    await db.collection('courses').deleteOne({ code: code.toUpperCase() });
    
    res.json({ ok: true, message: 'Course deleted successfully' });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// DELETE /api/admin/users/:sid - Delete user
router.delete('/users/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const db = await connectDB();
    
    // Don't allow deleting own admin account
    if (sid === req.user.sid) {
      return res.status(400).json({ ok: false, error: 'Cannot delete your own account' });
    }
    
    await db.collection('users').deleteOne({ sid });
    
    res.json({ ok: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
