import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IOrder extends Document {
  uCode: mongoose.Types.ObjectId; 
  pinId: mongoose.Types.ObjectId; 
  activeId?: number;
  txType?: string;
  bv?: string;
  pv?: string;
  payOutStatus: number;
  amount?: number;
  validity?: number;
  status: number;
  billingAddress?: string;
  shippingAddress?: string;
  orderDate?: Date;
  paymentMethod?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define the Mongoose schema
const OrderSchema = new Schema<IOrder>(
  {
    uCode: { type: Schema.Types.ObjectId, ref: "User", required: true },
    pinId: { type: Schema.Types.ObjectId, ref: "PinSettings", required: true },
    activeId: { type: Number },
    txType: { type: String },
    bv: { type: String },
    pv: { type: String },
    payOutStatus: { type: Number, default: 0 },
    amount: { type: Number },
    validity: { type: Number },
    status: { type: Number, default: 1 },
    billingAddress: { type: String },
    shippingAddress: { type: String },
    orderDate: { type: Date, default: Date.now },
    paymentMethod: { type: String },
  },
  { timestamps: true, collection: "orders" }
);

// Ensure the model isn't recompiled if already defined
const OrderModel = models.Order || model<IOrder>("Order", OrderSchema);

export default OrderModel;
