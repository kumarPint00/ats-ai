import { MongoClient, Db } from "mongodb";

let client: MongoClient;
let db: Db;

export async function connectMongo(): Promise<Db> {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI not set");
  }
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error("Mongo not connected");
  return db;
}
