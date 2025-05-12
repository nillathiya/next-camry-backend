import { Request, Response, NextFunction } from "express";
import adminSettings from "../models/adminSettings";
import { ObjectId } from "mongodb";
import common from "../helpers/common";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import { AuthenticatedRequest, IAdminSettingsQuery } from "../types";
import { AdminSettings } from "../models/adminSettings";

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

    const settingsData: Omit<AdminSettings, "_id"> = {
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

    const newSettings = await adminSettings.createAdminSetting(settingsData);
    return res
      .status(201)
      .json(new ApiResponse(201, newSettings, "Settings created successfully"));
  } catch (error: any) {
    next(error);
  }
};

export const getAllSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }

    // Determine query based on user role
    let settings;
    if (req.user.role === "User") {
      settings = await adminSettings.findAdminSettings({ status: 1 });
    } else {
      settings = await adminSettings.findAdminSettings({ adminStatus: 1 });
    }

    // Handle case where no settings are found
    if (!settings || settings.length === 0) {
      res.status(200).json(new ApiResponse(200, [], "No settings found"));
    }

    res
      .status(200)
      .json(new ApiResponse(200, settings, "Settings retrieved successfully"));
  } catch (error: any) {
    next(error);
  }
};

export const getSettingsById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      throw new ApiError(400, "Invalid settings ID");
    }

    let settings;
    if (req.user?.role === "User") {
      settings = await adminSettings.findOne({ _id: id, status: 1 });
    } else {
      settings = await adminSettings.findOne({ _id: id, adminStatus: 1 });
    }

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

export const getSettingsByQuery = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }

    const allowedParams = ["slug", "category"];

    const query: IAdminSettingsQuery = {};
    for (const param of allowedParams) {
      if (req.query[param]) {
        if (typeof req.query[param] !== "string") {
          throw new ApiError(400, `Invalid ${param} parameter`);
        }
        query[param] = req.query[param] as string;
      }
    }

    if (Object.keys(query).length === 0) {
      throw new ApiError(400, "At least one valid query parameter is required");
    }

    if (req.user.role === "User") {
      query.status = 1;
    } else {
      query.status = 1;
    }

    console.log("Query",query);
    const settings = await adminSettings.findAdminSettings(query);

    if (!settings || settings.length === 0) {
      res
        .status(200)
        .json(
          new ApiResponse(200, [], "No settings found for the provided query")
        );
      return;
    }

    res
      .status(200)
      .json(new ApiResponse(200, settings, "Settings retrieved successfully"));
  } catch (error: any) {
    next(error);
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

    const existingSettings = await adminSettings.findAdminSettingById(id);
    if (!existingSettings) {
      throw new ApiError(400, "Settings not found");
    }

    await adminSettings.updateAdminSetting(id, updateData);
    const updatedSettings = await adminSettings.findAdminSettingById(id);

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

    const existingSettings = await adminSettings.findAdminSettingById(id);
    if (!existingSettings) {
      throw new ApiError(400, "Settings not found");
    }

    await adminSettings.deleteAdminSetting(id);

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Settings deleted successfully"));
  } catch (error: any) {
    next(error);
  }
};

export default {
  createSettings,
  getAllSettings,
  getSettingsById,
  getSettingsByQuery,
  updateSettings,
  deleteSettings,
};
