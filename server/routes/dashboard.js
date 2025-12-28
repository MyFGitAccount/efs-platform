//import express from 'express';
//import dotenv from 'dotenv';
//import connectDB from '../db/connection.js';
const express = require('express');
const connectDB = require('../db/connection.js');
//dotenv.config();

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
    res.status(500).json({ ok: false, error: err.message });
  }
};

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const sid = req.user.sid;
    
    // Get counts from different collections
    const [
      totalCourses,
      totalGroupRequests,
      totalQuestionnaires,
      totalMaterials,
      myGroupRequests,
      myQuestionnaires,
      recentActivities
    ] = await Promise.all([
      // Total courses in the system
      db.collection('courses').countDocuments(),
      
      // Total group requests
      db.collection('group_requests').countDocuments(),
      
      // Total questionnaires
      db.collection('questionnaires').countDocuments({ status: 'active' }),
      
      // Total materials
      db.collection('materials').countDocuments(),
      
      // My group requests
      db.collection('group_requests').countDocuments({ sid }),
      
      // My questionnaires
      db.collection('questionnaires').countDocuments({ creatorSid: sid }),
      
      // Recent activities (last 7 days)
      db.collection('group_requests').find({
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).limit(5).toArray()
    ]);
    
    res.json({
      ok: true,
      data: {
        counts: {
          courses: totalCourses,
          groupRequests: totalGroupRequests,
          questionnaires: totalQuestionnaires,
          materials: totalMaterials,
          myGroupRequests,
          myQuestionnaires,
        },
        user: {
          sid: req.user.sid,
          email: req.user.email,
          credits: req.user.credits || 0,
          major: req.user.major,
          year: req.user.year_of_study,
        },
        recentActivities: recentActivities.map(activity => ({
          type: 'group_request',
          title: `New group request by ${activity.sid}`,
          description: activity.major,
          time: activity.createdAt,
        }))
      }
    });
  } catch (err) {
    console.error('Get dashboard stats error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/dashboard/recent-courses - Get recent courses
router.get('/recent-courses', async (req, res) => {
  try {
    const db = await connectDB();
    
    const recentCourses = await db.collection('courses')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();
    
    const formattedCourses = recentCourses.map(course => ({
      code: course.code,
      title: course.title,
      description: course.description?.substring(0, 100) + '...',
      materialsCount: course.materials?.length || 0,
    }));
    
    res.json({ ok: true, data: formattedCourses });
  } catch (err) {
    console.error('Get recent courses error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/dashboard/quick-stats - Quick statistics for dashboard cards
router.get('/quick-stats', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const sid = req.user.sid;
    
    const [
      userCourses,
      userMaterials,
      pendingApprovals,
      upcomingEvents
    ] = await Promise.all([
      // Courses user is enrolled in (simplified - based on materials uploaded)
      db.collection('materials').distinct('courseCode', { uploadedBy: sid }),
      
      // Materials uploaded by user
      db.collection('materials').countDocuments({ uploadedBy: sid }),
      
      // Pending approvals (for admin)
      req.user.role === 'admin' 
        ? db.collection('pending_accounts').countDocuments()
        : Promise.resolve(0),
      
      // Upcoming timetable events (simplified)
      db.collection('courses').aggregate([
        { $unwind: '$timetable' },
        { $limit: 5 }
      ]).toArray()
    ]);
    
    res.json({
      ok: true,
      data: {
        enrolledCourses: userCourses.length,
        uploadedMaterials: userMaterials,
        pendingApprovals,
        upcomingEvents: upcomingEvents.slice(0, 3).map(event => ({
          course: event.code,
          time: event.timetable?.time || 'TBA',
          day: event.timetable?.day || 'TBA',
        }))
      }
    });
  } catch (err) {
    console.error('Get quick stats error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

module.exports = router;
//export default router;
