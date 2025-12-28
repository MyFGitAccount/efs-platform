import { MongoClient } from 'mongodb';
let client;
let db;
let gridfsBucket;

const connectDB = async () => {
  if (db) {
    return db;
  }

  if (!client) {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
  }

  db = client.db();
  return db;
};

// Get GridFS bucket directly
export const getGridFSBucket = async () => {
  if (!gridfsBucket) {
    const db = await connectDB();
    gridfsBucket = new GridFSBucket(db, {
      bucketName: 'uploads'
    });
  }
  return gridfsBucket;
};

export default connectDB;
