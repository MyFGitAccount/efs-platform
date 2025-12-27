import express from 'express';
import multer from 'multer';
import path from 'path';
import { nanoid } from 'nanoid';
import fs from 'fs';
import { MongoClient } from 'mongodb';
//import dotenv from 'dotenv';

//dotenv.config();

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${nanoid(10)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /image\/(jpeg|jpg|png|gif)/;
    if (allowedTypes.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
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

// POST /api/upload/profile-photo - Upload profile photo
router.post('/profile-photo', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const db = await connectDB();
    
    // Update user with photo path
    await db.collection('users').updateOne(
      { sid: req.user.sid },
      { 
        $set: { 
          photo_path: `/uploads/${req.file.filename}`,
          updatedAt: new Date()
        } 
      }
    );

    res.json({
      ok: true,
      message: 'Profile photo uploaded successfully',
      photoUrl: `/uploads/${req.file.filename}`
    });
  } catch (err) {
    console.error('Upload profile photo error:', err);
    
    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('File cleanup error:', cleanupErr);
      }
    }
    
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/upload/material - Upload course material
router.post('/material', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const { courseCode, name, description } = req.body;
    
    if (!courseCode) {
      // Clean up file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ ok: false, error: 'Course code required' });
    }

    const db = await connectDB();
    
    // Create material object
    const material = {
      id: nanoid(),
      name: name || req.file.originalname,
      description: description || '',
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedBy: req.user.sid,
      uploadedAt: new Date(),
      downloads: 0,
      courseCode: courseCode.toUpperCase(),
    };

    // Add material to materials collection
    await db.collection('materials').insertOne(material);
    
    // Also add to course if it exists
    const course = await db.collection('courses').findOne({ 
      code: courseCode.toUpperCase() 
    });
    
    if (course) {
      await db.collection('courses').updateOne(
        { code: courseCode.toUpperCase() },
        { $push: { materials: material } }
      );
    }

    res.json({
      ok: true,
      message: 'Material uploaded successfully',
      data: material
    });
  } catch (err) {
    console.error('Upload material error:', err);
    
    // Clean up uploaded file
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error('File cleanup error:', cleanupErr);
      }
    }
    
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
