import express from 'express';
import { ObjectId } from 'mongodb';
//import dotenv from 'dotenv';
import connectDB from '../db/connection.js';

//dotenv.config();

const router = express.Router();

// Campus mapping
const campusMap = {
  'ADC': 'Admiralty Learning Centre, 18 Harcourt Road, Hong Kong',
  'CIT': 'CITA Learning Centre, Kowloon Bay',
  'FTC': 'HKU SPACE Fortress Tower Learning Centre, North Point',
  'HPC': 'HPSHCC Campus, Causeway Bay',
  'IEC': 'Island East Campus, North Point',
  'ISP': 'Po Kong Village Road Campus, Pokfulam',
  'KEC': 'Kowloon East Campus, Kowloon Bay',
  'KEE': 'Kowloon East (Exchange) Learning Centre',
  'KEK': 'Kowloon East (Kingston) Learning Centre',
  'KWC': 'Kowloon West Campus, Cheung Sha Wan',
  'UNC': 'United Centre, Admiralty',
  'SSC': 'Sheung Shui Learning Centre'
};

// GET /api/calendar/courses - Get all courses for calendar
router.get('/courses', async (req, res) => {
  try {
    const db = await connectDB();
    
    // Get all courses with timetable data
    const courses = await db.collection('courses').find({
      'timetable.0': { $exists: true } // Only courses with timetable
    }).toArray();
    
    // Format for calendar
    const calendarCourses = courses.flatMap(course => {
      if (!course.timetable || !Array.isArray(course.timetable)) {
        return [];
      }
      
      return course.timetable.map(session => {
        const [start, end] = (session.time || '').split('-').map(t => t.trim());
        if (!start || !end) return null;
        
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          .indexOf(session.day?.trim() || '');
        
        if (weekday === -1) return null;
        
        const campusCode = session.room?.substring(0, 3).toUpperCase();
        const campus = campusMap[campusCode] || session.room || 'Unknown Campus';
        
        return {
          id: `${course.code}-${session.classNo || '01'}`,
          code: course.code,
          title: course.title,
          classNo: session.classNo || '',
          startTime: start,
          endTime: end,
          weekday: weekday,
          day: session.day,
          room: session.room || '',
          campus: campus,
          campusShort: campusCode,
          description: course.description || '',
          color: getColorForCourse(course.code),
        };
      }).filter(Boolean);
    });
    
    res.json({ ok: true, data: calendarCourses });
  } catch (err) {
    console.error('Get calendar courses error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/calendar/events - Get events formatted for FullCalendar
router.get('/events', async (req, res) => {
  try {
    const db = await connectDB();
    
    // Get all courses with timetable data
    const courses = await db.collection('courses').find({
      'timetable.0': { $exists: true }
    }).toArray();
    
    const events = courses.flatMap(course => {
      if (!course.timetable || !Array.isArray(course.timetable)) {
        return [];
      }
      
      return course.timetable.map(session => {
        const [startHour, startMin] = (session.time?.split('-')[0] || '').split(':').map(Number);
        const [endHour, endMin] = (session.time?.split('-')[1] || '').split(':').map(Number);
        
        if (isNaN(startHour) || isNaN(endHour)) return null;
        
        // Create date for the current week (starting from Monday)
        const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          .indexOf(session.day?.trim() || '');
        
        if (weekday === -1) return null;
        
        // Create events for the next 4 weeks
        const events = [];
        const now = new Date();
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Start from Monday
        
        for (let week = 0; week < 4; week++) {
          const eventDate = new Date(currentWeekStart);
          eventDate.setDate(currentWeekStart.getDate() + (week * 7) + weekday);
          
          const startDate = new Date(eventDate);
          startDate.setHours(startHour, startMin, 0, 0);
          
          const endDate = new Date(eventDate);
          endDate.setHours(endHour, endMin, 0, 0);
          
          const campusCode = session.room?.substring(0, 3).toUpperCase();
          const campus = campusMap[campusCode] || session.room || 'Unknown Campus';
          
          events.push({
            id: `${course.code}-${session.classNo || '01'}-${week}`,
            title: `${course.code} - ${session.classNo || ''}`,
            extendedProps: {
              fullTitle: course.title,
              description: course.description || '',
              room: session.room || '',
              campus: campus,
              instructor: session.instructor || '',
              classNo: session.classNo || '',
            },
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            backgroundColor: getColorForCourse(course.code),
            borderColor: getColorForCourse(course.code, true),
            textColor: '#ffffff',
            allDay: false,
          });
        }
        
        return events;
      }).filter(Boolean).flat();
    });
    
    res.json({ ok: true, data: events });
  } catch (err) {
    console.error('Get calendar events error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/calendar/save - Save user's personal timetable
router.post('/save', async (req, res) => {
  try {
    const { sid, courses } = req.body;
    
    if (!sid) {
      return res.status(400).json({ ok: false, error: 'Student ID required' });
    }
    
    const db = await connectDB();
    
    await db.collection('user_timetables').updateOne(
      { sid },
      { 
        $set: { 
          courses: courses || [],
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    
    res.json({ ok: true, message: 'Timetable saved successfully' });
  } catch (err) {
    console.error('Save timetable error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// GET /api/calendar/mytimetable - Get user's saved timetable
router.get('/mytimetable', async (req, res) => {
  try {
    const sid = req.query.sid || req.headers['x-sid'];
    
    if (!sid) {
      return res.status(400).json({ ok: false, error: 'Student ID required' });
    }
    
    const db = await connectDB();
    
    const timetable = await db.collection('user_timetables').findOne({ sid });
    
    res.json({ 
      ok: true, 
      data: timetable?.courses || [] 
    });
  } catch (err) {
    console.error('Get my timetable error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// POST /api/calendar/check-conflicts - Check for timetable conflicts
router.post('/check-conflicts', async (req, res) => {
  try {
    const { courses } = req.body;
    
    if (!Array.isArray(courses)) {
      return res.json({ ok: true, hasConflicts: false, conflicts: [] });
    }
    
    const conflicts = [];
    
    // Simple conflict detection
    for (let i = 0; i < courses.length; i++) {
      for (let j = i + 1; j < courses.length; j++) {
        const course1 = courses[i];
        const course2 = courses[j];
        
        if (course1.weekday === course2.weekday) {
          const start1 = timeToMinutes(course1.startTime);
          const end1 = timeToMinutes(course1.endTime);
          const start2 = timeToMinutes(course2.startTime);
          const end2 = timeToMinutes(course2.endTime);
          
          if ((start1 < end2 && end1 > start2) || (start2 < end1 && end2 > start1)) {
            conflicts.push({
              course1: `${course1.code} - ${course1.classNo}`,
              course2: `${course2.code} - ${course2.classNo}`,
              day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][course1.weekday],
              time: `${course1.startTime}-${course1.endTime} vs ${course2.startTime}-${course2.endTime}`,
            });
          }
        }
      }
    }
    
    res.json({ 
      ok: true, 
      hasConflicts: conflicts.length > 0,
      conflicts 
    });
  } catch (err) {
    console.error('Check conflicts error:', err);
    res.status(500).json({ ok: false, error: 'Server error' });
  }
});

// Helper function to convert time to minutes
function timeToMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

// Helper function to get color for course
function getColorForCourse(courseCode, border = false) {
  // Generate consistent color based on course code
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#84cc16', // lime
    '#06b6d4', // cyan
  ];
  
  // Hash the course code to get a consistent index
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = courseCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  
  if (border) {
    // Darker version for border
    return darkenColor(colors[index], 20);
  }
  
  return colors[index];
}

// Helper function to darken color
function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  
  return '#' + (
    0x1000000 +
    (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)
  ).toString(16).slice(1);
}

export default router;