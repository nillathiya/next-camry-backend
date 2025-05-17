import mongoose, { Schema, Document } from "mongoose";

export interface IPlan extends Document {
  title: string;
  slug: string;
  value: string[];
  order:number;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    value: [{ type: String }],
    order: { type: Number, required: true, unique: true }, 
  },
  { timestamps: true, collection: "plans" }
);

PlanSchema.index({ order: 1 });

export default mongoose.model<IPlan>("Plan", PlanSchema);
