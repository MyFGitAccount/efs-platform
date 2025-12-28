import express from 'express';
//import dotenv from 'dotenv';
import connectDB from '../db/connection.js';

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
    console.error('Auth error:', err);
    res.status(500).json({ ok: false, error: 'Authentication failed' });
  }
};

// GET /api/dashboard/summary - Get comprehensive dashboard summary
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const sid = req.user.sid;
    
    // Get all data in parallel for better performance
    const [
      userInfo,
      courses,
      groupRequests,
      questionnaires,
      materials,
      recentMaterials
    ] = await Promise.all([
      // User information (safe fields only)
      Promise.resolve({
        sid: req.user.sid,
        email: req.user.email,
        role: req.user.role || 'user',
        credits: req.user.credits || 0,
        major: req.user.major,
        year_of_study: req.user.year_of_study,
        about_me: req.user.about_me,
        photoUrl: req.user.photoUrl,
        createdAt: req.user.createdAt
      }),
      
      // Get all courses
      db.collection('courses').find({}).toArray(),
      
      // Get group requests count (all and user-specific)
      Promise.all([
        db.collection('group_requests').countDocuments(),
        db.collection('group_requests').countDocuments({ sid })
      ]),
      
      // Get questionnaires count (all and user-specific)
      Promise.all([
        db.collection('questionnaires').countDocuments({ status: 'active' }),
        db.collection('questionnaires').countDocuments({ creatorSid: sid })
      ]),
      
      // Get materials stats
      Promise.all([
        db.collection('materials').countDocuments(),
        db.collection('materials').countDocuments({ uploadedBy: sid }),
        db.collection('materials').aggregate([
          { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } }
        ]).toArray()
      ]),
      
      // Get recent materials for recent courses
      db.collection('materials')
        .find({})
        .sort({ uploadedAt: -1 })
        .limit(10)
        .toArray()
    ]);

    // Process courses data
    const coursesCount = courses.length;
    const enrolledCourses = courses.filter(course => 
      course.materials?.some(material => material.uploadedBy === sid) ||
      course.instructors?.includes(sid)
    ).length;

    // Process group requests data
    const [totalGroupRequests, myGroupRequests] = groupRequests;

    // Process questionnaires data
    const [totalQuestionnaires, myQuestionnaires] = questionnaires;

    // Process materials data
    const [totalMaterials, myMaterials, downloadStats] = materials;
    const totalDownloads = downloadStats[0]?.totalDownloads || 0;

    // Get unique recent courses from materials
    const recentCoursesMap = {};
    recentMaterials.forEach(material => {
      if (material.courseCode && !recentCoursesMap[material.courseCode]) {
        const course = courses.find(c => c.code === material.courseCode);
        if (course) {
          recentCoursesMap[material.courseCode] = {
            code: course.code,
            title: course.title || `Course ${course.code}`,
            description: course.description?.substring(0, 100) + (course.description?.length > 100 ? '...' : ''),
            materialsCount: materials.filter(m => m.courseCode === course.code).length,
            lastUpdated: material.uploadedAt
          };
        }
      }
    });
    const recentCourses = Object.values(recentCoursesMap).slice(0, 5);

    // Get user activity summary
    const userActivity = {
      lastLogin: req.user.lastLogin || new Date(),
      materialsUploaded: myMaterials,
      groupRequests: myGroupRequests,
      questionnairesCreated: myQuestionnaires,
      totalDownloads: totalDownloads
    };

    // Get pending approvals (for admin)
    let pendingApprovals = 0;
    if (req.user.role === 'admin') {
      pendingApprovals = await db.collection('pending_accounts').countDocuments();
    }

    res.json({
      ok: true,
      data: {
        user: userInfo,
        stats: {
          courses: {
            total: coursesCount,
            enrolled: enrolledCourses,
            recent: recentCourses.length
          },
          groupRequests: {
            total: totalGroupRequests,
            myRequests: myGroupRequests
          },
          questionnaires: {
            total: totalQuestionnaires,
            myQuestionnaires: myQuestionnaires
          },
          materials: {
            total: totalMaterials,
            myUploads: myMaterials,
            totalDownloads: totalDownloads
          },
          pendingApprovals: pendingApprovals
        },
        recentCourses: recentCourses,
        userActivity: userActivity,
        quickActions: [
          {
            id: 'timetable',
            title: 'Timetable Planner',
            description: 'Organize your weekly schedule',
            icon: 'calendar',
            link: '/calendar',
            color: '#1890ff',
            available: true
          },
          {
            id: 'group',
            title: 'Group Formation',
            description: 'Find study partners',
            icon: 'team',
            link: '/group-formation',
            color: '#52c41a',
            available: true
          },
          {
            id: 'questionnaire',
            title: 'Questionnaire Exchange',
            description: 'Share and fill surveys',
            icon: 'file-text',
            link: '/questionnaire',
            color: '#722ed1',
            available: true
          },
          {
            id: 'materials',
            title: 'Learning Materials',
            description: 'Access course resources',
            icon: 'file',
            link: '/materials',
            color: '#fa8c16',
            available: true
          },
          {
            id: 'profile',
            title: 'My Profile',
            description: 'Update personal information',
            icon: 'user',
            link: '/profile',
            color: '#13c2c2',
            available: true
          },
          {
            id: 'admin',
            title: 'Admin Panel',
            description: 'Manage system settings',
            icon: 'setting',
            link: '/admin',
            color: '#f5222d',
            available: req.user.role === 'admin'
          }
        ]
      }
    });
  } catch (err) {
    console.error('Get dashboard summary error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load dashboard data' });
  }
});

