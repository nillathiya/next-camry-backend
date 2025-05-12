import crypto from "crypto";
import { ObjectId } from "mongodb";
import db from "./db";
import {
  OTP,
  deleteOTPByUsername,
  createOTP,
  findOTPByUsername,
} from "../models/otp";

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString(); // 6-digit OTP
}
interface IGenerateAndStoreOTP {
  username: string;
  code: string;
  expiresAt: Date;
}
export async function generateAndStoreOTP(
  username: string,
  expiresInMinutes = 10
): Promise<IGenerateAndStoreOTP> {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Delete any existing OTP for this username
  await deleteOTPByUsername(username);

  // Create new OTP
  await createOTP({
    username, // Use username instead of uCode
    code,
    expiresAt,
  });

  const data = { username, code, expiresAt };
  return data; // Return for sending to user (e.g., via WhatsApp)
}

export async function verifyOTP(
  username: string,
  otp: string
): Promise<boolean> {
  const storedOTP = await findOTPByUsername(username);
  if (!storedOTP || storedOTP.code !== otp) return false;

  const now = new Date();
  if (storedOTP.expiresAt < now) {
    await deleteOTPByUsername(username); // Remove expired OTP
    return false;
  }

  return true;
}

export default {
  generateOTP,
  createOTP,
  verifyOTP,
};
