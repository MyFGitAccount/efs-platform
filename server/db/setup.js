import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function setupDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('Setting up EFS database schema...');
    
    // Create collections with indexes
    const collections = [
      'users',
      'pending_accounts',
      'courses',
      'pending_courses',
      'group_requests',
      'group_invitations',
      'questionnaires',
      'materials',
      'user_timetables'
    ];
    
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName);
        console.log(`✅ Created collection: ${collectionName}`);
      } catch (err) {
        if (err.codeName === 'NamespaceExists') {
          console.log(`ℹ️ Collection already exists: ${collectionName}`);
        } else {
          throw err;
        }
      }
    }
    
    // Create indexes
    console.log('Creating indexes...');
    
    // Users collection indexes
    await db.collection('users').createIndex({ sid: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });
    await db.collection('users').createIndex({ major: 1 });
    await db.collection('users').createIndex({ year_of_study: 1 });
    
    // Pending accounts indexes
    await db.collection('pending_accounts').createIndex({ sid: 1 }, { unique: true });
    await db.collection('pending_accounts').createIndex({ email: 1 }, { unique: true });
    await db.collection('pending_accounts').createIndex({ createdAt: -1 });
    
    // Courses collection indexes
    await db.collection('courses').createIndex({ code: 1 }, { unique: true });
    await db.collection('courses').createIndex({ title: 1 });
    await db.collection('courses').createIndex({ status: 1 });
    
    // Pending courses indexes
    await db.collection('pending_courses').createIndex({ code: 1 }, { unique: true });
    await db.collection('pending_courses').createIndex({ requestedBy: 1 });
    await db.collection('pending_courses').createIndex({ createdAt: -1 });
    
    // Group requests indexes
    await db.collection('group_requests').createIndex({ sid: 1 });
    await db.collection('group_requests').createIndex({ major: 1 });
    await db.collection('group_requests').createIndex({ status: 1 });
    await db.collection('group_requests').createIndex({ createdAt: -1 });
    
    // Group invitations indexes
    await db.collection('group_invitations').createIndex({ from_sid: 1, to_sid: 1 });
    await db.collection('group_invitations').createIndex({ sent_at: -1 });
    
    // Questionnaires indexes
    await db.collection('questionnaires').createIndex({ creatorSid: 1 });
    await db.collection('questionnaires').createIndex({ status: 1 });
    await db.collection('questionnaires').createIndex({ currentResponses: 1 });
    await db.collection('questionnaires').createIndex({ createdAt: -1 });
    await db.collection('questionnaires').createIndex({ filledBy: 1 });
    
    // Materials indexes
    await db.collection('materials').createIndex({ courseCode: 1 });
    await db.collection('materials').createIndex({ uploadedBy: 1 });
    await db.collection('materials').createIndex({ downloads: -1 });
    await db.collection('materials').createIndex({ uploadedAt: -1 });
    await db.collection('materials').createIndex({ tags: 1 });
    
    // User timetables indexes
    await db.collection('user_timetables').createIndex({ sid: 1 }, { unique: true });
    await db.collection('user_timetables').createIndex({ updatedAt: -1 });
    
    console.log('✅ All indexes created successfully');
    
    // Create default admin user if not exists
    const adminExists = await db.collection('users').findOne({ role: 'admin' });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      const adminUser = {
        sid: 'admin001',
        email: 'admin@efs.com',
        password: hashedPassword,
        role: 'admin',
        credits: 999,
        createdAt: new Date(),
        updatedAt: new Date(),
        major: 'Administration',
        year_of_study: 1,
        about_me: 'System Administrator',
      };
      
      await db.collection('users').insertOne(adminUser);
      console.log('✅ Created default admin user: admin@efs.com / admin123');
    }
    
    // Create sample courses if none exist
    const courseCount = await db.collection('courses').countDocuments();
    if (courseCount === 0) {
      const sampleCourses = [
        {
          code: 'AD113',
          title: 'Associate of Engineering',
          description: 'This programme aims to provide students with a broad and solid grounding in the field of engineering and information technology, and to enhance students’ technical knowledge and problem-solving skills.',
          materials: [],
          timetable: [
            { day: 'Mon', time: '09:00-11:00', room: 'ADC101', classNo: '01' },
            { day: 'Wed', time: '14:00-16:00', room: 'ADC101', classNo: '01' },
          ],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          code: 'HD101',
          title: 'Human Development',
          description: 'Introduction to human development across the lifespan.',
          materials: [],
          timetable: [
            { day: 'Tue', time: '10:00-12:00', room: 'HPC201', classNo: '01' },
            { day: 'Thu', time: '10:00-12:00', room: 'HPC201', classNo: '01' },
          ],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          code: 'CS101',
          title: 'Computer Science Fundamentals',
          description: 'Introduction to computer science concepts and programming.',
          materials: [],
          timetable: [
            { day: 'Mon', time: '13:00-15:00', room: 'KEC301', classNo: '01' },
            { day: 'Wed', time: '13:00-15:00', room: 'KEC301', classNo: '01' },
            { day: 'Fri', time: '09:00-11:00', room: 'KEC301', classNo: '01' },
          ],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      
      await db.collection('courses').insertMany(sampleCourses);
      console.log('✅ Created sample courses');
    }
    try {
  await db.createCollection('uploads.files');
  await db.createCollection('uploads.chunks');
  console.log('✅ Created GridFS collections');
} catch (err) {
  if (err.codeName === 'NamespaceExists') {
    console.log('ℹ️ GridFS collections already exist');
  } else {
    throw err;
  }
}

// Add GridFS indexes
await db.collection('uploads.files').createIndex({ filename: 1 });
await db.collection('uploads.files').createIndex({ 'metadata.uploadedBy': 1 });
await db.collection('uploads.files').createIndex({ 'metadata.courseCode': 1 });
await db.collection('uploads.chunks').createIndex({ files_id: 1, n: 1 }, { unique: true });
    console.log('✅ Database setup completed successfully!');
    
  } catch (err) {
    console.error('❌ Database setup failed:', err);
  } finally {
    await client.close();
  }
}




setupDatabase();
