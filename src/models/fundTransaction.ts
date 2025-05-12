import { ObjectId } from "mongodb";
import db from "../helpers/db";
import mongoose, { Schema, Document } from "mongoose";

export interface FundTransaction {
  _id?: ObjectId;
  txUCode: ObjectId | null;
  uCode: ObjectId | null;
  txType?: string;
  debitCredit?: string;
  fromWalletType?: string;
  walletType?: string;
  amount?: number;
  txCharge?: number;
  paymentSlip?: string;
  txNumber?: string;
  uuid?: string;
  postWalletBalance?: number;
  currentWalletBalance?: number;
  method?: ObjectId | null;
  account?: ObjectId | null;
  withdrawalAccountType?: ObjectId | null;
  withdrawalAccount?: ObjectId | null;
  withdrawalMethod?: ObjectId | null;
  response?: string;
  reason?: string;
  remark?: string;
  isRetrieveFund: boolean;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const FundTransactionSchema = new Schema<FundTransaction>(
  {
    txUCode: { type: Schema.Types.ObjectId, ref: "User", default: null },
    uCode: { type: Schema.Types.ObjectId, ref: "User", default: null },
    txType: String,
    debitCredit: String,
    fromWalletType: String,
    walletType: String,
    amount: Number,
    txCharge: Number,
    paymentSlip: String,
    txNumber: String,
    uuid: String,
    postWalletBalance: Number,
    currentWalletBalance: Number,
    method: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DepositMethod",
    },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DepositAccount",
    },
    withdrawalAccountType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WithdrawalAccountType",
    },
    withdrawalAccount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserWithdrawalAccount",
    },
    withdrawalMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WithdrawalMethod",
    },
    response: String,
    reason: String,
    remark: String,
    isRetrieveFund: { type: Boolean, default: false },
    status: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "fundTransactions" } // Explicitly set collection name
);

// Indexes for common queries
FundTransactionSchema.index({ uCode: 1, txType: 1 });
FundTransactionSchema.index({ createdAt: -1 });
// Ensure the model is registered with the correct collection
const FundTransactionModel =
  mongoose.models.FundTransaction ||
  mongoose.model<FundTransaction>("FundTransaction", FundTransactionSchema);

const COLLECTION_NAME = "fundTransactions";

// Log to verify collection names
console.log(
  "Mongoose collection:",
  FundTransactionModel.collection.collectionName
);
console.log("Native collection:", COLLECTION_NAME);

export async function createFundTransaction(
  data: Omit<FundTransaction, "_id" | "createdAt" | "updatedAt">
): Promise<FundTransaction> {
  const defaults = {
    isRetrieveFund: false,
    status: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return db.insertOne<FundTransaction>(COLLECTION_NAME, {
    ...defaults,
    ...data,
  });
}

export async function findFundTransactionById(
  id: string
): Promise<FundTransaction | null> {
  return db.findOne<FundTransaction>(COLLECTION_NAME, {
    _id: new ObjectId(id),
  });
}

export async function findFundTransactions(
  query: any = {}
): Promise<FundTransaction[]> {
  return db.findMany<FundTransaction>(COLLECTION_NAME, query);
}

export async function findOne(query: any): Promise<FundTransaction | null> {
  return db.findOne<FundTransaction>(COLLECTION_NAME, query);
}

export async function updateFundTransaction(
  id: string,
  update: Partial<FundTransaction>
): Promise<void> {
  await db.updateOne(
    COLLECTION_NAME,
    { _id: new ObjectId(id) },
    { $set: { ...update, updatedAt: new Date() } }
  );
}

export async function deleteFundTransaction(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export default FundTransactionModel;
