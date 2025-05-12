import mongoose, { Schema, Document } from "mongoose";

export interface IKYC extends Document {
  uCode: mongoose.Schema.Types.ObjectId;
  idProofType: "passport" | "national_id" | "driver_license" | "aadhaar";
  idProofFileFront: string;
  idProofFileBack: string;
  category: "individual" | "business" | "investor";
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

const KYCSchema = new Schema<IKYC>(
  {
    uCode: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    idProofType: {
      type: String,
      enum: ["passport", "national_id", "driver_license", "aadhaar"],
      required: true,
    },
    idProofFileFront: {
      type: String,
      required: true,
    },
    idProofFileBack: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["individual", "business", "investor"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IKYC>("KYC", KYCSchema);
