// src/helpers/auth.ts
import jwt, { SignOptions } from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const jwtSecret = process.env.ACCESS_TOKEN_SECRET as string;
if (!jwtSecret) {
  throw new Error('ACCESS_TOKEN_SECRET is not defined in environment variables');
}

export interface JwtPayload {
  _id: ObjectId;
  email?: string;
  username?: string;
  role?: number;
  status?: number;
  [key: string]: any;
}

export function signJWT(payload: JwtPayload): string {
  const expiresInValue = process.env.ACCESS_TOKEN_EXPIRY;

  let expiresIn: number | '1h' | '1d' | '30m' | '15m' | undefined = '1h';

  if (expiresInValue) {
    if (!isNaN(Number(expiresInValue))) {
      expiresIn = Number(expiresInValue); // Numeric value in milliseconds
    } else {
      expiresIn = expiresInValue as '1h' | '1d' | '30m' | '15m' | undefined;
    }
  }

  const options: SignOptions = {
    expiresIn, // TS will accept this now
  };

  return jwt.sign(payload, jwtSecret, options);
}

export function verifyJWT(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtSecret) as JwtPayload;
  } catch (error) {
    console.log("Invalid or expired token")
    throw new Error('Invalid or expired token');
  }
}

export default {
  signJWT,
  verifyJWT,
};