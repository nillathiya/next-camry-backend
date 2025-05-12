import mongoose, { Schema, Document, Model } from 'mongoose';
import { ObjectId } from 'mongodb';

// Interface definition
export interface IncomeTransaction extends Document {
  _id: ObjectId;
  txUCode: ObjectId; // Secondary reference to users._id
  uCode: ObjectId; // Primary reference to users._id
  txType?: string;
  walletType?: string;
  source?: string;
  amount?: number;
  txCharge?: number;
  postWalletBalance?: number;
  currentWalletBalance?: number;
  remark?: string;
  response?: string;
  status: number; // 0, 1, 2
  createdAt?: Date;
  updatedAt?: Date;
}

// Schema definition
const IncomeTransactionSchema: Schema<IncomeTransaction> = new Schema(
  {
    txUCode: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    uCode: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true 
    },
    txType: { 
      type: String, 
      trim: true 
    },
    walletType: { 
      type: String, 
      trim: true 
    },
    source: { 
      type: String, 
      trim: true 
    },
    amount: { 
      type: Number, 
      min: 0 
    },
    txCharge: { 
      type: Number, 
      min: 0,
      default: 0
    },
    postWalletBalance: { 
      type: Number, 
      min: 0 
    },
    currentWalletBalance: { 
      type: Number, 
      min: 0 
    },
    remark: { 
      type: String, 
      trim: true 
    },
    response: { 
      type: String, 
      trim: true 
    },
    status: { 
      type: Number, 
      enum: [0, 1, 2], 
      required: true, 
      default: 0 
    },
  },
  {
    timestamps: true, // Automatically handles createdAt and updatedAt
    collection: 'incomeTransactions'
  }
);

// Indexes for better query performance
IncomeTransactionSchema.index({ uCode: 1 });
IncomeTransactionSchema.index({ txUCode: 1 });
IncomeTransactionSchema.index({ status: 1 });
IncomeTransactionSchema.index({ createdAt: -1 });

// Create and export the model
export const IncomeTransactionModel: Model<IncomeTransaction> = mongoose.model(
  'IncomeTransaction', 
  IncomeTransactionSchema
);

export default IncomeTransactionModel;