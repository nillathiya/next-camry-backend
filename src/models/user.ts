import { ObjectId, Collection } from "mongodb";
import db from "../helpers/db";
import { connectMongoDB } from "../config/db";
import { signJWT } from "../helpers/auth";
import mongoose, { Schema, Document } from "mongoose";

export interface User {
  _id: ObjectId;
  parentUCode?: ObjectId;
  sponsorUCode?: ObjectId;
  name: string;
  email: string;
  password: string;
  contactNumber?: string;
  username: string;
  walletId?: ObjectId;
  wallet_address?: string;
  gender?: string;
  dob?: Date;
  role: string;
  kycStatus: number;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    postalCode?: string;
  };
  // Account & Status
  accountStatus?: {
    activeStatus?: number;
    blockStatus?: number;
    activeDate?: Date;
  };
  bankDetails?: {
    account?: string;
    IFSC?: string;
    bank?: string;
    accountType?: string;
  };
  upiDetails?: {
    gPay?: string;
    phonePe?: string;
    bharatPe?: string;
    payTM?: string;
    upiId?: string;
  };

  nominee: {
    name?: string;
    relation?: string;
    dob?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      country?: string;
      countryCode?: string;
      postalCode?: string;
    };
  };
  panCard?: {
    panNo?: string;
    image?: string;
  };
  identityProof?: {
    proofType?: "Adhaar" | "VoterID" | "Passport" | "Driving License";
    proofNumber?: string;
    image1?: string;
    image2?: string;
  };
  payment?: {
    paymentId?: string;
    amount?: number;
    dateTime?: Date;
  };

  profilePicture?: string;
  ip?: string;
  source?: string;
  accessLevels?: number[];
  resetPasswordToken?: string;
  settings?: Record<string, any>;
  validityDate?: Date;
  planName?: string;
  cryptoAddress?: string;
  metadata?: Record<string, any>;
  lastLogin?: Date;
  lastActivity?: Date;
  downlines: [ObjectId];
  createdAt: Date;
  updatedAt: Date;
  myRank?: string;
  withdraw_status: number;
  capping?: number;
  position: number;
  reason?: string;
  status: number;
}

export interface IUserHierarchy {
  _id: ObjectId;
  username: string;
  name: string;
  sponsorUCode: ObjectId | null;
  planType?: "unilevel" | "binary" | "matrix";
  createdAt: Date;
  depth: number;
}
// --- Mongoose Schema for User ---
const UserSchema = new Schema<User>(
  {
    parentUCode: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sponsorUCode: { type: Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String },
    contactNumber: { type: String, trim: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet", default: null },
    wallet_address: { type: String, trim: true },
    gender: {
      type: String,
      default: null,
    },
    dob: { type: Date, default: null },
    role: {
      type: String,
      enum: ["Admin", "User"],
      default: "User",
    },
    kycStatus: {
      type: Number,
      enum: [0, 1, 2], // Pending=0, Approved=1, Rejected=2
      default: 2,
    },
    address: {
      line1: { type: String, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      countryCode: { type: String, trim: true },
      postalCode: { type: String, trim: true },
    },
    // Account & Status
    accountStatus: {
      activeStatus: {
        type: Number,
        enum: [0, 1, 2], // Inactive=0, Active=1, Blocked=2
        default: 0,
      },
      blockStatus: {
        type: Number,
        enum: [0, 1, 2], // Inactive=0, Active=1, Blocked=2
        default: 0,
      },
      activeDate: { type: Date, default: null },
    },
    bankDetails: {
      account: { type: String, trim: true },
      ifsc: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountType: { type: String, trim: true },
    },
    upiDetails: {
      gPay: { type: String, trim: true },
      phonePe: { type: String, trim: true },
      bharatPe: { type: String, trim: true },
      payTm: { type: String, trim: true },
      upiId: { type: String, trim: true },
    },
    nominee: {
      name: { type: String, trim: true },
      relation: { type: String, trim: true },
      dob: { type: String, trim: true },
      address: {
        line1: { type: String, trim: true },
        line2: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, trim: true },
        countryCode: { type: String, trim: true },
        postalCode: { type: String, trim: true },
      },
    },
    panCard: {
      panNo: { type: String, trim: true },
      image: { type: String, trim: true },
    },
    identityProof: {
      proofType: {
        type: String,
        enum: ["Adhaar", "VoterID", "Passport", "Driving License"],
        default: null,
      },
      proofNumber: { type: String, trim: true },
      image1: { type: String, trim: true },
      image2: { type: String, trim: true },
    },
    payment: {
      paymentId: { type: String, trim: true },
      amount: { type: Number, default: null },
      dateTime: { type: Date, default: null },
    },

    profilePicture: { type: String, trim: true },
    ip: { type: String, trim: true },
    source: { type: String, trim: true },
    accessLevels: [{ type: Number }],
    resetPasswordToken: { type: String, trim: true },
    settings: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
      preferences: { type: Schema.Types.Mixed, default: {} },
    },
    validityDate: { type: Date, default: null },
    planName: { type: String, trim: true },
    cryptoAddress: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    lastLogin: { type: Date, default: null },
    capping: { type: Number, default: 0 },
    lastActivity: { type: Date, default: null },
    downlines: [{ type: Schema.Types.ObjectId, ref: "User" }],
    myRank: String,
    withdraw_status: { type: Number, default: 1 },
    position: { type: Number, default: 0 },
    reason: String,
    status: { type: Number, default: 1 },
  },
  { timestamps: true, collection: "users" }
);

