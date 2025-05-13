import { Response, NextFunction, Request } from "express";
import axios from "axios";
import db from "../models";
import { getWalletBalanceBySlug } from "../helpers/wallet";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import UserModel, { User } from "../models/user";
import WalletModel, { IWallet } from "../models/wallet";
import {
  AuthenticatedRequest,
  IApiResponse,
  IGetUserDirectsQuery,
  OrderFilter,
  OrderResponse,
} from "../types";
import PinSettingsModel from "../models/pinSettings";
import OrderModel from "../models/order";
import walletHelper from "../helpers/wallet";
import FundTransactionModel from "../models/fundTransaction";
import common from "../helpers/common";
import depositMethod from "../models/depositMethod";
import { findWalletSettings } from "../models/walletSettings";
import { deleteOTPByUsername, findOTPByUsername, OTP } from "../models/otp";
import { generateAndStoreOTP } from "../helpers/otp";
import { sendMessage } from "../utils/whatsapp";
import { getUserHierarchy } from "../helpers/userHierarchyHelper";
import bcrypt from "bcrypt";
import { signJWT, verifyJWT } from "../helpers/auth";
import { fetchUserSettingsBySlug } from "../helpers/settings";
import { isValidObjectId } from "mongoose";
import { ObjectId } from "mongodb";

const SALT_ROUNDS = 10;

export async function adminRegister(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, name, email, password, sponsor, wallet_address } =
      req.body;

    // 1. Validate required fields
    if (!username || !password) {
      throw new ApiError(400, "Required fields: username, email, password");
    }

    // 2. Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, "Invalid email address");
    }

    // 3. Validate wallet address format if provided
    if (wallet_address) {
      const walletRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletRegex.test(wallet_address)) {
        throw new ApiError(400, "Invalid Ethereum wallet address");
      }
    }

    // 4. Check for duplicate username or email
    const existingUser = await UserModel.findOne({
      $or: [{ username }, { email }],
    });
    if (existingUser) {
      throw new ApiError(
        409,
        existingUser.username.toLowerCase().trim() ===
        username.toLowerCase().trim()
          ? "Username already exists"
          : "Email already exists"
      );
    }

    // 5. Handle sponsor
    let sponsorUCode: string;
    if (sponsor) {
      const sponsorUser = await UserModel.findOne({
        username: sponsor,
      });
      if (!sponsorUser || !sponsorUser._id) {
        throw new ApiError(400, "Invalid sponsor username");
      }
      sponsorUCode = sponsorUser._id.toString();
    } else {
      const firstUser = await UserModel.findOne(); // No need to fetch all users
      sponsorUCode = firstUser?._id.toString() ?? "";
    }

    // 6. Hash password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // 7. Prepare user data
    const userData: Omit<User, "_id" | "createdAt" | "updatedAt"> = {
      username,
      email,
      password: hashedPassword,
      sponsorUCode,
      name: username, // Default name to username
      role: "User",
      kycStatus: 2,
      status: 1,
      withdraw_status: 1,
      position: 0,
      accountStatus: {
        activeId: 0,
        activeStatus: 0,
        blockStatus: 0,
      },
      ...(wallet_address && { wallet_address: wallet_address }), // Include wallet_address only if provided
    };

    // 8. Create user
    const newUser = await UserModel.create(userData);
    if (!newUser._id) {
      throw new ApiError(500, "Failed to create user");
    }
    // Update sponsor's downlines
    let sponsorUser;
    if (sponsorUCode) {
      sponsorUser = await db.user.findById(sponsorUCode);
      if (sponsorUser) {
        sponsorUser.downlines.push(new ObjectId(newUser._id));
        await sponsorUser.save();
      }
    }

    // 9. Create wallet entry
    await db.wallet.create({
      uCode: newUser._id,
      username: newUser.username,
      c1: 0,
      c2: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 10. Generate JWT token
    const token = signJWT({
      _id: newUser._id,
      email: newUser.email,
      username: newUser.username,
    });

    // 11. Send response
    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { user: newUser, token },
          "User registered successfully by admin"
        )
      );
  } catch (error) {
    next(error);
  }
}
// Profile function
export async function profile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Ensure user is authenticated
    if (!req.user || !req.user.uCode) {
      throw new ApiError(401, "Unauthorized");
    }

    const user = await UserModel.findById(req.user.uCode).lean<User>();
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Exclude sensitive fields
    const { password, ...userData } = user;

    res
      .status(200)
      .json(new ApiResponse(200, userData, "Profile retrieved successfully"));
  } catch (error) {
    next(error);
  }
}

