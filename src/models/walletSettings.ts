import { ObjectId, Collection } from "mongodb";
import db from "../helpers/db";
import { ApiError } from "../utils/error";
import { fetchUserSettingsBySlug, Settings } from "../helpers/settings";
import { connectMongoDB } from "../config/db";
import mongoose, { Schema, Document } from "mongoose";

export interface WalletSettings {
  _id: ObjectId;
  parentId?: ObjectId; // Ref to Wallet._id
  slug?: string;
  name?: string;
  wallet?: string;
  type?: string;
  binary: number;
  matrix: number;
  universal: number;
  singleLeg: number;
  status: number;
  adminStatus: number;
  column?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const WalletSettingsSchema = new Schema<WalletSettings>(
  {
    parentId: { type: Schema.Types.ObjectId, ref: "Wallet" },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    wallet: { type: String },
    type: { type: String },
    binary: { type: Number, default: 0 },
    matrix: { type: Number, default: 0 },
    universal: { type: Number, default: 0 },
    singleLeg: { type: Number, default: 0 },
    status: { type: Number, default: 1 },
    adminStatus: { type: Number, default: 1 },
    column: { type: String, required: true },
  },
  { timestamps: true, collection: "walletSettings" }
);

const WalletSettingsModel =
  mongoose.models.WalletSettings ||
  mongoose.model<WalletSettings>("WalletSettings", WalletSettingsSchema);

const COLLECTION_NAME = "walletSettings";

let collection: Collection<WalletSettings> | null = null;
async function getCollection(): Promise<Collection<WalletSettings>> {
  if (!collection) {
    const dbConn = await connectMongoDB();
    collection = dbConn.collection<WalletSettings>(COLLECTION_NAME);
    await collection.createIndex({ slug: 1 }, { unique: true, sparse: true });
  }
  return collection;
}

export async function createWalletSettings(
  data: Omit<WalletSettings, "_id" | "createdAt" | "updatedAt">
): Promise<WalletSettings> {
  const defaults = {
    binary: 0,
    matrix: 0,
    universal: 0,
    singleLeg: 0,
    adminStatus: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  try {
    return await db.insertOne<WalletSettings>(COLLECTION_NAME, {
      ...defaults,
      ...data,
    });
  } catch (error: any) {
    if (error.code === 11000) throw new Error("Duplicate slug detected");
    throw error;
  }
}

export async function findWalletSettingsById(
  id: string
): Promise<WalletSettings | null> {
  return db.findOne<WalletSettings>(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export async function findWalletSettings(
  query: any = {}
): Promise<WalletSettings[]> {
  return db.findMany<WalletSettings>(COLLECTION_NAME, query);
}

export async function findActiveWalletsByType(
  type: string
): Promise<WalletSettings[] | null> {
  try {
    const planTypeSettings = await fetchUserSettingsBySlug(
      "adminSettings",
      "plan_type"
    );
    if (!planTypeSettings) {
      throw new ApiError(500, "Failed to fetch plan type settings");
    }
    const activePlan = Array.isArray(planTypeSettings.value)
      ? planTypeSettings.value[0]
      : planTypeSettings.value;

    if (!activePlan || typeof activePlan !== "string") {
      throw new ApiError(404, "Plan type not found or invalid");
    }

    const query = { [activePlan.toLowerCase()]: 1, type };

    const activeWallets = await db.findMany<WalletSettings>(
      COLLECTION_NAME,
      query
    );

    return activeWallets || null;
  } catch (error) {
    throw new ApiError(
      500,
      `Error finding active wallets: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export async function findOne(query: any): Promise<WalletSettings | null> {
  return db.findOne<WalletSettings>(COLLECTION_NAME, query);
}

export async function updateWalletSettings(
  id: string,
  update: Partial<WalletSettings>
): Promise<void> {
  delete update.slug; // Prevent slug update
  await db.updateOne(
    COLLECTION_NAME,
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: new Date() } }
  );
}

export async function deleteWalletSettings(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

getCollection().catch((err) =>
  console.error("Failed to initialize walletSettings indexes:", err)
);

export default {
  createWalletSettings,
  findWalletSettingsById,
  findWalletSettings,
  findOne,
  updateWalletSettings,
  deleteWalletSettings,
  findActiveWalletsByType,
  WalletSettingsModel,
};
