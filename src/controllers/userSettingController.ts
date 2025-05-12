import { Request, Response, NextFunction } from "express";
import {
  createUserSettings,
  findUserSettingsById,
  findUserSettings,
  findOne,
  updateUserSettings,
  deleteUserSettings,
  UserSettings,
} from "../models/userSettings";
import { ObjectId } from "mongodb";
import common from "../helpers/common";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";


// Helper function to validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

export const createSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const {
      title,
      name,
      slug,
      type,
      options,
      image,
      value,
      status,
      adminStatus,
    } = req.body;

    const validateFields = ["name", "title"];
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

    const settingsData: Omit<UserSettings, "_id"> = {
      title,
      name,
      slug,
      type,
      options,
      image,
      value,
      status: status ?? 0,
      adminStatus: adminStatus ?? 0,
    };

    const newSettings = await createUserSettings(settingsData);
    return res
      .status(201)
      .json(new ApiResponse(201, newSettings, "Settings created successfully"));
  } catch (error: any) {
    next(error);
  }
};

export const getAllSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const settings = await findUserSettings();
    return res
      .status(200)
      .json(new ApiResponse(200, settings, "Settings retrieved successfully"));
  } catch (error: any) {
    next(error);
  }
};

export const getSettingsById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      throw new ApiError(400, "Invalid settings ID");
    }

    const settings = await findUserSettingsById(id);
    if (!settings) {
      throw new ApiError(400, "Settings not found");
    }
    return res
      .status(200)
      .json(new ApiResponse(200, settings, "Settings retrieved successfully"));
  } catch (error: any) {
    next(error);
  }
};

// READ - Find one settings by query (e.g., slug)
export const getSettingsByQuery = async (req: Request, res: Response) => {
  try {
    const { slug } = req.query;

    if (!slug || typeof slug !== "string") {
      return res
        .status(400)
        .json({ message: "Slug query parameter is required" });
    }

    const settings = await findOne({ slug });
    if (!settings) {
      return res.status(404).json({ message: "Settings not found" });
    }

    return res.status(200).json({
      message: "Settings retrieved successfully",
      data: settings,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const updateSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!isValidObjectId(id)) {
      throw new ApiError(400, "Invalid settings ID");
    }

    // Prevent updating _id or slug
    delete updateData._id;
    delete updateData.slug;

    const existingSettings = await findUserSettingsById(id);
    if (!existingSettings) {
      throw new ApiError(400, "Settings not found");
    }

    await updateUserSettings(id, updateData);
    const updatedSettings = await findUserSettingsById(id);

    return res
      .status(200)
      .json(
        new ApiResponse(200, updatedSettings, "Settings updated successfully")
      );
  } catch (error: any) {
    next(error);
  }
};

export const deleteSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      throw new ApiError(400, "Invalid settings ID");
    }

    const existingSettings = await findUserSettingsById(id);
    if (!existingSettings) {
      throw new ApiError(400, "Settings not found");
    }

    await deleteUserSettings(id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Settings deleted successfully"));
  } catch (error: any) {
    next(error);
  }
};

// Export all controller functions
export default {
  createSettings,
  getAllSettings,
  getSettingsById,
  getSettingsByQuery,
  updateSettings,
  deleteSettings,
};
