// src/models/otp.ts
import { ObjectId } from "mongodb";
import db from "../helpers/db";

export interface OTP {
  _id?: ObjectId;
  username: string; // Changed from uCode to username
  code: string;
  expiresAt: Date;
  createdAt?: Date;
}

const COLLECTION_NAME = "otps";

export async function createOTP(
  data: Omit<OTP, "_id" | "createdAt">
): Promise<OTP> {
  const defaults = { createdAt: new Date() };
  return db.insertOne<OTP>(COLLECTION_NAME, { ...defaults, ...data });
}

export async function findOTPByUsername(username: string): Promise<OTP | null> {
  return db.findOne<OTP>(COLLECTION_NAME, { username });
}

export async function deleteOTPByUsername(username: string): Promise<void> {
  await db.deleteMany(COLLECTION_NAME, { username });
}

export default {
  createOTP,
  findOTPByUsername,
  deleteOTPByUsername,
};
