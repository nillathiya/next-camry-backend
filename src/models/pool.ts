import { ObjectId } from "mongodb";
import mongoose, { Document, Schema, Model } from "mongoose";

export interface IPool extends Document {
    uCode: ObjectId;
    poolId: string;
    parentId: ObjectId;
    poolType: string;
    poolPosition: number;
}

const PoolSchema: Schema<IPool> = new Schema(
    {
        uCode: { type: Schema.Types.ObjectId, ref: "User", required: true },
        poolId: { type: String, required: true},
        parentId: { type: Schema.Types.ObjectId, ref: "Pool" },
        poolType: { type: String, required: true},
        poolPosition: { type: Number, required: true}
    },
    {
        timestamps: true,
    }
);

const Pool: Model<IPool> = mongoose.model<IPool>(
    "Pools",
    PoolSchema,
    "pools"
);

export default Pool;