UserSchema.index({ uSponsor: 1 });
UserSchema.index({ leftChild: 1 });
UserSchema.index({ rightChild: 1 });

const UserModel =
  mongoose.models.User || mongoose.model<User>("User", UserSchema);

// --- MongoDB Native Driver Logic ---
const COLLECTION_NAME = "users";

let collection: Collection<User> | null = null;
async function getCollection(): Promise<Collection<User>> {
  if (!collection) {
    const dbConn = await connectMongoDB();
    collection = dbConn.collection<User>(COLLECTION_NAME);
    await collection.createIndex({ username: 1 }, { unique: true });
    await collection.createIndex({ name: 1 });
    await collection.createIndex({ email: 1 });
  }
  return collection;
}

export async function createUser(
  data: Omit<User, "_id" | "createdAt" | "updatedAt">
): Promise<User> {
  const defaults = {
    withdraw_status: 1,
    position: 0,
    active_id: 0,
    active_status: 0,
    kycStatus: 2,
    status: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  try {
    return await db.insertOne<User>(COLLECTION_NAME, { ...defaults, ...data });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new Error("Duplicate username detected");
    }
    throw error;
  }
}

export async function findUserById(id: string): Promise<User | null> {
  return db.findOne<User>(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export async function findUsers(query: any = {}): Promise<User[]> {
  return db.findMany<User>(COLLECTION_NAME, query);
}

export async function findOne(query: any): Promise<User | null> {
  return db.findOne<User>(COLLECTION_NAME, query);
}

export async function updateUser(
  id: string,
  update: Partial<User>
): Promise<void> {
  try {
    await db.updateOne(
      COLLECTION_NAME,
      { _id: new ObjectId(id) },
      { $set: { ...update, updatedAt: new Date() } }
    );
  } catch (error: any) {
    if (error.code === 11000) {
      throw new Error("Duplicate username detected");
    }
    throw error;
  }
}

export async function deleteUser(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export function generateAccessToken(
  user: Pick<User, "_id" | "parentUCode" | "email" | "username">
): string {
  if (!user._id) {
    throw new Error("Cannot generate token: user _id is missing");
  }
  const payload = {
    _id: user._id,
    email: user.email,
    username: user.username,
    parentUCode: user.parentUCode,
  };
  return signJWT(payload);
}

// Initialize collection indexes
getCollection().catch((err) =>
  console.error("Failed to initialize user indexes:", err)
);

export default UserModel;
