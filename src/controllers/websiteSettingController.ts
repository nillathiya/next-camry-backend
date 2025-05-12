import { Request, Response, NextFunction } from "express";
import {
  createWebsiteSettings,
  findWebsiteSettingsById,
  findWebsiteSettings,
  findOne,
  updateWebsiteSettings,
  deleteWebsiteSettings,
  WebsiteSettings,
} from "../models/websiteSettings";
import { ObjectId } from "mongodb";
import { ApiResponse } from "../utils/response";
import { AuthenticatedRequest, IWebsiteSettingsQuery } from "../types";
import { ApiError } from "../utils/error";
import common from "../helpers/common";

// Create a new website setting
export async function createWebsiteSetting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Required fields validation
    const requiredFields = ["name", "title", "slug", "type"];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      req.body
    );
    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing fields: ${validation.missingFields?.join(", ") || "Unknown"}`
      );
    }
    const data = req.body as Omit<
      WebsiteSettings,
      "_id" | "createdAt" | "updatedAt"
    >;
    const result = await createWebsiteSettings(data);
    res
      .status(201)
      .json(
        new ApiResponse(201, result, "Website setting created successfully")
      );
  } catch (error) {
    next(error);
  }
}

// Get a specific website setting by ID
export async function getWebsiteSettingsById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const setting = await findWebsiteSettingsById(id);

    if (!setting) {
      res.status(404).json({
        success: false,
        message: "Website setting not found",
      });
      return;
    }

    res
      .status(200)
      .json(new ApiResponse(200, setting, "Website setting get successfully"));
  } catch (error) {
    next(error);
  }
}

// Get all website settings with optional query parameters
export async function getWebsiteSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }
    const query: IWebsiteSettingsQuery = { ...req.query };

    if (req.user.role === "Admin") {
      query.adminStatus = 1;
    } else if (req.user.role === "User") {
      query.status = 1;
    }
    const settings = await findWebsiteSettings(query);
    console.log("settings", settings);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          settings,
          "Website settings retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}
export async function getGlobalWebsiteSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await findWebsiteSettings({ ...req.query, status: 1 });
    res
      .status(200)
      .json(new ApiResponse(200, settings, "Website setting get successfully"));
  } catch (error) {
    next(error);
  }
}

// Find one website setting by specific query
export async function findOneWebsiteSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = req.query;
    const setting = await findOne(query);

    if (!setting) {
      res.status(404).json({
        success: false,
        message: "Website setting not found",
      });
      return;
    }

    res
      .status(200)
      .json(new ApiResponse(200, setting, "Website setting get successfully"));
  } catch (error) {
    next(error);
  }
}

// Update a website setting
export async function updateWebsiteSetting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const update = req.body as Partial<WebsiteSettings>;

    await updateWebsiteSettings(id, update);
    const updatedSettings = await findWebsiteSettingsById(id);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedSettings,
          "Website setting updated successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

// Delete a website setting
export async function deleteWebsiteSetting(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    await deleteWebsiteSettings(id);
    res
      .status(200)
      .json(new ApiResponse(200, {}, "Website setting deleted successfully"));
  } catch (error) {
    next(error);
  }
}

export default {
  createWebsiteSetting,
  getWebsiteSettingsById,
  getWebsiteSettings,
  findOneWebsiteSettings,
  updateWebsiteSetting,
  deleteWebsiteSetting,
  getGlobalWebsiteSettings,
};
