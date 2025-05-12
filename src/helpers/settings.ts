import { ObjectId } from "mongodb";
import db from "./db";

type SettingsModel =
  | "adminSettings"
  | "companyInfo"
  | "userSettings"
  | "websiteSettings"
  | "walletSettings";

export interface Settings {
  _id?: ObjectId;
  name?: string;
  title?: string;
  slug?: string;
  value?: string[] | number | string;
  description?: string;
  adminStatus: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
  // WalletSettings-specific fields (optional)
  wallet?: string;
  type?: string;
  binary?: number;
  matrix?: number;
  universal?: number;
  singleLeg?: number;
}

export async function fetchUserSettingsBySlug(
  modelName: SettingsModel,
  slug: string
): Promise<Settings | null> {
  return db.findOne<Settings>(modelName, { slug, status: 1 });
}

export async function fetchAdminSettingsBySlug(
  modelName: SettingsModel,
  slug: string
): Promise<Settings | null> {
  return db.findOne<Settings>(modelName, { slug, adminStatus: 1 });
}

export async function fetchAllUserSettings(
  modelName: SettingsModel
): Promise<Settings[]> {
  return db.findMany<Settings>(modelName, { status: 1 });
}

export async function fetchAllAdminSettings(
  modelName: SettingsModel
): Promise<Settings[]> {
  return db.findMany<Settings>(modelName, { adminStatus: 1 });
}

export async function updateAdminSettingsBySlug(
  modelName: SettingsModel,
  slug: string,
  update: Partial<Omit<Settings, "slug">> // Exclude slug from updates
): Promise<void> {
  const settings = await fetchAdminSettingsBySlug(modelName, slug);
  if (!settings) {
    throw new Error(
      `Settings with slug '${slug}' not found or not editable by admin`
    );
  }
  await db.updateOne(
    modelName,
    { slug, adminStatus: 1 },
    { $set: { ...update, updatedAt: new Date() } }
  );
}

export default {
  fetchUserSettingsBySlug,
  fetchAdminSettingsBySlug,
  fetchAllUserSettings,
  fetchAllAdminSettings,
  updateAdminSettingsBySlug,
};
