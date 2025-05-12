import mongoose, { Schema, Document, Model } from "mongoose";
import jwt, { SignOptions } from "jsonwebtoken";
import { hash } from "bcrypt";

// Define the AdminUser interface
export interface AdminUser extends Document {
  _id: mongoose.Types.ObjectId;
  role: string;
  username?: string;
  amount: number;
  password: string;
  email: string;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
  generateAccessToken(): string;
}

// Define the schema with additional validation
const AdminUserSchema: Schema<AdminUser> = new Schema(
  {
    role: {
      type: String,
      default: "Admin",
      enum: ["Admin"],
    },
    username: {
      type: String,
      required: false,
      trim: true,
      minlength: 3,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"],
    },
    status: {
      type: Number,
      default: 1,
      enum: [0, 1], // Active/Inactive
    },
  },
  {
    timestamps: true,
  }
);

// Token generation method
AdminUserSchema.methods.generateAccessToken = function (
  this: AdminUser
): string {
  const jwtSecret = process.env.ACCESS_TOKEN_SECRET;
  if (!jwtSecret) {
    throw new Error(
      "ACCESS_TOKEN_SECRET is not defined in environment variables"
    );
  }

  if (!this._id) {
    throw new Error("Cannot generate token: user _id is missing");
  }

  // Ensure `expiresIn` is correctly typed
  let expiresIn: string | number = process.env.ACCESS_TOKEN_EXPIRY || "1h";

  if (!isNaN(Number(expiresIn))) {
    expiresIn = Number(expiresIn);
  }

  return jwt.sign(
    {
      _id: this._id.toString(),
      email: this.email,
      username: this.username,
      role: this.role,
      status: this.status,
    },
    jwtSecret as string, // Ensure correct type
    { expiresIn: expiresIn as SignOptions["expiresIn"] } // Fix type issue
  );
};

// Create indexes for better query performance
AdminUserSchema.index({ email: 1 });
AdminUserSchema.index({ status: 1, role: 1 });

// Create and export the model
export const AdminUserModel: Model<AdminUser> =
  mongoose.models.AdminUser ||
  mongoose.model<AdminUser>("AdminUser", AdminUserSchema);

export default AdminUserModel;
