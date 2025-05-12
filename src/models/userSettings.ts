import { ObjectId, Collection } from "mongodb";
import { connectMongoDB } from "../config/db";
import db from "../helpers/db";

interface Item {
  key: string;
  label: string;
  icon: string;
  status: boolean;
  children?: Item[];
}

export interface UserSettings {
  _id?: ObjectId;
  title?: string;
  name?: string;
  slug?: string;
  type?: string; // array | boolean | number | string
  options?: Item[];
  image?: string;
  value?: Item[] | boolean | number | string;
  status: number;
  adminStatus: number;
}

const COLLECTION_NAME = "userSettings";

let collection: Collection<UserSettings> | null = null;
async function getCollection(): Promise<Collection<UserSettings>> {
  if (!collection) {
    const dbConn = await connectMongoDB();
    collection = dbConn.collection<UserSettings>(COLLECTION_NAME);
    await collection.createIndex({ slug: 1 }, { unique: true, sparse: true }); // Unique slug
  }
  return collection;
}

export async function createUserSettings(
  data: Omit<UserSettings, "_id">
): Promise<UserSettings> {
  const defaults = { status: 0, adminStatus: 0 };
  try {
    return await db.insertOne<UserSettings>(COLLECTION_NAME, {
      ...defaults,
      ...data,
    });
  } catch (error: any) {
    if (error.code === 11000) throw new Error("Duplicate slug detected");
    throw error;
  }
}

export async function updateUserSettings(
  id: string,
  update: Partial<UserSettings>
): Promise<void> {
  delete update.slug; // Prevent slug update
  await db.updateOne(
    COLLECTION_NAME,
    { _id: new ObjectId(id) },
    { $set: update }
  );
}

export async function findUserSettingsById(
  id: string
): Promise<UserSettings | null> {
  return db.findOne<UserSettings>(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export async function findUserSettings(
  query: any = {}
): Promise<UserSettings[]> {
  return db.findMany<UserSettings>(COLLECTION_NAME, query);
}

export async function findOne(query: any): Promise<UserSettings | null> {
  return db.findOne<UserSettings>(COLLECTION_NAME, query);
}

export async function deleteUserSettings(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export default {
  createUserSettings,
  findUserSettingsById,
  findUserSettings,
  findOne,
  updateUserSettings,
  deleteUserSettings,
};