export async function myWallets(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { type } = req.body;
    if (!type) {
      throw new ApiError(400, "Please provide wallet type.");
    }
    // Ensure user is authenticated
    console.log(req.user);
    if (!req.user || !req.user.uCode) {
      throw new ApiError(401, "Unauthorized");
    }

    const user = await UserModel.findById(req.user.uCode);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const walletList = await db.walletSettings.findActiveWalletsByType(type);
    if (!walletList || walletList.length === 0) {
      throw new ApiError(404, "No active wallets found or Invalid type");
    }
    // console.log("walletList:", walletList);

    // Fetch balances and transform the wallet list
    const walletsWithBalance = await Promise.all(
      walletList.map(async (wallet) => {
        const balance = await getWalletBalanceBySlug(
          req.user!.uCode,
          wallet.slug!
        );
        console.log(balance);
        return {
          slug: wallet.slug,
          name: wallet.name,
          balance: balance || 0, // Default to 0 if balance is null/undefined
        };
      })
    );

    console.log("walletsWithBalance:", walletsWithBalance);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          walletsWithBalance,
          "Wallets retrieved successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

// EDIT - Update user profile (partial updates)
export async function editProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      throw new ApiError(
        401,
        "Unauthorized: Invalid or missing user authentication"
      );
    }

    const editProfileSetting = await fetchUserSettingsBySlug(
      "userSettings",
      "edit_profile_with_otp"
    );
    if (
      editProfileSetting &&
      editProfileSetting.value === "yes" &&
      req.user.role === "User"
    ) {
      const { otp } = req.body;
      if (!otp) {
        throw new ApiError(400, "OTP is required for profile update");
      }

      const storedOTP: OTP | null = await findOTPByUsername(req.user.username);
      if (!storedOTP) {
        throw new ApiError(400, "Server Error,Please try again");
      }

      if (storedOTP.code !== otp) {
        throw new ApiError(400, "Invalid OTP");
      }

      const now = new Date();
      if (storedOTP.expiresAt < now) {
        await deleteOTPByUsername(req.user.username); // Remove expired OTP
        throw new ApiError(400, "OTP is expired");
      }
      await deleteOTPByUsername(req.user.username); // Remove expired OTP
    }

    const updateData: any = req.body;
    const userId =
      req.user.role === "Admin" ? updateData.userId : req.user.uCode;

    // Ensure at least one field is provided
    if (!Object.keys(updateData).length && !req.file) {
      throw new ApiError(400, "Please provide at least one field to update");
    }

    // Check if the user exists
    const existingUser = await UserModel.findById(userId);
    if (!existingUser) {
      throw new ApiError(404, "User not found");
    }

    // Prevent updating protected fields (password, role, etc.)
    const protectedFields = [
      "_id",
      "password",
      "resetPasswordToken",
      "walletId",
      "role",
    ];
    protectedFields.forEach((field) => delete updateData[field]);

    if (req.file) {
      updateData.profilePicture = `/uploads/${req.file.filename}`;
    }

    // Update user in the database
    const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).populate("sponsorUCode", "name username");

    if (!updatedUser) {
      throw new ApiError(500, "Failed to update profile");
    }

    // Remove sensitive fields from response
    const { password, resetPasswordToken, ...userData } =
      updatedUser.toObject();

    res
      .status(200)
      .json(new ApiResponse(200, userData, "Profile updated successfully"));
  } catch (error) {
    next(error);
  }
}

export async function createWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId } = req.body;
  try {
    if (!userId) {
      throw new ApiError(404, "UserID is not found");
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const userWallet = await WalletModel.create({ uCode: userId });

    res
      .status(200)
      .json(
        new ApiResponse(200, userWallet, "User Wallet Created Successfully")
      );
  } catch (error) {
    next(error);
  }
}

