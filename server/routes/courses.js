import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';

dotenv.config();

const router = express.Router();

// Multer setup for course materials
const materialUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/materials/');
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}_${nanoid(10)}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Connect to MongoDB
const connectDB = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  return client.db();
};

// GET /api/courses - Get all courses
router.get('/', async (req, res) => {
  try {
    const db = await connectDB();
    const courses = await db.collection('courses').find({}).toArray();
    
    // Convert to map format { code: title }
    const courseMap = {};
    courses.forEach(course => {
      courseMap[course.code] = course.title;
    });
    
    res.json({ ok: true, data: courseMap });
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/courses/:code - Get specific course
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const upperCode = code.toUpperCase();
    
    const db = await connectDB();
    
    // Try to get from approved courses first
    let course = await db.collection('courses').findOne({ code: upperCode });
    
    // If not found, try pending courses
    if (!course) {
      course = await db.collection('pending_courses').findOne({ code: upperCode });
    }
    
    if (!course) {
      return res.status(404).json({ 
        ok: false, 
        error: 'Course not found',
        data: { 
          description: '', 
          materials: [], 
          mock: '', 
          timetable: [] 
        }
      });
    }
    
    res.json({ 
      ok: true, 
      data: {
        code: course.code,
        title: course.title,
        description: course.description || '',
        materials: course.materials || [],
        mock: course.mock || '',
        timetable: course.timetable || [],
      }
    });
  } catch (err) {
    console.error('Get course error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/courses/request - Request new course
router.post('/request', async (req, res) => {
  try {
    const { code, title } = req.body;
    const sid = req.headers['x-sid'] || req.query.sid;
    
    if (!code || !title) {
      return res.status(400).json({ ok: false, error: 'Course code and title required' });
    }
    
    if (!sid) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const upperCode = code.toUpperCase().trim();
    const db = await connectDB();
    
    // Check if course already exists or pending
    const existingCourse = await db.collection('courses').findOne({ code: upperCode });
    const pendingCourse = await db.collection('pending_courses').findOne({ code: upperCode });
    
    if (existingCourse || pendingCourse) {
      return res.status(409).json({ 
        ok: false, 
        error: 'Course already exists or pending approval' 
      });
    }
    
    // Create pending course request
    const courseRequest = {
      code: upperCode,
      title: title.trim(),
      requestedBy: sid,
      description: '',
      materials: [],
      mock: '',
      timetable: [],
      status: 'pending',
      createdAt: new Date(),
    };
    
    await db.collection('pending_courses').insertOne(courseRequest);
    
    res.json({ 
      ok: true, 
      message: 'Course request submitted. Awaiting admin approval.' 
    });
  } catch (err) {
    console.error('Course request error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/courses/:code/materials - Upload course material
router.post('/:code/materials', materialUpload.single('file'), async (req, res) => {
  try {
    const { code } = req.params;
    const { name, description } = req.body;
    const sid = req.headers['x-sid'] || req.query.sid;
    
    if (!sid) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'File required' });
    }
    
    const db = await connectDB();
    const upperCode = code.toUpperCase();
    
    // Check if user has permission (admin or course creator)
    const user = await db.collection('users').findOne({ sid });
    const isAdmin = user?.role === 'admin';
    
    const course = await db.collection('courses').findOne({ code: upperCode });
    if (!course && !isAdmin) {
      return res.status(403).json({ ok: false, error: 'Course not found or no permission' });
    }
    
    // Create material object
    const material = {
      id: nanoid(),
      name: name || req.file.originalname,
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/materials/${req.file.filename}`,
      size: req.file.size,
      uploadedBy: sid,
      uploadedAt: new Date(),
      downloads: 0,
    };
    
    // Add material to course
    await db.collection('courses').updateOne(
      { code: upperCode },
      { $push: { materials: material } }
    );
    
    res.json({ 
      ok: true, 
      data: material,
      message: 'Material uploaded successfully' 
    });
  } catch (err) {
    console.error('Upload material error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/courses/:code/materials/:materialId/download - Download material
router.get('/:code/materials/:materialId/download', async (req, res) => {
  try {
    const { code, materialId } = req.params;
    const db = await connectDB();
    
    const course = await db.collection('courses').findOne({ code: code.toUpperCase() });
    if (!course) {
      return res.status(404).json({ ok: false, error: 'Course not found' });
    }
    
    const material = course.materials?.find(m => m.id === materialId);
    if (!material) {
      return res.status(404).json({ ok: false, error: 'Material not found' });
    }
    
    // Increment download count
    await db.collection('courses').updateOne(
      { code: code.toUpperCase(), 'materials.id': materialId },
      { $inc: { 'materials.$.downloads': 1 } }
    );
    
    const filePath = path.join(process.cwd(), 'uploads', 'materials', material.filename);
    res.download(filePath, material.originalName);
  } catch (err) {
    console.error('Download material error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/courses/:code - Update course details
router.put('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const updates = req.body;
    const sid = req.headers['x-sid'] || req.query.sid;
    
    if (!sid) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    
    const db = await connectDB();
    
    // Check if user is admin
    const user = await db.collection('users').findOne({ sid });
    if (user?.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required' });
    }
    
    const upperCode = code.toUpperCase();
    const course = await db.collection('courses').findOne({ code: upperCode });
    
    if (!course) {
      return res.status(404).json({ ok: false, error: 'Course not found' });
    }
    
    // Update course
    await db.collection('courses').updateOne(
      { code: upperCode },
      { $set: { ...updates, updatedAt: new Date() } }
    );
    
    res.json({ ok: true, message: 'Course updated successfully' });
  } catch (err) {
    console.error('Update course error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/courses/search/:query - Search courses
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const db = await connectDB();
    
    const courses = await db.collection('courses').find({
      $or: [
        { code: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      ]
    }).toArray();
    
    res.json({ ok: true, data: courses });
  } catch (err) {
    console.error('Search courses error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/courses/timetable/all - Get all timetable data
router.get('/timetable/all', async (req, res) => {
  try {
    const db = await connectDB();
    const data = await db.collection('pending_courses').find({}).toArray();
    const classes = [];

    data.forEach(c => {
      (c.timetable || []).forEach(r => {
        const [start, end] = (r.time || '').split('-').map(s => s.trim());
        if (!start || !end) return;

        const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
          .indexOf(r.day?.trim() || '');

        if (weekday === -1) return;

        classes.push({
          code: c.code,
          name: c.title,
          classNo: r.classNo || '',
          startTime: start,
          endTime: end,
          weekday,
          room: r.room || '',
        });
      });
    });

    res.json({ ok: true, data: classes });
  } catch (err) {
    console.error('Get timetable error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
