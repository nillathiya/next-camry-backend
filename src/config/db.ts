import { MongoClient, Db } from "mongodb";
import mongoose from "mongoose";
import { config } from "dotenv";

config();

// Load environment variables
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error("MONGO_URI is not defined in environment variables");
}

// --- MongoDB Native Driver (MongoClient) Setup ---
const mongoClient = new MongoClient(mongoUri); // mongoUri is string here
let mongoDb: Db | null = null;
let isMongoConnected = false;

export async function connectMongoDB(): Promise<Db> {
  if (mongoDb && isMongoConnected) {
    return mongoDb;
  }

  try {
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.COLLECTION_NAME);
    if (!isMongoConnected) {
      console.log("Connected to MongoDB via MongoClient");
      isMongoConnected = true;
    }
    mongoClient.on("close", () => {
      console.log("MongoDB MongoClient disconnected");
      isMongoConnected = false;
      mongoDb = null;
    });
    mongoClient.on("error", (err) => {
      console.error("MongoDB MongoClient error:", err);
    });
    return mongoDb;
  } catch (error) {
    console.error("MongoDB MongoClient connection error:", error);
    throw error;
  }
}

export async function getMongoDB(): Promise<Db> {
  if (!mongoDb || !isMongoConnected) {
    await connectMongoDB();
  }
  return mongoDb as Db;
}

// --- Mongoose Setup ---
let isMongooseConnected = false;

export async function connectMongoose(): Promise<typeof mongoose> {
  if (isMongooseConnected) {
    return mongoose;
  }

  try {
    // Explicitly assert mongoUri as string since we checked it above
    await mongoose.connect(mongoUri as string, {
      dbName:process.env.COLLECTION_NAME,
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 20000,
    });
    if (!isMongooseConnected) {
      console.log("Connected to MongoDB via Mongoose");
      isMongooseConnected = true;
    }
    mongoose.connection.on("disconnected", () => {
      console.log("Mongoose disconnected");
      isMongooseConnected = false;
    });
    mongoose.connection.on("error", (err) => {
      console.error("Mongoose connection error:", err);
    });
    return mongoose;
  } catch (error) {
    console.error("Mongoose connection error:", error);
    throw error;
  }
}

export async function getMongooseConnection(): Promise<typeof mongoose.connection> {
  if (!isMongooseConnected) {
    await connectMongoose();
  }
  return mongoose.connection;
}

// Export both clients for direct access if needed
export { mongoClient, mongoose };