import mongoose, { Schema, model, Document, Types } from "mongoose";

// Interface for hotlinks
interface IHotlink {
  label?: string;
  url?: string;
}

// Interface for the NewsEvent document
export interface INewsEvent extends Document {
  title: string;
  description: string;
  images: string[];
  hotlinks: IHotlink[];
  category: "news" | "event";
  tags: string[];
  published: boolean;
  views: number;
  createdBy: Types.ObjectId;
  eventDate?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// NewsEvent Schema
const newsEventSchema = new Schema<INewsEvent>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: [
      {
        type: String,
      },
    ],
    hotlinks: [
      {
        label: String,
        url: String,
      },
    ],
    category: {
      type: String,
      enum: ["news", "event"],
      required: true,
    },
    tags: [
      {
        type: String,
      },
    ],
    published: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    eventDate: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

export default model<INewsEvent>("NewsEvent", newsEventSchema);
