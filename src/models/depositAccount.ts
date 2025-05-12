// // Deposit Account Model
// import { ObjectId, Collection } from "mongodb";
// import { connectMongoDB } from "../config/db";
// import db from "../helpers/db";

// interface Item {
//   key: string;
//   label: string;
//   image?: string;
//   status: boolean;
// }

// export interface DepositAccount {
//   _id?: ObjectId;
//   name: string;
//   slug: string;
//   methodId: ObjectId; // Reference to DepositMethod
//   type: "auto" | "manual";
//   currencyKey?: string;
//   value?: Item[]; // Optional array of value items
//   status: number;
//   adminStatus: number;
// }

// const DEPOSIT_ACCOUNT_COLLECTION = "depositAccounts";

// // let depositAccountCollection: Collection<DepositAccount> | null = null;
// // async function getDepositAccountCollection(): Promise<
// //   Collection<DepositAccount>
// // > {
// //   if (!depositAccountCollection) {
// //     const dbConn = await connectMongoDB();
// //     depositAccountCollection = dbConn.collection<DepositAccount>(
// //       DEPOSIT_ACCOUNT_COLLECTION
// //     );
// //     await depositAccountCollection.createIndex(
// //       { slug: 1 },
// //       { unique: true, sparse: true }
// //     );
// //     await depositAccountCollection.createIndex({ methodId: 1 }); // Index for methodId
// //   }
// //   return depositAccountCollection;
// // }

// // // Deposit Account CRUD operations
// // export async function createDepositAccount(
// //   data: Omit<DepositAccount, "_id">
// // ): Promise<DepositAccount> {
// //   const defaults = { status: 0, adminStatus: 0 };
// //   try {
// //     return await db.insertOne<DepositAccount>(DEPOSIT_ACCOUNT_COLLECTION, {
// //       ...defaults,
// //       ...data,
// //     });
// //   } catch (error: any) {
// //     if (error.code === 11000) throw new Error("Duplicate slug detected");
// //     throw error;
// //   }
// // }

// // export async function updateDepositAccount(
// //   id: string,
// //   update: Partial<DepositAccount>
// // ): Promise<void> {
// //   delete update.slug; // Prevent slug update
// //   await db.updateOne(
// //     DEPOSIT_ACCOUNT_COLLECTION,
// //     { _id: new ObjectId(id) },
// //     { $set: update }
// //   );
// // }

// // export async function findDepositAccountById(
// //   id: string
// // ): Promise<DepositAccount | null> {
// //   return db.findOne<DepositAccount>(DEPOSIT_ACCOUNT_COLLECTION, {
// //     _id: new ObjectId(id),
// //   });
// // }

// // export async function findDepositAccounts(
// //   query: any = {}
// // ): Promise<DepositAccount[]> {
// //   return db.findMany<DepositAccount>(DEPOSIT_ACCOUNT_COLLECTION, query);
// // }

// // export default {
// //   // Deposit Account exports
// //   createDepositAccount,
// //   updateDepositAccount,
// //   findDepositAccountById,
// //   findDepositAccounts,
// // };



// depositAccountModel.ts
import mongoose, { Schema, Document } from 'mongoose';
import { ObjectId } from 'mongodb';

interface Item {
  key: string;
  label: string;
  image?: string;
  status: boolean;
}

export interface DepositAccount extends Document {
  _id: ObjectId;
  name: string;
  slug: string;
  methodId: ObjectId;
  type: 'auto' | 'manual';
  currencyKey?: string;
  value?: Item[];
  status: number;
  adminStatus: number;
}

const DepositAccountSchema = new Schema<DepositAccount>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    methodId: { type: Schema.Types.ObjectId, ref: 'depositMethod', required: true },
    type: { type: String, enum: ['auto', 'manual','cash'], required: true },
    currencyKey: String,
    value: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        image: String,
        status: { type: Boolean, required: true },
      },
    ],
    status: { type: Number, default: 0 },
    adminStatus: { type: Number, default: 0 },
  },
  { collection: 'depositAccounts', timestamps: true }
);

const DepositAccountModel =
  mongoose.models.DepositAccount ||
  mongoose.model<DepositAccount>('DepositAccount', DepositAccountSchema);

export default DepositAccountModel;