import { Types } from "mongoose";
import UserModel, { IUserHierarchy, User } from "../models/user";
import { ApiError } from "../utils/error";
import mongoose from "mongoose";
import { fetchAdminSettingsBySlug } from "./settings";

// Type for aggregation result
interface UnilevelHierarchyResult {
  _id: Types.ObjectId;
  username: string;
  name: string;
  sponsorUCode: Types.ObjectId | null;
  planType: "unilevel" | "binary" | "matrix";
  createdAt: Date;
  downline: IUserHierarchy[];
}

// Default maximum depth for full hierarchy (arbitrarily large to approximate no limit)
const DEFAULT_MAX_DEPTH = 1000;

// Fetch unilevel hierarchy using $graphLookup
const getUnilevelHierarchy = async (
  userId: Types.ObjectId,
  maxDepth: number = DEFAULT_MAX_DEPTH
): Promise<IUserHierarchy[]> => {
  const hierarchy = await UserModel.aggregate([
    {
      $match: { _id: userId },
    },
    {
      $graphLookup: {
        from: "users",
        startWith: userId,
        connectFromField: "_id",
        connectToField: "sponsorUCode",
        as: "downline",
        maxDepth: maxDepth - 1, // MongoDB $graphLookup requires non-negative integer
        depthField: "depth",
        restrictSearchWithMatch: { _id: { $ne: userId } },
      },
    },
    {
      $project: {
        downline: {
          $filter: {
            input: "$downline",
            as: "downlineUser",
            cond: { $ne: ["$$downlineUser._id", userId] }, // Exclude root user
          },
        },
      },
    },
    {
      $unwind: { path: "$downline", preserveNullAndEmptyArrays: true },
    },
    {
      $replaceRoot: {
        newRoot: {
          $cond: {
            if: "$downline",
            then: {
              _id: "$downline._id",
              username: "$downline.username",
              name: "$downline.name",
              sponsorUCode: "$downline.sponsorUCode",
              planType: "$downline.planType",
              createdAt: "$downline.createdAt",
              depth: "$downline.depth",
            },
            else: "$$REMOVE",
          },
        },
      },
    },
  ]);

  return hierarchy.filter((item) => item); // Remove null/undefined entries
};

// Fetch binary hierarchy using leftChild and rightChild
const getBinaryHierarchy = async (
  userIds: Types.ObjectId[],
  maxDepth: number = DEFAULT_MAX_DEPTH,
  currentDepth: number = 0
): Promise<IUserHierarchy[]> => {
  if (currentDepth >= maxDepth || !userIds.length) return [];

  const users = await UserModel.find({ _id: { $in: userIds } }).select(
    "_id username name sponsorUCode planType leftChild rightChild createdAt"
  );

  const result: IUserHierarchy[] = [];
  for (const user of users) {
    result.push({
      _id: user._id,
      username: user.username,
      name: user.name,
      sponsorUCode: user.sponsorUCode || null,
      planType: user.planType,
      createdAt: user.createdAt,
      depth: currentDepth,
    });

    const childIds: Types.ObjectId[] = [];
    if (user.leftChild) childIds.push(user.leftChild);
    if (user.rightChild) childIds.push(user.rightChild);

    const children = await getBinaryHierarchy(
      childIds,
      maxDepth,
      currentDepth + 1
    );
    result.push(...children);
  }

  return result;
};

// Main function to fetch hierarchy based on planType
const getUserHierarchy = async (
  user: User,
  maxDepth?: number // Make maxDepth optional
): Promise<IUserHierarchy[]> => {
  const setting = await fetchAdminSettingsBySlug("adminSettings", "plan_type");
  let planType: string | null = null;

  if (setting?.value && Array.isArray(setting.value)) {
    planType = setting.value[0] as string;
  }

  console.log("planType",planType);

  const validPlanTypes = ["universal", "binary", "matrix"] as const;

  if (!planType || !validPlanTypes.includes(planType as any)) {
    throw new ApiError(400, "Invalid planType");
  }
  const effectivePlanType = planType as (typeof validPlanTypes)[number];

  let downline: IUserHierarchy[] = [];
  if (effectivePlanType === "universal") {
    downline = await getUnilevelHierarchy(user._id, maxDepth);
  } else if (effectivePlanType === "binary") {
    downline = await getBinaryHierarchy([user._id], maxDepth, 1);
  } else if (effectivePlanType === "matrix") {
    throw new ApiError(501, "Matrix plan not implemented yet");
  }

  const rootUser = {
    _id: user._id,
    username: user.username,
    name: user.name,
    sponsorUCode: user.sponsorUCode
      ? new mongoose.Types.ObjectId(user.sponsorUCode)
      : null,
    createdAt: user.createdAt,
    depth: 0,
  };

  // Only include root user if not already in downline
  const isRootIncluded = downline.some((u) => u._id.equals(user._id));
  return isRootIncluded ? downline : [rootUser, ...downline];
};

// Placeholder for getUserDirects
const getUserDirects = async (userId: Types.ObjectId): Promise<IUserHierarchy[]> => {
  // Example implementation: Fetch direct downline users
  const directs = await UserModel.find({ sponsorUCode: userId }).select(
    "_id username name sponsorUCode planType createdAt"
  );
  return directs.map((user) => ({
    _id: user._id,
    username: user.username,
    name: user.name,
    sponsorUCode: user.sponsorUCode || null,
    planType: user.planType,
    createdAt: user.createdAt,
    depth: 1,
  }));
};

export { getUserHierarchy, getUserDirects };