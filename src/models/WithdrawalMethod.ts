import mongoose, { Schema, Document } from "mongoose";
import { ObjectId } from "mongodb";

interface IWithdrawalMethod extends Document {
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  slug: string;
}

const WithdrawalMethodSchema = new Schema<IWithdrawalMethod>(
  {
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    slug: { type: String, required: true },
  },
  { collection: "withdrawalmethods" }
);

const WithdrawalMethod = mongoose.model<IWithdrawalMethod>(
  "WithdrawalMethod",
  WithdrawalMethodSchema
);

export async function findWithdrawalMethodId(
  id: ObjectId
): Promise<IWithdrawalMethod | null> {
  return WithdrawalMethod.findById(id).exec();
}

export default WithdrawalMethod;