// GET /api/dashboard/user-info - Get user information
router.get('/user-info', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    
    // Return safe user data
    const { password, token, ...safeUser } = req.user;
    
    res.json({
      ok: true,
      data: safeUser
    });
  } catch (err) {
    console.error('Get user info error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load user information' });
  }
});

// GET /api/dashboard/courses - Get user's courses
router.get('/courses', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const sid = req.user.sid;
    
    // Get all courses
    const courses = await db.collection('courses').find({}).toArray();
    
    // Filter courses where user has uploaded materials or is instructor
    const userCourses = courses.filter(course => 
      course.materials?.some(material => material.uploadedBy === sid) ||
      course.instructors?.includes(sid)
    ).map(course => ({
      code: course.code,
      title: course.title,
      description: course.description,
      materialsCount: course.materials?.length || 0,
      lastMaterial: course.materials?.slice(-1)[0]?.uploadedAt,
      isInstructor: course.instructors?.includes(sid) || false
    }));
    
    // Get recent courses (all courses sorted by creation)
    const recentCourses = courses
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(course => ({
        code: course.code,
        title: course.title,
        description: course.description?.substring(0, 100) + '...',
        materialsCount: course.materials?.length || 0
      }));
    
    res.json({
      ok: true,
      data: {
        userCourses: userCourses,
        recentCourses: recentCourses,
        totalCourses: courses.length
      }
    });
  } catch (err) {
    console.error('Get dashboard courses error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load courses data' });
  }
});

// GET /api/dashboard/materials-stats - Get materials statistics
router.get('/materials-stats', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const sid = req.user.sid;
    
    const [totalMaterials, myMaterials, popularMaterials, recentMaterials] = await Promise.all([
      db.collection('materials').countDocuments(),
      db.collection('materials').countDocuments({ uploadedBy: sid }),
      db.collection('materials')
        .find({})
        .sort({ downloads: -1 })
        .limit(5)
        .toArray(),
      db.collection('materials')
        .find({})
        .sort({ uploadedAt: -1 })
        .limit(5)
        .toArray()
    ]);
    
    // Calculate total downloads
    const downloadStats = await db.collection('materials').aggregate([
      { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } }
    ]).toArray();
    
    const totalDownloads = downloadStats[0]?.totalDownloads || 0;
    
    // Get my download count
    const myDownloads = await db.collection('materials').aggregate([
      { $match: { uploadedBy: sid } },
      { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } }
    ]).toArray();
    
    res.json({
      ok: true,
      data: {
        totalMaterials,
        myUploads: myMaterials,
        totalDownloads,
        myDownloads: myDownloads[0]?.totalDownloads || 0,
        popularMaterials: popularMaterials.map(material => ({
          id: material._id || material.id,
          name: material.name,
          courseCode: material.courseCode,
          downloads: material.downloads || 0
        })),
        recentMaterials: recentMaterials.map(material => ({
          id: material._id || material.id,
          name: material.name,
          courseCode: material.courseCode,
          uploadedAt: material.uploadedAt,
          size: material.size
        }))
      }
    });
  } catch (err) {
    console.error('Get materials stats error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load materials statistics' });
  }
});

// GET /api/dashboard/activity - Get user activity
router.get('/activity', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    const sid = req.user.sid;
    
    // Get recent activities from different collections
    const [materialActivities, groupActivities, questionnaireActivities] = await Promise.all([
      // Material activities
      db.collection('materials')
        .find({ uploadedBy: sid })
        .sort({ uploadedAt: -1 })
        .limit(5)
        .toArray(),
      
      // Group activities
      db.collection('group_requests')
        .find({ sid })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),
      
      // Questionnaire activities
      db.collection('questionnaires')
        .find({ creatorSid: sid })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray()
    ]);
    
    // Combine and format activities
    const activities = [
      ...materialActivities.map(material => ({
        type: 'material',
        title: `Uploaded "${material.name}"`,
        description: `To ${material.courseCode}`,
        timestamp: material.uploadedAt,
        icon: 'file'
      })),
      ...groupActivities.map(request => ({
        type: 'group',
        title: `Group request for ${request.major}`,
        description: request.course || 'No course specified',
        timestamp: request.createdAt,
        icon: 'team'
      })),
      ...questionnaireActivities.map(questionnaire => ({
        type: 'questionnaire',
        title: `Created "${questionnaire.title}"`,
        description: `${questionnaire.currentResponses || 0} responses`,
        timestamp: questionnaire.createdAt,
        icon: 'form'
      }))
    ];
    
    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      ok: true,
      data: activities.slice(0, 10) // Return top 10 activities
    });
  } catch (err) {
    console.error('Get activity error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load activity data' });
  }
});

// PUT /api/dashboard/update-last-login - Update user's last login time
router.put('/update-last-login', requireAuth, async (req, res) => {
  try {
    const db = await connectDB();
    
    await db.collection('users').updateOne(
      { sid: req.user.sid },
      { $set: { lastLogin: new Date() } }
    );
    
    res.json({
      ok: true,
      message: 'Last login updated'
    });
  } catch (err) {
    console.error('Update last login error:', err);
    // Don't fail the request for this non-critical update
    res.json({ ok: true, message: 'Login recorded' });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const db = await connectDB();
    // Test database connection
    await db.command({ ping: 1 });
    
    res.json({
      ok: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      status: 'unhealthy',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;