import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IPinSettings extends Document {
  slug: string;
  name: string;
  rateMin?: number;
  rateMax?: number;
  type?: "fix" | "range"; 
  roi?: number;
  bv?: number;
  pv?: number;
  gst?: number;
  status?: number;
}

const PinSettingsSchema = new Schema<IPinSettings>(
  {
    slug: { type: String, required: true },
    name: { type: String, required: true },
    rateMin: { type: Number },
    rateMax: { type: Number },
    type: { type: String, enum: ["fix", "range"] }, 
    roi: { type: Number },
    bv: { type: Number },
    pv: { type: Number },
    gst: { type: Number },
    status: { type: Number, default: 1 }, 
  },
  { timestamps: true, collection: "pinSettings" }
);

const PinSettingsModel =
  models.PinSettings || model<IPinSettings>("PinSettings", PinSettingsSchema);

export default PinSettingsModel;