export async function getUserWallet(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.uCode) {
      throw new ApiError(401, "Unauthorized");
    }

    const user = await db.user.findById(req.user.uCode);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const wallet = await WalletModel.findOne({ uCode: req.user.uCode });
    if (!wallet) {
      throw new ApiError(404, "Wallet not found");
    }
    const walletSettings = await db.walletSettings.findWalletSettings({});
    console.log("walletSettings", walletSettings);
    if (!walletSettings) {
      throw new ApiError(404, "WalletSettings not found");
    }
    const skipFields = ["_id", "username", "createdAt", "updatedAt"];

    const walletObj = wallet.toObject();

    const formWalletData = Object.entries(walletObj)
      .filter(([key]) => !skipFields.includes(key))
      .reduce<Record<string, any>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {} as Record<string, any>);

    const mappedWalletData = walletSettings.reduce<Record<string, number>>(
      (acc, ws) => {
        if (ws.slug && ws.column) {
          acc[ws.slug] = formWalletData[ws.column] || 0;
        }
        return acc;
      },
      {}
    );

    skipFields.forEach((field) => {
      const value = walletObj[field as keyof typeof walletObj];
      if (value !== undefined) {
        mappedWalletData[field] = value;
      }
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          mappedWalletData,
          "User Wallet Retrieve Successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export const checkUsername = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username } = req.body;
    console.log("username",username);
    const user = await UserModel.findOne({ username });
    console.log("user",user);
    if (user) {
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { valid: true, activeStatus: user.activeStatus },
            "check username successfully"
          )
        );
    } else {
      throw new ApiError(404, "Username not found");
    }
  } catch (error) {
    next(error);
  }
};

export const userTopUp = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { username, pinId, amount, txType } = req.body;

  try {
    if (!req.user) {
      throw new ApiError(403, "UnAuthorized Access");
    }

    // Validate required fields
    const requiredFields = ["username", "pinId", "amount", "txType"];
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

    // Fetch pin and user details concurrently
    const [pinDetail, receiverUser] = await Promise.all([
      PinSettingsModel.findById(pinId),
      UserModel.findOne({ username }),
    ]);

    if (!pinDetail) throw new ApiError(400, "Pin not found");
    if (!receiverUser) throw new ApiError(400, "Receiver user not found");

    // Validate amount based on pin type
    if (pinDetail.type === "fix" && amount !== pinDetail.rateMin) {
      throw new ApiError(
        400,
        `Amount must be exactly $${pinDetail.rateMin} for fixed pin`
      );
    }
    if (
      pinDetail.type === "range" &&
      (amount < pinDetail.rateMin || amount > pinDetail.rateMax)
    ) {
      throw new ApiError(
        400,
        `Amount must be between $${pinDetail.rateMin} and $${pinDetail.rateMax}`
      );
    }
    const walletType = pinDetail.walletType || "fund_wallet";
    const isSelfTopUp =
      receiverUser._id.toString() === req.user.uCode.toString();

    const walletTransactionResult = await walletHelper.manageWalletAmounts(
      req.user.uCode,
      walletType,
      -amount
    );

    // Fix: Ensure error condition is correct
    if (!walletTransactionResult.status) {
      throw new ApiError(
        400,
        walletTransactionResult.message || "Transaction failed"
      );
    }

    // Prepare and save order
    const targetUserId = isSelfTopUp ? req.user.uCode : receiverUser._id;
    const lastOrder = await OrderModel.findOne({
      customerId: targetUserId,
    }).sort({ createdAt: -1 });

    const orderPayload = {
      uCode: targetUserId,
      pinId,
      bv: amount,
      amount,
      txType,
      status: 1,
      activeId: lastOrder ? lastOrder.activeId + 1 : 1,
    };

    const newOrder = await new OrderModel(orderPayload).save();
    if (!newOrder) throw new ApiError(400, "Failed to create order");

    // Save transaction record
    const transactionPayload = {
      uCode: req.user.uCode,
      txUCode: isSelfTopUp ? null : receiverUser._id,
      txType: txType === "purchase" ? "topup" : "retopup",
      debitCredit: "DEBIT",
      walletType,
      amount,
      method: "ONLINE",
      state: 1,
      isRetrieveFund: false,
      remark: isSelfTopUp
        ? `${req.user.username} topup of amount $${amount}`
        : `${req.user.username} topup ${receiverUser.username} of amount $${amount}`,
    };

    const newTransaction = await new FundTransactionModel(
      transactionPayload
    ).save();
    if (!newTransaction) throw new ApiError(400, "Failed to save transaction");

    const populatedOrder = {
      uCode: {
        _id: targetUserId,
        username: isSelfTopUp ? req.user.username : receiverUser.username,
        name: isSelfTopUp ? req.user.name : receiverUser.name,
      },
      pinId: { ...pinDetail.toObject() },
      bv: amount,
      amount,
      txType,
      status: 1,
      activeId: (lastOrder?.activeId ?? 0) + 1,
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, populatedOrder, "Top-up completed successfully")
      );
  } catch (error) {
    next(error);
  }
};

