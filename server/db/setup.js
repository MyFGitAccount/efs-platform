'import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

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
    await db.collection('group_requests').createIndex({ sid: 1 }, { unique: true });
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
      };
      
      await db.collection('users').insertOne(adminUser);
      console.log('✅ Created default admin user: admin@efs.com / admin123');
    }
    
    console.log('✅ Database setup completed successfully!');
    
  } catch (err) {
    console.error('❌ Database setup failed:', err);
  } finally {
    await client.close();
  }
}

setupDatabase();
