import mongoose, { Schema, Document, Types } from "mongoose";
import { ObjectId } from "mongodb";

export interface IWithdrawalAccountType extends Document {
  methodId: Types.ObjectId;
  name: string;
  slug: string;
  requiredFields: Map<string, string>;
  isActive: boolean;
  type?: "auto" | "manual" | "cash";
  pairIdentifier?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WithdrawalAccountTypeSchema = new Schema<IWithdrawalAccountType>({
  methodId: {
    type: Schema.Types.ObjectId,
    ref: "WithdrawalMethod",
    required: true,
  },
  name: { type: String, required: true }, // e.g., "Bank", "Gpay", "BSC", "USDT"
  slug: { type: String, required: true }, // e.g., "bank-account", "gpay-account", "bsc-account", "usdt-account"
  requiredFields: { type: Map, of: String, default: {} }, // e.g., {"account_number": "string", "ifsc_code": "string"}
  isActive: { type: Boolean, default: true },
  type: { type: String, enum: ["auto", "manual", "cash"], default: "manual" },
  pairIdentifier: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { collection: 'withdrawalaccounttypes' });

const COLLECTION_NAME = "withdrawalaccounttypes";

export async function findWithdrawalAccountId(
  id: ObjectId
): Promise<IWithdrawalAccountType | null> {
  return mongoose.model<IWithdrawalAccountType>('WithdrawalAccountType').findById(id).exec();
}

export default mongoose.model<IWithdrawalAccountType>(
  "WithdrawalAccountType",
  WithdrawalAccountTypeSchema
);