export const getOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }

    const filter: OrderFilter = {};
    if (req.user.role === "User") {
      filter.uCode = req.user.uCode;
    }

    const orders = await OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .populate("uCode", "username name")
      .populate("pinId");

    if (!orders || orders.length === 0) {
      res.status(200).json(new ApiResponse(200, [], "No orders found"));
    }

    res
      .status(200)
      .json(new ApiResponse(200, orders, "Orders retrieved successfully"));
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // if (!req.user || req.user.role !== "Admin") {
    //   throw new ApiError(403, "Unauthorized access");
    // }

    const users = await UserModel.find({})
      .populate("sponsorUCode", "username name")
      .sort({ _id: -1 });

    res
      .status(200)
      .json(new ApiResponse(200, users, "Users fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }

    const users = await UserModel.find({})
      .populate("sponsorUCode", "username name")
      .sort({ _id: -1 });

    res
      .status(200)
      .json(new ApiResponse(200, users, "Users fetched successfully"));
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params;
  try {
    const user = await UserModel.findById(id);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    res.status(200).json(new ApiResponse(200, user, "Get user successfully"));
  } catch (error) {
    next(error);
  }
};

export const getUserCryptoDepositAddress = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized access");
    }
    const username = req.user.username;
    console.log("username:", username);
    if (!req.body.chain) {
      throw new ApiError(400, "Missing chain");
    }
    const chain = req.body.chain;
    const methodData = await depositMethod.findDepositMethodBySlug(chain);
    if (!methodData || methodData == null) {
      throw new ApiError(404, "Method not found");
    }
    const response = await axios.post(
      "https://api.ctpeway.com/api/wallet/create",
      { chain, name: username },
      {
        headers: {
          "x-api-key": "b724fa94-163b-4be6-be1f-114bcf99beae",
          "Content-Type": "application/json",
        },
      }
    );
    // console.log("CTPEWAY Response",response.data);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          response.data,
          `user ${chain} deposit address successfully`
        )
      );
  } catch (error) {
    next(error);
  }
};

export async function sendOtpToUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { contactNumber } = req.body;
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }
    // // 1. Validate request body
    // if (!contactNumber)
    //   throw new ApiError(
    //     400,
    //     "Contact number is required with country code i.e. 1 | 91 | 97"
    //   );

    const user = await db.user.findOne({ username: req.user.username });
    if (!user) throw new ApiError(404, "User not found");

    // 2. Validate request body
    if (contactNumber && !/^\d{10,15}$/.test(contactNumber)) {
      throw new ApiError(
        400,
        "Contact number must include country code (e.g., +1, +91) and be 10-15 digits"
      );
    }
    const {
      code: otp,
      expiresAt,
      username,
    } = await generateAndStoreOTP(req.user.username, 5);
    if (!otp) {
      throw new ApiError(500, "Failed to generate OTP");
    }

    // 5. Determine contact number to use
    let targetNumber: string;
    if (contactNumber) {
      targetNumber = contactNumber;
    } else if (user.contactNumber) {
      targetNumber = user.contactNumber.startsWith("+")
        ? user.contactNumber
        : `+${user.contactNumber}`;
    } else {
      throw new ApiError(400, "Contact number not provided or found");
    }

    // 6. Send OTP via messaging service
    await sendMessage(
      targetNumber,
      `Your OTP is ${otp}. Valid for 5 minutes.`,
      user._id
    );

    // 5. Respond with success
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { username, contactNumber, otp, expiresAt },
          "OTP sent successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function sendCriticalOtp(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }
    // 1. Validate request body
    const user = await db.user.findOne({ username: req.user.username });
    if (!user) throw new ApiError(404, "User not found");
    const contactNumber = user.contactNumber;
    if (!contactNumber) {
      throw new ApiError(404, "Contact Number Not Found");
    }
    const { code: otp } = await generateAndStoreOTP(req.user.username, 5);
    await sendMessage(
      contactNumber,
      `Your OTP is ${otp}. Valid for 5 minutes.`,
      user._id
    );
    res.status(200).json(new ApiResponse(200, {}, "OTP sent successfully"));
  } catch (error) {
    next(error);
  }
}

