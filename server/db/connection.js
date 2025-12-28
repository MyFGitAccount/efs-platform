import { MongoClient } from 'mongodb';

let client;
let db;

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

export default connectDB;
