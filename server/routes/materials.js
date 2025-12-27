import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { promisify } from 'util';

dotenv.config();

const router = express.Router();

// Promisify fs functions
const unlinkAsync = promisify(fs.unlink);

// Multer setup for material uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/materials/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${nanoid(10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, Word, Excel, PowerPoint, images, text'));
    }
  },
});

// Connect to MongoDB
const connectDB = async () => {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  return client.db();
};

// Middleware to check authentication
const requireAuth = async (req, res, next) => {
  try {
    const sid = req.headers['x-sid'] || req.query.sid;
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

// GET /api/materials/course/:code - Get materials for a course
router.get('/course/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const db = await connectDB();
    
    const course = await db.collection('courses').findOne({ 
      code: code.toUpperCase() 
    });
    
    if (!course) {
      return res.status(404).json({ ok: false, error: 'Course not found' });
    }
    
    res.json({ 
      ok: true, 
      data: course.materials || [] 
    });
  } catch (err) {
    console.error('Get course materials error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/materials/course/:code - Upload material to course
router.post('/course/:code', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { code } = req.params;
    const { name, description, tags } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'File required' });
    }
    
    const db = await connectDB();
    const upperCode = code.toUpperCase();
    
    // Check if course exists
    const course = await db.collection('courses').findOne({ code: upperCode });
    if (!course) {
      // Clean up uploaded file
      await unlinkAsync(req.file.path);
      return res.status(404).json({ ok: false, error: 'Course not found' });
    }
    
    // Check if user is admin or instructor (for now, allow all authenticated users)
    const isAdmin = req.user.role === 'admin';
    const isInstructor = course.instructors?.includes(req.user.sid);
    
    if (!isAdmin && !isInstructor) {
      // For now, allow any user to upload materials
      // In production, you might want to restrict this
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
      mimetype: req.file.mimetype,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      uploadedBy: req.user.sid,
      uploadedAt: new Date(),
      downloads: 0,
      courseCode: upperCode,
      courseName: course.title,
    };
    
    // Add material to course
    await db.collection('courses').updateOne(
      { code: upperCode },
      { $push: { materials: material } }
    );
    
    // Also store in separate materials collection for easier searching
    await db.collection('materials').insertOne({
      ...material,
      _id: material.id,
    });
    
    res.json({ 
      ok: true, 
      data: material,
      message: 'Material uploaded successfully' 
    });
  } catch (err) {
    console.error('Upload material error:', err);
    
    // Clean up file if there was an error
    if (req.file) {
      try {
        await unlinkAsync(req.file.path);
      } catch (cleanupErr) {
        console.error('File cleanup error:', cleanupErr);
      }
    }
    
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/materials/download/:materialId - Download material
router.get('/download/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const db = await connectDB();
    
    // Find material in separate collection
    const material = await db.collection('materials').findOne({ _id: materialId });
    
    if (!material) {
      return res.status(404).json({ ok: false, error: 'Material not found' });
    }
    
    const filePath = path.join(process.cwd(), 'uploads', 'materials', material.filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'File not found on server' });
    }
    
    // Increment download count
    await db.collection('materials').updateOne(
      { _id: materialId },
      { $inc: { downloads: 1 } }
    );
    
    // Also update in course materials array
    await db.collection('courses').updateOne(
      { code: material.courseCode, 'materials.id': materialId },
      { $inc: { 'materials.$.downloads': 1 } }
    );
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${material.originalName}"`);
    res.setHeader('Content-Type', material.mimetype);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('File stream error:', err);
      res.status(500).json({ ok: false, error: 'Error streaming file' });
    });
  } catch (err) {
    console.error('Download material error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// DELETE /api/materials/:materialId - Delete material
router.delete('/:materialId', requireAuth, async (req, res) => {
  try {
    const { materialId } = req.params;
    const db = await connectDB();
    
    // Find material
    const material = await db.collection('materials').findOne({ _id: materialId });
    
    if (!material) {
      return res.status(404).json({ ok: false, error: 'Material not found' });
    }
    
    // Check permissions (admin or uploader)
    const isAdmin = req.user.role === 'admin';
    const isUploader = material.uploadedBy === req.user.sid;
    
    if (!isAdmin && !isUploader) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Not authorized to delete this material' 
      });
    }
    
    // Remove from course materials array
    await db.collection('courses').updateOne(
      { code: material.courseCode },
      { $pull: { materials: { id: materialId } } }
    );
    
    // Remove from materials collection
    await db.collection('materials').deleteOne({ _id: materialId });
    
    // Delete the actual file
    const filePath = path.join(process.cwd(), 'uploads', 'materials', material.filename);
    if (fs.existsSync(filePath)) {
      await unlinkAsync(filePath);
    }
    
    res.json({ 
      ok: true, 
      message: 'Material deleted successfully' 
    });
  } catch (err) {
    console.error('Delete material error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/materials/search - Search materials
router.get('/search', async (req, res) => {
  try {
    const { q, course, tag, uploader, sortBy = 'uploadedAt', sortOrder = 'desc' } = req.query;
    const db = await connectDB();
    
    const filter = {};
    
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { courseName: { $regex: q, $options: 'i' } },
      ];
    }
    
    if (course) {
      filter.courseCode = course.toUpperCase();
    }
    
    if (tag) {
      filter.tags = { $in: [tag] };
    }
    
    if (uploader) {
      filter.uploadedBy = uploader;
    }
    
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const materials = await db.collection('materials')
      .find(filter)
      .sort(sortOptions)
      .toArray();
    
    res.json({ ok: true, data: materials });
  } catch (err) {
    console.error('Search materials error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/materials/popular - Get popular materials
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const db = await connectDB();
    
    const materials = await db.collection('materials')
      .find({})
      .sort({ downloads: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json({ ok: true, data: materials });
  } catch (err) {
    console.error('Get popular materials error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/materials/recent - Get recent materials
router.get('/recent', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const db = await connectDB();
    
    const materials = await db.collection('materials')
      .find({})
      .sort({ uploadedAt: -1 })
      .limit(parseInt(limit))
      .toArray();
    
    res.json({ ok: true, data: materials });
  } catch (err) {
    console.error('Get recent materials error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/materials/stats - Get material statistics
router.get('/stats', async (req, res) => {
  try {
    const db = await connectDB();
    
    const [
      totalMaterials,
      totalDownloads,
      mostPopularMaterial,
      topUploaders
    ] = await Promise.all([
      db.collection('materials').countDocuments(),
      db.collection('materials').aggregate([
        { $group: { _id: null, total: { $sum: '$downloads' } } }
      ]).toArray(),
      db.collection('materials')
        .find({})
        .sort({ downloads: -1 })
        .limit(1)
        .toArray(),
      db.collection('materials').aggregate([
        { $group: { 
          _id: '$uploadedBy', 
          count: { $sum: 1 },
          totalDownloads: { $sum: '$downloads' }
        }},
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]).toArray()
    ]);
    
    res.json({
      ok: true,
      data: {
        totalMaterials,
        totalDownloads: totalDownloads[0]?.total || 0,
        mostPopularMaterial: mostPopularMaterial[0] || null,
        topUploaders,
      }
    });
  } catch (err) {
    console.error('Get materials stats error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/materials/:materialId - Update material metadata
router.put('/:materialId', requireAuth, async (req, res) => {
  try {
    const { materialId } = req.params;
    const { name, description, tags } = req.body;
    const db = await connectDB();
    
    // Find material
    const material = await db.collection('materials').findOne({ _id: materialId });
    
    if (!material) {
      return res.status(404).json({ ok: false, error: 'Material not found' });
    }
    
    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isUploader = material.uploadedBy === req.user.sid;
    
    if (!isAdmin && !isUploader) {
      return res.status(403).json({ 
        ok: false, 
        error: 'Not authorized to update this material' 
      });
    }
    
    const updates = {};
    
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) {
      updates.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    }
    
    updates.updatedAt = new Date();
    
    // Update in materials collection
    await db.collection('materials').updateOne(
      { _id: materialId },
      { $set: updates }
    );
    
    // Update in course materials array
    await db.collection('courses').updateOne(
      { code: material.courseCode, 'materials.id': materialId },
      { $set: Object.fromEntries(
        Object.entries(updates).map(([key, value]) => [`materials.$.${key}`, value])
      ) }
    );
    
    res.json({ 
      ok: true, 
      message: 'Material updated successfully' 
    });
  } catch (err) {
    console.error('Update material error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Update the download endpoint in materials.js
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    
    // Try to find by _id first (ObjectId)
    let material;
    try {
      material = await db.collection('materials').findOne({ 
        _id: id 
      });
    } catch (err) {
      // If not ObjectId, try as string id
      material = await db.collection('materials').findOne({ 
        id: id 
      });
    }
    
    if (!material) {
      // Try to find in courses materials array
      const course = await db.collection('courses').findOne({
        'materials.id': id
      });
      
      if (course) {
        material = course.materials.find(m => m.id === id);
      }
    }
    
    if (!material) {
      return res.status(404).json({ ok: false, error: 'Material not found' });
    }
    
    // Increment download count
    await db.collection('materials').updateOne(
      { _id: material._id || material.id },
      { $inc: { downloads: 1 } }
    );
    
    const filePath = path.join(process.cwd(), 'uploads', 'materials', material.filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'File not found on server' });
    }
    
    res.download(filePath, material.originalName);
  } catch (err) {
    console.error('Download material error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
