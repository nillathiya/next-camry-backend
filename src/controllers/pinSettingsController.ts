import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import common from "../helpers/common";
import { ApiError } from "../utils/error";
import PinSettingsModel from "../models/pinSettings";
import { AuthenticatedRequest } from "../types";
import OrderModel from "../models/order";

export const createPinSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, rateMin, rateMax, roi, bv, pv, gst, type, status } = req.body;

    // Required fields validation
    const validateFields = ["name", "rateMin", "rateMax", "type"];
    const response = await common.requestFieldsValidation(
      validateFields,
      req.body
    );

    if (!response.status) {
      throw new ApiError(
        400,
        `Missing fields: ${response.missingFields?.join(", ") || "Unknown"}`
      );
    }

    // Generate a slug from name (if required)
    const slug = name.toLowerCase().replace(/\s+/g, "-");

    // Create new PinSettings document
    const newSettings = new PinSettingsModel({
      slug,
      name,
      rateMin,
      rateMax,
      roi,
      bv,
      pv,
      gst,
      type,
      status,
    });

    await newSettings.save();

    res.status(201).json({
      success: true,
      message: "PinSettings created successfully",
      data: newSettings,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllPinSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: any = {};

    if (req.user?.role !== "Admin") {
      filter.status = 1;
    }

    

    let packages = await PinSettingsModel.find(filter);

    if (req.user?.role === "User") {
      const order = await OrderModel.findOne({
        userId: req.user.uCode,
      }).sort({ createdAt: -1 });
      // console.log('order', order);
      if (order) {
        const lastPinId = order.PinId;
        const sortedPins = await PinSettingsModel.find({}).sort({ _id: -1 });
          // get only ping which are greater than lastPinId
          packages = sortedPins.filter((pin) => pin._id > lastPinId);
          if(packages.length === 0){
            packages = [sortedPins[0]];
          }
        }
        packages = [packages[0]];
    }
    res.status(200).json({
      success: true,
      message: "Packages retrieved successfully",
      data: packages,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePinSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if the document exists
    const existingPinSettings = await PinSettingsModel.findById(id);
    if (!existingPinSettings) {
      throw new ApiError(404, "PinSettings not found");
    }

    // Update the document
    const updatedPinSettings = await PinSettingsModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "PinSettings updated successfully",
      data: updatedPinSettings,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getAllPinSettings,
  createPinSettings,
  updatePinSettings,
};
