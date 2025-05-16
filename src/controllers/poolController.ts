import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import common from "../helpers/common";
import { ApiError } from "../utils/error";
import PinSettingsModel from "../models/pinSettings";
import { AuthenticatedRequest } from "../types";
import OrderModel from "../models/order";
import PoolModel from '../models/pool';
import { ApiResponse } from "../utils/response";
import UserModel from "../models/user";

export const createNewPool = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { uCode, poolId, parentId, poolType, poolPosition } = req.body;

        if(!req.user || req.user.role!=="Admin"){
            throw new ApiError(403,"Unauthorized access");
        }
        // Required fields validation
        const validateFields = ["uCode", "poolId", "poolPosition", "poolType"];
        const response = await common.requestFieldsValidation(
            validateFields,
            req.body
        );

        if(!mongoose.isValidObjectId(uCode)){
            throw new ApiError(400,"UserId is not valid")
        }

        const user=await UserModel.findById(uCode);
        if(!user){
            throw new ApiError(404,"User Not Found");
        }
        if (!response.status) {
            throw new ApiError(
                400,
                `Missing fields: ${response.missingFields?.join(", ") || "Unknown"}`
            );
        }

        // Create new PinSettings document
        const newPool = new PoolModel({
            uCode, poolId, parentId, poolType, poolPosition
        });

        await newPool.save();

        res.status(200).json(new ApiResponse(200, newPool, "New pool created successfully"));
    } catch (error) {
        next(error);
    }
};

export default {
    createNewPool
};
