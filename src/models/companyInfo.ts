import mongoose, { Schema, Document, model, Model } from "mongoose";
import { ObjectId } from "mongodb";

// Interface for CompanyInfo document
interface ICompanyInfo extends Document {
  _id: ObjectId;
  name: string;
  title: string;
  slug: string;
  type: string;
  value?: string;
  description?: string;
  adminStatus: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Schema definition
const CompanyInfoSchema: Schema = new Schema<ICompanyInfo>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["image", "file", "string", "number"],
      trim: true,
    },
    value: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
    adminStatus: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: "companyinfos",
  }
);

// Create unique indexes
CompanyInfoSchema.index({ slug: 1 }, { unique: true, sparse: true });

// Create and export the model
const CompanyInfo: Model<ICompanyInfo> =
  mongoose.models.CompanyInfo ||
  model<ICompanyInfo>("CompanyInfo", CompanyInfoSchema);

export default CompanyInfo;
