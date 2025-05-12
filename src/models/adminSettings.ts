import { ObjectId, Collection } from "mongodb";
import db from "../helpers/db";
import { connectMongoDB } from "../config/db";

export interface AdminSettings {
  _id?: ObjectId;
  title?: string;
  name?: string;
  slug?: string;
  type?: string; // array | boolean | number | string
  options?: string[];
  image?: string;
  value?: string[] | boolean | number | string;
  status: number;
  adminStatus: number;
}

const COLLECTION_NAME = "adminSettings";

let collection: Collection<AdminSettings> | null = null;
async function getCollection(): Promise<Collection<AdminSettings>> {
  if (!collection) {
    const dbConn = await connectMongoDB();
    collection = dbConn.collection<AdminSettings>(COLLECTION_NAME);
    await collection.createIndex({ slug: 1 }, { unique: true, sparse: true });
  }
  return collection;
}

export async function createAdminSetting(
  data: Omit<AdminSettings, "_id">
): Promise<AdminSettings> {
  const defaults = { status: 0, adminStatus: 0 };
  try {
    return await db.insertOne<AdminSettings>(COLLECTION_NAME, {
      ...defaults,
      ...data,
    });
  } catch (error: any) {
    if (error.code === 11000) throw new Error("Duplicate slug detected");
    throw error;
  }
}

export async function findAdminSettingById(
  id: string
): Promise<AdminSettings | null> {
  return db.findOne<AdminSettings>(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export async function findAdminSettings(
  query: any = {}
): Promise<AdminSettings[]> {
  return db.findMany<AdminSettings>(COLLECTION_NAME, query);
}

export async function findOne(query: any): Promise<AdminSettings | null> {
  return db.findOne<AdminSettings>(COLLECTION_NAME, query);
}

export async function updateAdminSetting(
  id: string,
  update: Partial<AdminSettings>
): Promise<void> {
  try {
    delete update.slug; // Prevent slug updates
    await db.updateOne(
      COLLECTION_NAME,
      { _id: new ObjectId(id) },
      { $set: update }
    );
  } catch (error: any) {
    if (error.code === 11000) throw new Error("Duplicate slug detected");
    throw error;
  }
}

export async function deleteAdminSetting(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

getCollection().catch((err) =>
  console.error("Failed to initialize adminSettings indexes:", err)
);

export default {
  createAdminSetting,
  findAdminSettingById,
  findAdminSettings,
  findOne,
  updateAdminSetting,
  deleteAdminSetting,
};
