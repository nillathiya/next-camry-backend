import { ObjectId } from "mongodb";
import db from "../helpers/db";

export interface WebsiteSettings {
  _id?: ObjectId;
  name?: string;
  title?: string;
  slug?: string;
  value?: string[];
  description?: string;
  adminStatus: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION_NAME = "websiteSettings";

export async function createWebsiteSettings(
  data: Omit<WebsiteSettings, "_id" | "createdAt" | "updatedAt">
): Promise<WebsiteSettings> {
  const defaults = {
    adminStatus: 1,
    status: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return db.insertOne<WebsiteSettings>(COLLECTION_NAME, {
    ...defaults,
    ...data,
  });
}

export async function findWebsiteSettingsById(
  id: string
): Promise<WebsiteSettings | null> {
  return db.findOne<WebsiteSettings>(COLLECTION_NAME, {
    _id: new ObjectId(id),
  });
}

export async function findWebsiteSettings(
  query: any = {}
): Promise<WebsiteSettings[]> {
  return db.findMany<WebsiteSettings>(COLLECTION_NAME, query);
}

export async function findOne(query: any): Promise<WebsiteSettings | null> {
  return db.findOne<WebsiteSettings>(COLLECTION_NAME, query);
}

export async function updateWebsiteSettings(
  id: string,
  update: Partial<WebsiteSettings>
): Promise<void> {
  await db.updateOne(
    COLLECTION_NAME,
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: new Date() } }
  );
}

export async function deleteWebsiteSettings(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export default {
  createWebsiteSettings,
  findWebsiteSettingsById,
  findWebsiteSettings,
  findOne,
  updateWebsiteSettings,
  deleteWebsiteSettings,
};
