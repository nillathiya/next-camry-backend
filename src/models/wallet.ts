import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWallet extends Document {
  uCode: mongoose.Types.ObjectId; 
  username?: string;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
  c7: number;
  c8: number;
  c9: number;
  c10: number;
  c11: number;
  c12: number;
  c13: number;
  c14: number;
  c15: number;
  c16: number;
  c17: number;
  c18: number;
  c19: number;
  c20: number;
  c21: number;
  c22: number;
  c23: number;
  c24: number;
  c25: number;
  c26: number;
  c27: number;
  c28: number;
  c29: number;
  c31: number;
  c32: number;
  c33: number;
  c34: number;
  c35: number;
  c36: number;
  c37: number;
  c38: number;
  c39: number;
  c40: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the Wallet schema
const WalletSchema: Schema<IWallet> = new Schema(
  {
    uCode: {
      type: Schema.Types.ObjectId,
      ref: 'User', 
      required: true,
      index: true, 
    },
    username: {
      type: String,
      trim: true,
    },
    c1: { type: Number, default: 0 },
    c2: { type: Number, default: 0 },
    c3: { type: Number, default: 0 },
    c4: { type: Number, default: 0 },
    c5: { type: Number, default: 0 },
    c6: { type: Number, default: 0 },
    c7: { type: Number, default: 0 },
    c8: { type: Number, default: 0 },
    c9: { type: Number, default: 0 },
    c10: { type: Number, default: 0 },
    c11: { type: Number, default: 0 },
    c12: { type: Number, default: 0 },
    c13: { type: Number, default: 0 },
    c14: { type: Number, default: 0 },
    c15: { type: Number, default: 0 },
    c16: { type: Number, default: 0 },
    c17: { type: Number, default: 0 },
    c18: { type: Number, default: 0 },
    c19: { type: Number, default: 0 },
    c20: { type: Number, default: 0 },
    c21: { type: Number, default: 0 },
    c22: { type: Number, default: 0 },
    c23: { type: Number, default: 0 },
    c24: { type: Number, default: 0 },
    c25: { type: Number, default: 0 },
    c26: { type: Number, default: 0 },
    c27: { type: Number, default: 0 },
    c28: { type: Number, default: 0 },
    c29: { type: Number, default: 0 },
    c31: { type: Number, default: 0 },
    c32: { type: Number, default: 0 },
    c33: { type: Number, default: 0 },
    c34: { type: Number, default: 0 },
    c35: { type: Number, default: 0 },
    c36: { type: Number, default: 0 },
    c37: { type: Number, default: 0 },
    c38: { type: Number, default: 0 },
    c39: { type: Number, default: 0 },
    c40: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, 
    collection: 'wallets', 
  }
);



const WalletModel: Model<IWallet> =
  mongoose.models.Wallet || mongoose.model<IWallet>('Wallet', WalletSchema);

export default WalletModel;
