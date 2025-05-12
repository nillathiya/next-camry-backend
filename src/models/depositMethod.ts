// import { ObjectId, Collection } from 'mongodb';
// import { connectMongoDB } from '../config/db';
// import db from '../helpers/db';

// // Common interface for nested items
// interface Item {
//     key: string;
//     label: string;
//     symbol: string;
//     image?: string;
//     status: boolean;
// }

// // Deposit Method Model
// export interface DepositMethod {
//     _id?: ObjectId;
//     name: string;
//     slug: string;
//     currency: Item[]; // Array of currency items
//     status: number;
//     adminStatus: number;
// }

// const DEPOSIT_METHOD_COLLECTION = 'depositMethods';

// let depositMethodCollection: Collection<DepositMethod> | null = null;
// async function getDepositMethodCollection(): Promise<Collection<DepositMethod>> {
//     if (!depositMethodCollection) {
//         const dbConn = await connectMongoDB();
//         depositMethodCollection = dbConn.collection<DepositMethod>(DEPOSIT_METHOD_COLLECTION);
//         await depositMethodCollection.createIndex({ slug: 1 }, { unique: true, sparse: true });
//     }
//     return depositMethodCollection;
// }

// // Deposit Method CRUD operations
// export async function createDepositMethod(data: Omit<DepositMethod, '_id'>): Promise<DepositMethod> {
//     const defaults = { status: 0, adminStatus: 0 };
//     try {
//         return await db.insertOne<DepositMethod>(DEPOSIT_METHOD_COLLECTION, { ...defaults, ...data });
//     } catch (error: any) {
//         if (error.code === 11000) throw new Error('Duplicate slug detected');
//         throw error;
//     }
// }

// export async function updateDepositMethod(id: string, update: Partial<DepositMethod>): Promise<void> {
//     delete update.slug; // Prevent slug update
//     await db.updateOne(DEPOSIT_METHOD_COLLECTION, { _id: new ObjectId(id) }, { $set: update });
// }

// export async function findDepositMethodById(id: string): Promise<DepositMethod | null> {
//     return db.findOne<DepositMethod>(DEPOSIT_METHOD_COLLECTION, { _id: new ObjectId(id) });
// }

// export async function findDepositMethods(query: any = {}): Promise<DepositMethod[]> {
//     return db.findMany<DepositMethod>(DEPOSIT_METHOD_COLLECTION, query);
// }

// export async function findDepositMethodBySlug(slug: string): Promise<DepositMethod | null> {
//     const CurrencyData =  db.findOne<DepositMethod>(DEPOSIT_METHOD_COLLECTION, {
//         "currency": {
//             $elemMatch: {
//                 key: slug,
//                 status: true
//             }
//         }
//     });
//     if (!CurrencyData) {
//         return null;
//     }
//     return CurrencyData;
// }

// export default {
//     // Deposit Method exports
//     createDepositMethod,
//     updateDepositMethod,
//     findDepositMethodById,
//     findDepositMethods,
//     findDepositMethodBySlug,
// };

// depositMethodModel.ts
import mongoose, { Schema, Document, Model } from "mongoose";
import { ObjectId } from "mongodb";

interface Item {
  key: string;
  label: string;
  symbol: string;
  image?: string;
  status: boolean;
}

export interface DepositMethod extends Document {
  _id: ObjectId;
  name: string;
  slug: string;
  currency: Item[];
  status: number;
  adminStatus: number;
}

// Define the static methods interface
interface DepositMethodModel extends Model<DepositMethod> {
  findDepositMethodBySlug(slug: string): Promise<DepositMethod | null>;
}

const DepositMethodSchema = new Schema<DepositMethod>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    currency: [
      {
        key: { type: String, required: true },
        label: { type: String, required: true },
        symbol: { type: String, required: true },
        image: String,
        status: { type: Boolean, required: true },
      },
    ],
    status: { type: Number, default: 0 },
    adminStatus: { type: Number, default: 0 },
  },
  { collection: "depositMethods", timestamps: true }
);

// Define the static method
DepositMethodSchema.statics.findDepositMethodBySlug = async function (
  key: string
): Promise<DepositMethod | null> {
  return this.findOne({
    currency: {
      $elemMatch: {
        key,
        status: true,
      },
    },
  });
};

// Create the model with proper typing
const DepositMethodModel: DepositMethodModel =
  (mongoose.models.depositMethod as DepositMethodModel) ||
  mongoose.model<DepositMethod, DepositMethodModel>(
    "DepositMethod",
    DepositMethodSchema
  );

export default DepositMethodModel;