import express from 'express';
import { ObjectId } from 'mongodb';
import { nanoid } from 'nanoid';
import connectDB from '../db/connection.js';
import {
  uploadToGridFS,
  downloadFromGridFS,
  getFileInfo,
  deleteFromGridFS,
  streamFileFromGridFS
} from '../db/gridfs.js';

const router = express.Router();

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
    console.error('Auth error:', err);
    res.status(500).json({ ok: false, error: 'Authentication failed' });
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

// POST /api/materials/course/:code - Upload material to course (using Base64)
router.post('/course/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;
    const { fileData, fileName, fileType, fileSize, name, description, tags } = req.body;
    
    if (!fileData || !fileName) {
      return res.status(400).json({ ok: false, error: 'File data and file name are required' });
    }
    
    const db = await connectDB();
    const upperCode = code.toUpperCase();
    
    // Check if course exists
    const course = await db.collection('courses').findOne({ code: upperCode });
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
      courseCode: upperCode,
      description: description || '',
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [],
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
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [],
      uploadedBy: req.user.sid,
      uploadedAt: new Date(),
      downloads: 0,
      courseCode: upperCode,
      courseName: course.title,
      storage: 'gridfs'
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
    res.status(500).json({ ok: false, error: 'Failed to upload material: ' + err.message });
  }
});

// GET /api/materials/download/:id - Download material
router.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    
    // Try to find by _id first, then by id field
    let material = await db.collection('materials').findOne({ _id: id });
    if (!material) {
      material = await db.collection('materials').findOne({ id: id });
    }
    
    if (!material) {
      return res.status(404).json({ ok: false, error: 'Material not found' });
    }
    
    // Get file info from GridFS
    const fileInfo = await getFileInfo(material.fileId);
    if (!fileInfo) {
      return res.status(404).json({ ok: false, error: 'File not found in storage' });
    }
    
    // Increment download count asynchronously
    Promise.all([
      db.collection('materials').updateOne(
        { _id: material._id || material.id },
        { $inc: { downloads: 1 } }
      ),
      db.collection('courses').updateOne(
        { code: material.courseCode, 'materials.id': material.id },
        { $inc: { 'materials.$.downloads': 1 } }
      )
    ]).catch(err => {
      console.error('Error updating download count:', err);
    });
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${material.originalName}"`);
    res.setHeader('Content-Type', material.mimetype);
    res.setHeader('Content-Length', fileInfo.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream file directly from GridFS to response
    await streamFileFromGridFS(material.fileId, res);
    
  } catch (err) {
    console.error('Download material error:', err);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: 'Failed to download material' });
    }
  }
});

// DELETE /api/materials/:id - Delete material
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    
    // Find material
    let material = await db.collection('materials').findOne({ _id: id });
    if (!material) {
      material = await db.collection('materials').findOne({ id: id });
    }
    
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
      { $pull: { materials: { id: material.id } } }
    );
    
    // Remove from materials collection
    await db.collection('materials').deleteOne({ 
      $or: [
        { _id: material._id || material.id },
        { id: material.id }
      ]
    });
    
    // Delete the file from GridFS
    if (material.fileId && material.storage === 'gridfs') {
      try {
        await deleteFromGridFS(material.fileId);
      } catch (deleteErr) {
        console.error('Error deleting file from GridFS:', deleteErr);
        // Continue even if GridFS deletion fails
      }
    }
    
    res.json({ 
      ok: true, 
      message: 'Material deleted successfully' 
    });
  } catch (err) {
    console.error('Delete material error:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete material' });
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
    
    // Remove fileId from response for security
    const sanitizedMaterials = materials.map(({ fileId, storage, ...rest }) => rest);
    
    res.json({ ok: true, data: sanitizedMaterials });
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
    
    // Sanitize response
    const sanitizedMaterials = materials.map(({ fileId, storage, ...rest }) => rest);
    
    res.json({ ok: true, data: sanitizedMaterials });
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
    
    // Sanitize response
    const sanitizedMaterials = materials.map(({ fileId, storage, ...rest }) => rest);
    
    res.json({ ok: true, data: sanitizedMaterials });
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
    
    // Sanitize most popular material
    let sanitizedPopular = null;
    if (mostPopularMaterial[0]) {
      const { fileId, storage, ...rest } = mostPopularMaterial[0];
      sanitizedPopular = rest;
    }
    
    res.json({
      ok: true,
      data: {
        totalMaterials,
        totalDownloads: totalDownloads[0]?.total || 0,
        mostPopularMaterial: sanitizedPopular,
        topUploaders,
      }
    });
  } catch (err) {
    console.error('Get materials stats error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// PUT /api/materials/:id - Update material metadata
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tags } = req.body;
    const db = await connectDB();
    
    // Find material
    let material = await db.collection('materials').findOne({ _id: id });
    if (!material) {
      material = await db.collection('materials').findOne({ id: id });
    }
    
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
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (tags !== undefined) {
      updates.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    }
    
    updates.updatedAt = new Date();
    
    // Update in materials collection
    await db.collection('materials').updateOne(
      { _id: material._id || material.id },
      { $set: updates }
    );
    
    // Update in course materials array
    await db.collection('courses').updateOne(
      { code: material.courseCode, 'materials.id': material.id },
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
    res.status(500).json({ ok: false, error: 'Failed to update material' });
  }
});

// GET /api/materials/preview/:id - Get material info without downloading
router.get('/preview/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await connectDB();
    
    // Find material
    let material = await db.collection('materials').findOne({ _id: id });
    if (!material) {
      material = await db.collection('materials').findOne({ id: id });
    }
    
    if (!material) {
      return res.status(404).json({ ok: false, error: 'Material not found' });
    }
    
    // Return material info (without file data)
    const { fileId, storage, ...materialInfo } = material;
    
    res.json({ 
      ok: true, 
      data: materialInfo 
    });
  } catch (err) {
    console.error('Preview material error:', err);
    res.status(500).json({ ok: false, error: 'Failed to get material info' });
  }
});

export default router;