export async function verifyUserOtp(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { otp } = req.body;
  try {
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }
    // 1. Validate request body
    const storedOTP = await findOTPByUsername(req.user.username);
    if (!storedOTP) {
      throw new ApiError(400, "Server Error,Please try again");
    }
    if (storedOTP.code !== otp) {
      throw new ApiError(400, "Invalid Otp");
    }

    const now = new Date();
    if (storedOTP.expiresAt < now) {
      await deleteOTPByUsername(req.user.username); // Remove expired OTP
      throw new ApiError(400, "Otp is Expired");
    }

    res.status(200).json(new ApiResponse(200, {}, "OTP verified successfully"));
  } catch (error) {
    next(error);
  }
}

export const getUserGenerationTree = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { userId, maxDepth = 5 } = req.body;

  try {
    // if (!req.user || req.user.role !== "Admin") {
    //   throw new ApiError(403, "UnAuthorized error");
    // }
    if (!userId) {
      throw new ApiError(400, "userId Not Found");
    }

    // Validate user existence
    const user = await UserModel.findById(userId).select(
      "_id username name uSponsor leftChild rightChild createdAt"
    );
    if (!user) {
      throw new ApiError(404, "User Not Found");
    }
    const allUsers = await getUserHierarchy(user, maxDepth);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          allUsers,
          `User generation hierarchy fetched successfully`
        )
      );
  } catch (error) {
    next(error);
  }
};

export const getUserDirects = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new ApiError(
        403,
        "Forbidden: You cannot access this user's downlines"
      );
    }

    // Safely handle req.query
    const query = req.query as Partial<IGetUserDirectsQuery>;
    const userId = query.userId;
    if (!userId || typeof userId !== "string") {
      throw new ApiError(400, "userId is required and must be a string");
    }

    // Validate userId
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid userId");
    }

    // Validate sort parameters with defaults
    const validSortFields = ["createdAt", "username", "email"];
    const sortBy =
      query.sortBy && validSortFields.includes(query.sortBy)
        ? query.sortBy
        : "createdAt";
    const validSortOrders = ["asc", "desc"];
    const sortOrder =
      query.sortOrder && validSortOrders.includes(query.sortOrder)
        ? query.sortOrder
        : "asc";
    const finalSortOrder = sortOrder === "desc" ? -1 : 1;

    // Parse pagination parameters
    const parsedLimit = query.limit ? parseInt(String(query.limit), 10) : 10;
    const parsedPage = query.page ? parseInt(String(query.page), 10) : 1;
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      throw new ApiError(400, "Invalid limit value");
    }
    if (isNaN(parsedPage) || parsedPage <= 0) {
      throw new ApiError(400, "Invalid page value");
    }
    const skip = (parsedPage - 1) * parsedLimit;

    // Fetch user and populate downlines
    const user = await UserModel.findById(userId).populate({
      path: "downlines",
      select: "-password", // Exclude email for security
      options: {
        skip,
        limit: parsedLimit,
        sort: { [sortBy as string]: finalSortOrder }, // Type assertion
      },
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const downlines = user.downlines || [];
    res
      .status(200)
      .json(
        new ApiResponse(200, downlines, "Downline users fetched successfully")
      );
  } catch (error) {
    next(error);
  }
};

export const checkWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { address } = req.query;

  try {
    if (!address || typeof address !== "string") {
      throw new ApiError(400, "Invalid address");
    }

    const user = await UserModel.findOne({
      wallet_address: address,
    });
    const isRegistered = !!user;

    res
      .status(200)
      .json(
        new ApiResponse(200, isRegistered, `User wallet checked successfully`)
      );
  } catch (error) {
    next(error);
  }
};

export default {
  adminRegister,
  profile,
  myWallets,
  editProfile,
  createWallet,
  getUserWallet,
  checkUsername,
  userTopUp,
  getOrders,
  getUsers,
  getUserById,
  getUserCryptoDepositAddress,
  sendOtpToUser,
  verifyUserOtp,
  getUserGenerationTree,
  getUserDirects,
  sendCriticalOtp,
  checkWallet,
};
