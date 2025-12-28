import express from 'express';
import { nanoid } from 'nanoid';
import connectDB from '../db/connection.js';
import {
  uploadToGridFS,
  deleteFromGridFS,
  getFileInfo,
  downloadFromGridFS
} from '../db/gridfs.js';

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
    console.error('Auth error:', err);
    res.status(500).json({ ok: false, error: 'Authentication failed' });
  }
};

// POST /api/upload/profile-photo - Upload profile photo (Base64)
router.post('/profile-photo', requireAuth, async (req, res) => {
  try {
    const { photoData, fileName = 'profile.jpg', fileType = 'image/jpeg' } = req.body;
    
    if (!photoData) {
      return res.status(400).json({ ok: false, error: 'No photo data provided' });
    }

    const db = await connectDB();
    
    // Delete old profile photo if exists
    if (req.user.photoFileId) {
      try {
        await deleteFromGridFS(req.user.photoFileId);
      } catch (err) {
        console.error('Error deleting old photo:', err);
      }
    }
    
    // Convert Base64 to buffer
    let fileBuffer;
    try {
      const base64Data = photoData.includes('base64,') 
        ? photoData.split(',')[1] 
        : photoData;
      fileBuffer = Buffer.from(base64Data, 'base64');
    } catch (parseErr) {
      return res.status(400).json({ ok: false, error: 'Invalid photo data format' });
    }
    
    // Upload to GridFS
    const gridFSResult = await uploadToGridFS(fileBuffer, fileName, {
      originalName: fileName,
      mimetype: fileType || 'image/jpeg',
      size: fileBuffer.length,
      uploadedBy: req.user.sid,
      uploadedAt: new Date(),
      type: 'profile_photo'
    });
    
    // Update user with photo file ID
    await db.collection('users').updateOne(
      { sid: req.user.sid },
      { 
        $set: { 
          photoFileId: gridFSResult.fileId,
          photoUrl: `/api/upload/profile-photo/${gridFSResult.fileId}`,
          updatedAt: new Date()
        } 
      }
    );

    res.json({
      ok: true,
      message: 'Profile photo uploaded successfully',
      photoUrl: `/api/upload/profile-photo/${gridFSResult.fileId}`,
      fileId: gridFSResult.fileId
    });
  } catch (err) {
    console.error('Upload profile photo error:', err);
    res.status(500).json({ ok: false, error: 'Failed to upload profile photo' });
  }
});

// GET /api/upload/profile-photo/:fileId - Get profile photo
router.get('/profile-photo/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const db = await connectDB();
    
    // Find user with this photo file ID
    const user = await db.collection('users').findOne({ 
      photoFileId: fileId 
    });
    
    if (!user) {
      // Try to get file info directly
      const fileInfo = await getFileInfo(fileId);
      if (!fileInfo || fileInfo.metadata?.type !== 'profile_photo') {
        return res.status(404).send('Profile photo not found');
      }
    }
    
    // Get file from GridFS
    const fileBuffer = await downloadFromGridFS(fileId);
    
    // Get file info for content type
    const fileInfo = await getFileInfo(fileId);
    const contentType = fileInfo?.metadata?.mimetype || 'image/jpeg';
    
    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    res.send(fileBuffer);
  } catch (err) {
    console.error('Get profile photo error:', err);
    res.status(404).send('Profile photo not found');
  }
});

// GET /api/upload/profile-photo/user/:sid - Get user's profile photo
router.get('/profile-photo/user/:sid', async (req, res) => {
  try {
    const { sid } = req.params;
    const db = await connectDB();
    
    // Find user
    const user = await db.collection('users').findOne({ sid });
    
    if (!user || !user.photoFileId) {
      // Return default avatar or 404
      return res.status(404).json({ ok: false, error: 'Profile photo not found' });
    }
    
    // Redirect to the photo endpoint
    res.redirect(`/api/upload/profile-photo/${user.photoFileId}`);
  } catch (err) {
    console.error('Get user profile photo error:', err);
    res.status(500).json({ ok: false, error: 'Failed to get profile photo' });
  }
});

// POST /api/upload/material - Upload course material (Base64) - DEPRECATED: Use /api/materials/course/:code instead
router.post('/material', requireAuth, async (req, res) => {
  try {
    const { fileData, fileName, fileType, fileSize, courseCode, name, description } = req.body;
    
    if (!fileData || !fileName || !courseCode) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const db = await connectDB();
    
    // Check if course exists
    const course = await db.collection('courses').findOne({ 
      code: courseCode.toUpperCase() 
    });
    
    if (!course) {
      return res.status(404).json({ ok: false, error: 'Course not found' });
    }
    
    // Convert Base64 to buffer
    let fileBuffer;
    try {
      const base64Data = fileData.includes('base64,') 
        ? fileData.split(',')[1] 
        : fileData;
      fileBuffer = Buffer.from(base64Data, 'base64');
    } catch (parseErr) {
      return res.status(400).json({ ok: false, error: 'Invalid file data format' });
    }
    
    // Upload to GridFS
    const gridFSResult = await uploadToGridFS(fileBuffer, fileName, {
      originalName: fileName,
      mimetype: fileType || 'application/octet-stream',
      size: parseInt(fileSize) || fileBuffer.length,
      uploadedBy: req.user.sid,
      uploadedAt: new Date(),
      courseCode: courseCode.toUpperCase(),
      description: description || '',
      type: 'course_material'
    });

    // Create material object
    const material = {
      id: nanoid(),
      name: name || fileName,
      description: description || '',
      fileName: fileName,
      originalName: fileName,
      fileId: gridFSResult.fileId,
      size: parseInt(fileSize) || fileBuffer.length,
      mimetype: fileType || 'application/octet-stream',
      uploadedBy: req.user.sid,
      uploadedAt: new Date(),
      downloads: 0,
      courseCode: courseCode.toUpperCase(),
      courseName: course.title,
      storage: 'gridfs'
    };

    // Add material to materials collection
    await db.collection('materials').insertOne({
      ...material,
      _id: material.id,
    });
    
    // Also add to course
    await db.collection('courses').updateOne(
      { code: courseCode.toUpperCase() },
      { $push: { materials: material } }
    );

    res.json({
      ok: true,
      message: 'Material uploaded successfully',
      data: material
    });
  } catch (err) {
    console.error('Upload material error:', err);
    res.status(500).json({ ok: false, error: 'Failed to upload material' });
  }
});

// DELETE /api/upload/profile-photo - Delete user's profile photo
router.delete('/profile-photo', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    
    if (!req.user.photoFileId) {
      return res.status(404).json({ ok: false, error: 'No profile photo found' });
    }
    
    // Delete from GridFS
    await deleteFromGridFS(req.user.photoFileId);
    
    // Update user
    await db.collection('users').updateOne(
      { sid: req.user.sid },
      { 
        $set: { 
          photoFileId: null,
          photoUrl: null,
          updatedAt: new Date()
        } 
      }
    );
    
    res.json({
      ok: true,
      message: 'Profile photo deleted successfully'
    });
  } catch (err) {
    console.error('Delete profile photo error:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete profile photo' });
  }
});

export default router;