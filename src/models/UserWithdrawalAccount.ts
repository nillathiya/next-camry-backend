import mongoose, { Schema, Document, Types } from "mongoose";
import { ObjectId } from "mongodb";

interface IUserWithdrawalAccount extends Document {
  userId: Types.ObjectId;
  accountTypeId: Types.ObjectId;
  details: Map<string, string>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserWithdrawalAccountSchema = new Schema<IUserWithdrawalAccount>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  accountTypeId: {
    type: Schema.Types.ObjectId,
    ref: "WithdrawalAccountType",
    required: true,
  },
  details: { type: Map, of: String, default: {} }, // e.g., {"account_number": "12345", "ifsc_code": "ABC123"}
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'userwithdrawalaccounts' });

const COLLECTION_NAME = "userwithdrawalaccounts";

export async function findUserWithdrawalAccountId(
  id: ObjectId
): Promise<IUserWithdrawalAccount | null> {
  return mongoose.model<IUserWithdrawalAccount>('UserWithdrawalAccount').findById(id).exec();
}

export default mongoose.model<IUserWithdrawalAccount>(
  "UserWithdrawalAccount",
  UserWithdrawalAccountSchema
);