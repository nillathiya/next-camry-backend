import { Request, Response, NextFunction } from "express";
import NewsEvent, { INewsEvent } from "../models/newsEvent";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import common from "../helpers/common";
import { AuthenticatedRequest } from "../types";

// Create News/Event
export const createNewsEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      title,
      description,
      hotlinks,
      category,
      tags,
      eventDate,
      expiresAt,
    } = req.body;

    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access.");
    }

    const validateFields = ["title", "description", "category"];
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
    const uploadedImages: string[] = [];

    if (Array.isArray(req.files)) {
      uploadedImages.push(
        ...req.files.map((file) => `/uploads/${file.filename}`)
      );
    } else if (req.file) {
      uploadedImages.push(`/uploads/${req.file.filename}`);
    }

    // Convert JSON strings to arrays if needed
    let parsedHotlinks: { label?: string; url?: string }[] = [];
    let parsedTags: string[] = [];

    try {
      parsedHotlinks = hotlinks ? JSON.parse(hotlinks) : [];
      parsedTags = tags ? JSON.parse(tags) : [];
    } catch (error) {
      throw new ApiError(400, "Invalid JSON format for hotlinks or tags.");
    }

    // Ensure eventDate and expiresAt are valid dates
    const parsedEventDate: Date | null = eventDate ? new Date(eventDate) : null;
    const parsedExpiresAt: Date | null = expiresAt ? new Date(expiresAt) : null;

    if (parsedEventDate && isNaN(parsedEventDate.getTime())) {
      throw new ApiError(400, "Invalid eventDate format.");
    }
    if (parsedExpiresAt && isNaN(parsedExpiresAt.getTime())) {
      throw new ApiError(400, "Invalid expiresAt format.");
    }

    // Create the news event
    const newsEvent = new NewsEvent({
      title,
      description,
      images: uploadedImages,
      hotlinks: parsedHotlinks,
      category,
      tags: parsedTags,
      eventDate: parsedEventDate,
      expiresAt: parsedExpiresAt,
      createdBy: req.user?.uCode,
    });

    await newsEvent.save();

    res
      .status(201)
      .json(
        new ApiResponse(201, newsEvent, "News/Event created successfully.")
      );
  } catch (error) {
    next(error);
  }
};

// Get Published News/Events
export const getPublishedNewsEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tag, category } = req.body;
    const filter: { published: boolean; tags?: string; category?: string } = {
      published: true,
    };

    if (tag) filter.tags = tag;
    if (category) filter.category = category;

    const newsEvents: INewsEvent[] = await NewsEvent.find(filter).sort({
      createdAt: -1,
    });
    res
      .status(200)
      .json(new ApiResponse(200, newsEvents, "News/Event get successfully"));
  } catch (error) {
    next(error);
  }
};

// Get All News/Events
export const getAllNewsEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const newsEvents: INewsEvent[] = await NewsEvent.find({}).sort({
      createdAt: -1,
    });
    res
      .status(200)
      .json(new ApiResponse(200, newsEvents, "News/Event get successfully"));
  } catch (error) {
    next(error);
  }
};

// Get News/Event by ID
export const getNewsEventById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.body;
    const newsEvent: INewsEvent | null = await NewsEvent.findById(id);
    if (!newsEvent) {
      throw new ApiError(404, "News/Event not found");
    }

    // Increase view count
    newsEvent.views += 1;
    await newsEvent.save();

    res
      .status(200)
      .json(new ApiResponse(200, newsEvent, "News/Event get successfully"));
  } catch (error) {
    next(error);
  }
};

// Update News/Event
export const updateNewsEvent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  try {
    const { hotlinks, tags, updateImageIndex, ...updateData } = req.body;
    const newsEvent: INewsEvent | null = await NewsEvent.findById(id);
    if (!newsEvent) {
      throw new ApiError(404, "News/Event not found");
    }

    // Parse `hotlinks` and `tags` safely
    if (hotlinks) {
      updateData.hotlinks = JSON.parse(hotlinks);
    }
    if (tags) {
      updateData.tags = JSON.parse(tags);
    }

    // Parse updateImageIndex from the request body
    const updateImageIndices: number[] = JSON.parse(updateImageIndex || "[]");
    const uploadedImages: string[] = [...newsEvent.images];
    // first, coerce to a proper array
    const filesArray: Express.Multer.File[] = Array.isArray(req.files)
      ? req.files
      : [];

    // now you can safely check length and iterate
    if (filesArray.length > 0) {
      filesArray.forEach((file, index) => {
        const relativePath = `/uploads/${file.filename}`;
        const updateImageIndex = updateImageIndices[index];

        if (
          typeof updateImageIndex === "number" &&
          updateImageIndex >= 0 &&
          updateImageIndex < uploadedImages.length
        ) {
          uploadedImages[updateImageIndex] = relativePath;
        } else {
          uploadedImages.push(relativePath);
        }
      });
    }

    // Assign updated images back to the newsEvent
    updateData.images = uploadedImages;
    Object.assign(newsEvent, updateData);
    await newsEvent.save();

    res.status(200).json(new ApiResponse(200, newsEvent, "News/Event updated"));
  } catch (error) {
    next(error);
  }
};

// Delete News/Event
export const deleteNewsEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.body;
    const newsEvent: INewsEvent | null = await NewsEvent.findByIdAndDelete(id);
    if (!newsEvent) {
      throw new ApiError(404, "News/Event not found");
    }

    res.status(200).json(new ApiResponse(200, {}, "News/Event Deleted"));
  } catch (error) {
    next(error);
  }
};

// Toggle Publish Status
export const togglePublishStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.body;
    const newsEvent: INewsEvent | null = await NewsEvent.findById(id);
    if (!newsEvent) {
      throw new ApiError(404, "News/Event not found");
    }

    newsEvent.published = !newsEvent.published;
    await newsEvent.save();

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {},
          `News/Event ${newsEvent.published ? "published" : "unpublished"}`
        )
      );
  } catch (error) {
    next(error);
  }
};
