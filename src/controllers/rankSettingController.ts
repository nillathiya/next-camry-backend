import { Request, Response, NextFunction } from "express";
import mongoose, { Types } from "mongoose";
import RankSettings, { IRankSettings } from "../models/rankSettings"; // Adjust path to your model
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import { AuthenticatedRequest } from "../types";
import common from "../helpers/common";
import UserModel from "../models/user";
import businessUtils from "../helpers/business";
import team from "../helpers/team";

// Request body interfaces
interface CreateRankSettingBody {
  title: string;
  value: string[];
}

interface UpdateRankSettingBody {
  title?: string;
  value?: string[];
  slug?: string;
}

interface DeleteRowBody {
  rowIndex: number;
}

interface SaveRowBody {
  rowIndex: number;
  rowData: { slug: string; value: string }[];
}

export const createRankSetting = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { title, value } = req.body as CreateRankSettingBody;

  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    // Required Fields Validation
    const validateFields = ["title", "value"];
    const response = await common.requestFieldsValidation(validateFields, {
      title,
      value,
    });

    if (!response.status) {
      throw new ApiError(
        400,
        `Missing fields: ${response.missingFields?.join(", ")}`
      );
    }

    if (!title || typeof title !== "string") {
      throw new ApiError(400, "Title is required and must be a string");
    }

    const slug = await common.generateSlug(title);

    const newSetting = new RankSettings({ title, slug, value });
    await newSetting.save();

    res
      .status(201)
      .json(
        new ApiResponse(201, newSetting, "Rank setting created successfully")
      );
  } catch (error) {
    next(error);
  }
};

// Update rank setting
export const updateRankSetting = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updatedData = req.body as UpdateRankSettingBody;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    // Required Fields Validation
    const validateFields = ["title", "value"];
    const response = await common.requestFieldsValidation(
      validateFields,
      updatedData
    );

    if (!response.status) {
      throw new ApiError(
        400,
        `Missing fields: ${response.missingFields!.join(", ")}`
      );
    }

    if (updatedData.title) {
      updatedData.slug = await common.generateSlug(updatedData.title);
    }

    const updatedSetting = await RankSettings.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    );

    if (!updatedSetting) {
      throw new ApiError(404, "Rank setting not found");
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedSetting,
          "Rank setting updated successfully"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Get rank settings
export const getRankSettings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filter: { status?: number } = {};
    if (req.query.status) {
      filter.status = Number(req.query.status);
    }

    const rankSettings = await RankSettings.find(filter).sort({
      createdAt: -1,
    });

    res
      .status(200)
      .json(
        new ApiResponse(200, rankSettings, "Rank settings fetched successfully")
      );
  } catch (error) {
    next(error);
  }
};

// Delete rank setting
export const deleteRankSetting = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const setting = await RankSettings.findByIdAndDelete(req.params.id);
    if (!setting) {
      throw new ApiError(404, "Rank setting not found");
    }
    res.status(200).json(new ApiResponse(200, {}, "Rank setting deleted"));
  } catch (error) {
    next(error);
  }
};

// Delete row from all settings
export const deleteRow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rowIndex } = req.body as DeleteRowBody;

    if (typeof rowIndex !== "number" || rowIndex < 0) {
      throw new ApiError(400, "Invalid row index");
    }

    const settings = await RankSettings.find();
    if (!settings.length) {
      throw new ApiError(404, "No settings found");
    }

    settings.forEach((setting: IRankSettings) => {
      if (Array.isArray(setting.value) && rowIndex < setting.value.length) {
        setting.value.splice(rowIndex, 1);
      }
    });

    await Promise.all(
      settings.map(async (setting: IRankSettings) => {
        await setting.save();
      })
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          settings,
          "Row deleted successfully from all settings"
        )
      );
  } catch (error) {
    next(error);
  }
};

// Save row to all settings
export const saveRow = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { rowIndex, rowData } = req.body as SaveRowBody;

    if (typeof rowIndex !== "number" || rowIndex < 0) {
      throw new ApiError(400, "Invalid row index");
    }

    const settings = await RankSettings.find();
    if (!settings.length) {
      throw new ApiError(404, "No settings found");
    }

    settings.forEach((setting: IRankSettings) => {
      rowData.forEach(({ slug, value }) => {
        if (setting.slug === slug) {
          while (setting.value.length <= rowIndex) {
            setting.value.push("");
          }
          setting.value[rowIndex] = value;
        }
      });
    });

    await Promise.all(settings.map((setting: IRankSettings) => setting.save()));

    res
      .status(200)
      .json(new ApiResponse(200, settings, "Row updated successfully"));
  } catch (error) {
    next(error);
  }
};

// Get user rank and team metrics
export const getUserRankAndTeamMetrics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }
    const user = await UserModel.findById(req.user.uCode);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const userId = user._id;

    const rankSettings = await RankSettings.find();
    const selfPackage = await businessUtils.myPackage(userId);
    console.log("selfPackage", selfPackage);

    const myActives = await team.myActiveDirect(userId);
    console.log("myActives", myActives);

    const myDirectTeam = myActives.length;
    const directBusiness = await businessUtils.myActiveDirectBusiness(userId);
    console.log("directBusiness", directBusiness);

    const activeGeneration = await team.myActiveTeam(
      userId,
      5
    );
    console.log("activeGeneration",activeGeneration);
    
    const totalTeamSize = activeGeneration.length;
    const totalTeamBusiness = await businessUtils.myActiveTeamBusiness(userId);
    
    const rankData = {
      rank: user.myRank || 0,
      self_business: selfPackage,
      direct_team: myDirectTeam,
      direct_business: directBusiness,
      total_team_size: totalTeamSize,
      total_team_business: totalTeamBusiness,
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, rankData, "Rank settings fetched successfully")
      );
  } catch (error) {
    next(error);
  }
};
