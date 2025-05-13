import mongoose, { Document, Schema, Model } from "mongoose";

export interface IRankSettings extends Document {
  title?: string;
  slug: string;
  type?: string;
  value: string[];
  status: number;
}

const RankSettingsSchema: Schema<IRankSettings> = new Schema({
  title: { type: String, trim: true },
  slug: { type: String, trim: true, unique: true, required: true },
  type: { type: String, trim: true },
  value: { type: [String], trim: true, default: [] },
  status: { type: Number, default: 0 },
});

const RankSettings: Model<IRankSettings> = mongoose.model<IRankSettings>(
  "RankSettings",
  RankSettingsSchema,
  "rankSettings"
);

export default RankSettings;
