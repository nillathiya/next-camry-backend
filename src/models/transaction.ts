import { ObjectId } from 'mongodb';
import db from '../helpers/db';

export interface Transaction {
  _id?: ObjectId;
  txUCode: ObjectId; // Secondary reference to users._id
  uCode: ObjectId; // Primary reference to users._id
  txType?: string;
  debitCredit?: string;
  source?: string;
  walletType?: string; // "fund_wallet", "main_wallet"
  autoPoolAmount?: number;
  amount?: number;
  txCharge?: number;
  criptoType?: string;
  criptAddress?: string;
  paymentType?: string;
  paymentSlip?: string;
  tdsStatus: number;
  txsRes?: string;
  tsxStatus?: string;
  txNumber?: string;
  bankDetails?: string;
  panNumber?: string;
  postWalletBalance?: number;
  currentWalletBalance?: number;
  remark?: string;
  distributePar?: string;
  userPrsnt?: string;
  apiResponse?: string;
  txRecord?: string;
  requestAmount?: number;
  paidAmount?: number;
  crypStatus: number;
  crypPaymentId?: string;
  cryptPaymentAmount?: number;
  cryptPaymentWallet?: string;
  cryptExpiryDate?: Date;
  approveDate?: Date;
  txHash?: string;
  reason?: string;
  payoutId?: string;
  paymentId?: string;
  paymentStatus: number;
  status: number; // 0, 1, 2
  method?: string;
  response?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION_NAME = 'transactions';

export async function createTransaction(data: Omit<Transaction, '_id' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
  const defaults = {
    tdsStatus: 0,
    crypStatus: 0,
    paymentStatus: 0,
    status: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return db.insertOne<Transaction>(COLLECTION_NAME, { ...defaults, ...data });
}

export async function findTransactionById(id: string): Promise<Transaction | null> {
  return db.findOne<Transaction>(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export async function findTransactions(query: any = {}): Promise<Transaction[]> {
  return db.findMany<Transaction>(COLLECTION_NAME, query);
}

export async function findOne(query: any): Promise<Transaction | null> {
  return db.findOne<Transaction>(COLLECTION_NAME, query);
}

export async function updateTransaction(id: string, update: Partial<Transaction>): Promise<void> {
  await db.updateOne(COLLECTION_NAME, { _id: new ObjectId(id) }, { $set: { ...update, updatedAt: new Date() } });
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.deleteOne(COLLECTION_NAME, { _id: new ObjectId(id) });
}

export default {
  createTransaction,
  findTransactionById,
  findTransactions,
  findOne,
  updateTransaction,
  deleteTransaction,
};