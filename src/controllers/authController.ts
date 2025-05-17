import { Request, Response, NextFunction } from "express";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import db from "../models";
import UserModel, { User } from "../models/user";
import { deleteOTPByUsername, findOTPByUsername, OTP } from "../models/otp";
import { ApiError } from "../utils/error";
import { ApiResponse } from "../utils/response";
import { sendMessage } from "../utils/whatsapp";
import { generateAndStoreOTP } from "../helpers/otp";
import { signJWT, verifyJWT } from "../helpers/auth";
import common from "../helpers/common";
import AdminUserModel from "../models/adminUser";
import { ERROR_MESSAGES, PASSWORD_REGEX } from "../utils/constant";
import { AuthenticatedRequest } from "../types";
import { cookieOptions } from "../config/cookieOptions";
const { SiweMessage } = require("siwe");

const SALT_ROUNDS = 10;

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await Promise.all([
      db.websiteSettings.findOne({ slug: "registration_fields" }),
      db.websiteSettings.findOne({ slug: "registration_username" }),
      db.websiteSettings.findOne({ slug: "registration_with_otp" }),
      db.websiteSettings.findOne({ slug: "registration_ids_per_email" }),
      db.websiteSettings.findOne({ slug: "registration_ids_per_mobile" }),
      db.websiteSettings.findOne({ slug: "registration_type" }),
      db.websiteSettings.findOne({ slug: "registration_sponsor_require" }),
      db.websiteSettings.findOne({ slug: "registration_username_prefix" }),
      db.websiteSettings.findOne({ slug: "registration_sponsor_active" }),
    ]);

    const [
      fieldsSetting,
      usernameSetting,
      otpSetting,
      emailSetting,
      mobileSetting,
      typeSetting,
      sponsorRequireSetting,
      prefixSetting,
      sponsorActiveSetting,
    ] = settings;

    // 1. Validate fields based on registration_fields setting
    const allowedFields =
      fieldsSetting?.value?.map((field: string) => field.split(":")[0]) || [];
    const bodyFields = Object.keys(req.body);

    const missingFields = allowedFields.filter((f) => !bodyFields.includes(f));
    if (missingFields.length) {
      throw new ApiError(
        400,
        `Missing required fields: ${missingFields.join(", ")}`
      );
    }

    // 2. Handle username
    let username: string;
    if (usernameSetting?.value?.[0] === "yes") {
      username = req.body.username;
      if (!username) throw new ApiError(400, "Username required");
    } else {
      const prefix = prefixSetting?.value?.[0] || "AF";
      const randomNum = Math.floor(
        1000000 + Math.random() * 9000000
      ).toString();
      username = `${prefix}${randomNum}`;
    }

    // 3. Handle OTP
    if (otpSetting?.value?.[0] === "yes") {
      const { otp, contactNumber } = req.body;
      if (!otp) throw new ApiError(400, "OTP required");
      if (!contactNumber)
        throw new ApiError(
          400,
          "Contact number required with country code i.e. 1 | 91 | 97 for OTP"
        );

      // Verify the OTP instead of generating and sending
      const storedOTP = await db.otp.findOTPByUsername(username); // Assuming you have an OTP model/collection
      console.log("storedOTP", storedOTP);
      if (
        !storedOTP ||
        storedOTP.code !== otp ||
        storedOTP.expiresAt < new Date()
      ) {
        throw new ApiError(400, "Invalid or expired OTP");
      }
    }

    // 4. Check registration type
    if (typeSetting?.value?.[0] !== "normal") {
      throw new ApiError(400, "Only normal registration supported currently");
    }

    if (allowedFields.includes("email") && req.body.email) {
      const emailCount = (await db.user.find({ email: req.body.email })).length;
      const maxEmails = parseInt(emailSetting?.value?.[0] || "1"); // Default to 1 if not set
      if (emailCount >= maxEmails) {
        throw new ApiError(
          409,
          `Email has reached maximum usage limit of ${maxEmails}`
        );
      }
    }

    if (allowedFields.includes("contactNumber") && req.body.contactNumber) {
      const mobileCount = (
        await db.user.find({ contactNumber: req.body.contactNumber })
      ).length;
      const maxMobiles = parseInt(mobileSetting?.value?.[0] || "1"); // Default to 1 if not set
      if (mobileCount >= maxMobiles) {
        throw new ApiError(
          409,
          `Contact has reached maximum usage limit of ${maxMobiles}`
        );
      }
    }

    // 5. Handle sponsor
    let sponsorUCode: string;
    if (sponsorRequireSetting?.value?.[0] === "yes") {
      const sponsor = req.body.sponsor;
      if (!sponsor) throw new ApiError(400, "Sponsor required");
      const sponsorUser =
        sponsorActiveSetting?.value?.[0] === "yes"
          ? await db.user.findOne({ username: sponsor, active_status: 1 })
          : await db.user.findOne({ username: sponsor });

      if (!sponsorUser || !sponsorUser._id)
        throw new ApiError(400, "Invalid or inactive sponsor");
      sponsorUCode = sponsorUser._id.toString();
    } else {
      const sponsor = req.body.sponsor;
      let sponsorUser: User | null = null;
      if (sponsor) {
        sponsorUser =
          sponsorActiveSetting?.value?.[0] === "yes"
            ? await db.user.findOne({ username: sponsor, active_status: 1 })
            : await db.user.findOne({ username: sponsor });
      }

      if (!sponsorUser || !sponsorUser._id) {
        const firstUser = await db.user.find({}).then((users) => users[0]);
        if (!firstUser || firstUser.length === 0) {
          sponsorUCode = new ObjectId("000000000000000000000000").toString(); // Default to 0 if no users exist
        } else {
          sponsorUCode = firstUser._id.toString();
        }
      } else {
        sponsorUCode = sponsorUser._id.toString();
      }
    }
    // Validate gender field if present
    if (req.body.gender) {
      const validGenders = ["Male", "Female", "Other"];
      if (!validGenders.includes(req.body.gender)) {
        throw new ApiError(
          400,
          "Invalid gender value. Must be one of: Male, Female, Other"
        );
      }
    } else if (req.body.gender === "") {
      // Handle empty string explicitly
      delete req.body.gender; // Remove empty gender to allow default (null)
    }
    // 6. Hash password if it exists in fields
    const userData = { ...req.body, username, sponsorUCode };
    if (allowedFields.includes("password") && userData.password) {
      userData.password = await bcrypt.hash(userData.password, SALT_ROUNDS);
    }
    // Create user with duplicate username handling
    let newUser;
    let sponsorUser;
    try {
      newUser = await UserModel.create(userData);
      if (!newUser) throw new ApiError(500, "Failed to create user");

      // Update sponsor's downlines
      if (sponsorUCode) {
        sponsorUser = await db.user.findById(sponsorUCode);
        if (sponsorUser) {
          sponsorUser.downlines.push(new ObjectId(newUser._id));
          await sponsorUser.save();
        }
      }
      await db.wallet.create({
        uCode: newUser._id,
        username: newUser.username,
        c1: 0,
        c2: 0,
      });
    } catch (createError: any) {
      if (createError.message === "Duplicate username detected") {
        throw new ApiError(409, "Username already exists");
      }
      throw createError; // Re-throw other creation errors
    }

    // 7. Handle duplicate username
    if (!newUser._id) throw new ApiError(500, "Failed to create user");
    const token = signJWT({
      _id: newUser._id,
      email: newUser.email,
      username: newUser.username,
    });

    // Delete any existing OTP for this username before seding response
    await db.otp.deleteOTPByUsername(username);
    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { user: newUser, token },
          "User registered successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function web3Registration(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    console.log("under the register controller");
    const settings = await Promise.all([
      db.websiteSettings.findOne({ slug: "web3_registration_fields" }),
      db.websiteSettings.findOne({ slug: "registration_username" }),
      db.websiteSettings.findOne({ slug: "web3_registration_with_otp" }),
      db.websiteSettings.findOne({ slug: "registration_ids_per_email" }),
      db.websiteSettings.findOne({ slug: "registration_ids_per_mobile" }),
      db.websiteSettings.findOne({ slug: "registration_type" }),
      db.websiteSettings.findOne({ slug: "registration_sponsor_require" }),
      db.websiteSettings.findOne({ slug: "registration_username_prefix" }),
      db.websiteSettings.findOne({ slug: "registration_sponsor_active" }),
    ]);

    const [
      fieldsSetting,
      usernameSetting,
      otpSetting,
      emailSetting,
      mobileSetting,
      typeSetting,
      sponsorRequireSetting,
      prefixSetting,
      sponsorActiveSetting,
    ] = settings;

    // 1. Validate fields based on registration_fields setting
    const fields =
      fieldsSetting?.value?.map((field: string) => {
        const [key, label] = field.split(":");
        // Check for (Optional) in any case
        const isOptional = /\(optional\)/i.test(label);
        return { key, isOptional };
      }) || [];

    // Only required fields (not marked as optional)
    const allowedFields = fields
      .filter((field) => !field.isOptional)
      .map((field) => field.key);

    const bodyFields = Object.keys(req.body);

    // Check for missing required fields
    const missingFields = allowedFields.filter((f) => !bodyFields.includes(f));
    if (missingFields.length) {
      throw new ApiError(
        400,
        `Missing required fields: ${missingFields.join(", ")}`
      );
    }

    // 2. Handle username
    let username: string;
    if (usernameSetting?.value?.[0] === "yes") {
      username = req.body.username;
      if (!username) throw new ApiError(400, "Username required");
    } else {
      const prefix = prefixSetting?.value || "AF";
      const randomNum = Math.floor(
        1000000 + Math.random() * 9000000
      ).toString();
      username = `${prefix}${randomNum}`;
    }

    // 3. Handle OTP
    if (otpSetting?.value?.[0] === "yes") {
      const { otp, contactNumber } = req.body;
      if (!otp) throw new ApiError(400, "OTP required");
      if (!contactNumber)
        throw new ApiError(
          400,
          "Contact number required with country code i.e. 1 | 91 | 97 for OTP"
        );

      // Verify the OTP instead of generating and sending
      const storedOTP = await db.otp.findOTPByUsername(username); // Assuming you have an OTP model/collection
      console.log("storedOTP", storedOTP);
      if (
        !storedOTP ||
        storedOTP.code !== otp ||
        storedOTP.expiresAt < new Date()
      ) {
        throw new ApiError(400, "Invalid or expired OTP");
      }
    }

    // 4. Check registration type
    if (typeSetting?.value?.[0] !== "web3") {
      throw new ApiError(400, "Only web3 registration supported currently");
    }

    if (allowedFields.includes("email") && req.body.email) {
      const emailCount = (await db.user.find({ email: req.body.email })).length;
      const maxEmails = parseInt(emailSetting?.value?.toString() || "1"); // Default to 1 if not set
      if (emailCount >= maxEmails) {
        throw new ApiError(
          409,
          `Email has reached maximum usage limit of ${maxEmails}`
        );
      }
    }

    if (allowedFields.includes("contactNumber") && req.body.contactNumber) {
      const mobileCount = (
        await db.user.find({ contactNumber: req.body.contactNumber })
      ).length;
      const maxMobiles = parseInt(mobileSetting?.value?.toString() || "1"); // Default to 1 if not set
      if (mobileCount >= maxMobiles) {
        throw new ApiError(
          409,
          `Contact has reached maximum usage limit of ${maxMobiles}`
        );
      }
    }

    // 5. Handle sponsor
    let sponsorUCode: string;
    if (sponsorRequireSetting?.value?.[0] === "yes") {
      const sponsor = req.body.sponsor;
      if (!sponsor) throw new ApiError(400, "Sponsor is required");
      const sponsorUser =
        sponsorActiveSetting?.value?.[0] === "yes"
          ? await db.user.findOne({
              username: sponsor,
              "accountStatus.status": 1,
            })
          : await db.user.findOne({ username: sponsor });

      if (!sponsorUser || !sponsorUser._id)
        throw new ApiError(400, "Invalid or inactive sponsor");
      sponsorUCode = sponsorUser._id.toString();
    } else {
      const sponsor = req.body.sponsor;
      let sponsorUser: User | null = null;
      if (sponsor) {
        sponsorUser =
          sponsorActiveSetting?.value?.[0] === "yes"
            ? await db.user.findOne({
                username: sponsor,
                "accountStatus.status": 1,
              })
            : await db.user.findOne({ username: sponsor });
      }

      if (!sponsorUser || !sponsorUser._id) {
        const firstUser = await db.user.find({}).then((users) => users[0]);
        if (!firstUser || firstUser.length === 0) {
          sponsorUCode = new ObjectId("000000000000000000000000").toString(); // Default to 0 if no users exist
        } else {
          sponsorUCode = firstUser._id.toString();
        }
      } else {
        sponsorUCode = sponsorUser._id.toString();
      }
    }

    // 6. Hash password if it exists in fields
    const userData = { ...req.body, username, sponsorUCode };

    if (allowedFields.includes("password") && userData.password) {
      userData.password = await bcrypt.hash(userData.password, SALT_ROUNDS);
    }
    let newUser;
    let sponsorUser;
    console.log("userData", userData);
    try {
      newUser = await db.user.create(userData);
      if (!newUser) throw new ApiError(500, "Failed to create user");

      // Update sponsor's downlines
      if (sponsorUCode) {
        sponsorUser = await db.user.findById(sponsorUCode);
        if (sponsorUser) {
          sponsorUser.downlines.push(new ObjectId(newUser._id));
          await sponsorUser.save();
        }
      }
      await db.wallet.create({
        uCode: newUser._id,
        username: newUser.username,
        c1: 0,
        c2: 0,
      });
    } catch (createError: any) {
      if (createError.message === "Duplicate username detected") {
        throw new ApiError(409, "Username already exists");
      }
      throw createError; // Re-throw other creation errors
    }

    // 7. Handle duplicate username
    if (!newUser._id) throw new ApiError(500, "Failed to create user");
    const token = signJWT({
      _id: newUser._id,
      email: newUser.email,
      username: newUser.username,
    });

    // Delete any existing OTP for this username before seding response
    await db.otp.deleteOTPByUsername(username);
    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { user: newUser, token },
          "User registered successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await Promise.all([
      db.websiteSettings.findOne({ slug: "login_fields" }),
      db.websiteSettings.findOne({ slug: "login_type" }),
    ]);

    const [fieldsSetting, typeSetting] = settings;

    // 1. Validate fields
    const allowedFields = fieldsSetting?.value?.map(
      (field: string) => field.split(":")[0]
    ) || ["username", "password"];
    const bodyFields = Object.keys(req.body);
    const invalidFields = bodyFields.filter((f) => !allowedFields.includes(f));
    if (invalidFields.length) {
      throw new ApiError(400, `Invalid fields: ${invalidFields.join(", ")}`);
    }

    // 2. Check login type
    if (typeSetting?.value?.[0] !== "normal") {
      throw new ApiError(400, "Only normal login supported currently");
    }

    // 3. Validate credentials
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ApiError(400, "Username and password are required");
    }

    const user = await UserModel.findOne({ username });
    if (!user) {
      throw new ApiError(401, "Invalid username");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || "");
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid password");
    }

    const token = signJWT({
      _id: user._id!,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const { password: userPassword, ...userWithoutPassword } = user.toObject();
    res.cookie("accessToken", token, cookieOptions);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { user: userWithoutPassword, token },
          "Login successful"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function adminLogin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { username, password } = req.body;
  try {
    // Required fields validation
    const requiredFields = ["username", "password"];
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

    // Find admin user by username
    const admin = await AdminUserModel.findOne({ username });
    if (!admin) {
      throw new ApiError(404, "Admin user not found");
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new ApiError(400, "Invalid password");
    }

    // Generate access token
    const token = admin.generateAccessToken();

    // Remove password from response
    const { password: adminPassword, ...adminWithoutPassword } =
      admin.toObject();

    // Send response with cookie and JSON
    // res.cookie("accessToken", token, cookieOptions);

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { admin: adminWithoutPassword, token },
          "Admin Login successful"
        )
      );
  } catch (error) {
    next(error);
  }
}

export async function registerAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { role, username, password, email, amount, status } = req.body;

  try {
    // Required fields validation
    const requiredFields = ["role", "username", "password", "email"];
    const validation = await common.requestFieldsValidation(
      requiredFields,
      req.body
    );

    if (!validation.status) {
      throw new ApiError(
        400,
        `Missing required fields: ${
          validation.missingFields?.join(", ") || "Unknown"
        }`
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      throw new ApiError(400, ERROR_MESSAGES.INVALID_PASSWORD);
    }

    const existingAdmin = await AdminUserModel.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingAdmin) {
      throw new ApiError(
        409,
        existingAdmin.email === email.toLowerCase()
          ? "Email already exists"
          : "Username already exists"
      );
    }
    const hashPassword = await bcrypt.hash(password.trim(), SALT_ROUNDS);

    const newAdmin = await AdminUserModel.create({
      role,
      username,
      password: hashPassword,
      email: email.toLowerCase(),
      amount: amount ?? 0,
      status: status ?? 1,
    });

    const responseData = {
      id: newAdmin._id,
      role: newAdmin.role,
      username: newAdmin.username,
      email: newAdmin.email,
      amount: newAdmin.amount,
      status: newAdmin.status,
      createdAt: newAdmin.createdAt,
    };

    res
      .status(201)
      .json(
        new ApiResponse(201, responseData, "Admin user registered successfully")
      );
  } catch (error) {
    next(error);
  }
}

export async function sendOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Validate request body
    const { username, contactNumber } = req.body;
    if (!username) throw new ApiError(400, "Username is required");

    const mobileNumber = contactNumber.startsWith("+")
      ? contactNumber.slice(1)
      : contactNumber;
    if (!contactNumber)
      throw new ApiError(
        400,
        "Contact number is required with country code i.e. 1 | 91 | 97"
      );
    let uCode = null;
    const userData = await UserModel.findOne({ username });
    if (userData) {
      uCode = userData._id;
    }

    // 2. Check if user exists (optional, depending on your requirements)
    // const user = await db.user.findOne({ username });
    // if (!user) throw new ApiError(404, 'User not found');

    // 3. Generate and store OTP
    const { code: otp, expiresAt } = await generateAndStoreOTP(username, 5); // Using 5 minutes expiry as per your register function

    // 4. Send OTP via WhatsApp (or your messaging service)
    await sendMessage(
      mobileNumber,
      `Your OTP is ${otp}. Valid for 5 minutes.`,
      uCode
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

export async function sendForgotOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Validate request body
    const { username, contactNumber } = req.body;
    if (!username) throw new ApiError(400, "Username is required");

    const mobileNumber = contactNumber.startsWith("+")
      ? contactNumber.slice(1)
      : contactNumber;
    const userData = await UserModel.findOne({
      contactNumber: mobileNumber,
      username,
    });
    if (!userData) throw new ApiError(404, `Incorrect Mobile Number`);
    if (!contactNumber)
      throw new ApiError(
        400,
        "Contact number is required with country code i.e. 1 | 91 | 97"
      );

    // 2. Check if user exists (optional, depending on your requirements)
    // const user = await db.user.findOne({ username });
    // if (!user) throw new ApiError(404, 'User not found');

    // 3. Generate and store OTP
    const otp = await generateAndStoreOTP(username, 5); // Using 5 minutes expiry as per your register function

    // 4. Send OTP via WhatsApp (or your messaging service)
    await sendMessage(
      mobileNumber,
      `Your OTP is ${otp}. Valid for 5 minutes.`,
      userData._id
    );

    // 5. Respond with success
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { username, contactNumber },
          "OTP sent successfully"
        )
      );
  } catch (error) {
    next(error);
  }
}

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.clearCookie("accessToken", cookieOptions);

    res.status(200).json(new ApiResponse(200, {}, "Logged out successfully"));
  } catch (error) {
    next(error);
  }
};

export const impersonation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { userId } = req.body;
  try {
    if (!req.user || req.user.role !== "Admin") {
      throw new ApiError(403, "Unauthorized access");
    }
    if (!userId) {
      throw new ApiError(404, "UserId is Required");
    }
    // Find the user to impersonate
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new ApiError(403, "User not found");
    }
    // Generate a JWT token for the user
    const token = signJWT({
      _id: user._id,
      impersonated: true,
      parentId: user.parentId,
      email: user.email,
      username: user.username,
      role: user.role,
      matrixDetails: user.matrixDetails,
    });

    res
      .status(200)
      .json(new ApiResponse(200, token, "Successfully created token"));
  } catch (error) {
    next(error);
  }
};

export const checkUserToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { token } = req.body;
  try {
    console.log("Check Token", token);
    if (!token) {
      throw new ApiError(404, "Token is required");
    }

    // Verify the token
    let decodedToken;
    try {
      decodedToken = verifyJWT(token);
      // console.log("decodedToken",decodedToken);

      if (!decodedToken?.impersonated) {
        throw new ApiError(403, "You must be an administrator");
      }
    } catch (error) {
      throw new ApiError(403, "Invalid or expired token");
    }

    const user = await UserModel.findById(decodedToken._id).select("-password");
    if (!user) {
      throw new ApiError(403, "User not found");
    }
    res.cookie("accessToken", token, cookieOptions);

    res
      .status(200)
      .json(
        new ApiResponse(200, { user, token }, "You are successfully logged in")
      );
  } catch (error) {
    next(error);
  }
};

export const checkUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username } = req.body;
    const user = await UserModel.findOne({ username });
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

export async function verifyUserOtp(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { otp, username } = req.body;
  try {
    // 1. Validate request body
    const storedOTP = await findOTPByUsername(username);
    if (!storedOTP) {
      throw new ApiError(400, "Server Error,Please try again");
    }
    if (storedOTP.code !== otp) {
      throw new ApiError(400, "Invalid Otp");
    }

    const now = new Date();
    if (storedOTP.expiresAt < now) {
      await deleteOTPByUsername(username);
      throw new ApiError(400, "Otp is Expired");
    }

    res.status(200).json(new ApiResponse(200, {}, "OTP verified successfully"));
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { password, username } = req.body;
  try {
    const validateFields = ["password", "username"];
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
    const user = await UserModel.findOne({ username });
    if (!user) {
      throw new ApiError(400, "User Not Found");
    }

    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters long");
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const updatedUser = await UserModel.findOneAndUpdate(
      { username },
      { password: hashedPassword }
    );

    res
      .status(200)
      .json(new ApiResponse(200, null, "Password Reset successfully"));
  } catch (error) {
    next(error);
  }
}

export async function changePassword(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Validate request body
    if (!req.body || typeof req.body !== "object") {
      throw new ApiError(400, "Invalid request body");
    }

    const { confirmPassword, newPassword, oldPassword } = req.body;
    const trimmed = {
      confirmPassword: confirmPassword?.trim(),
      newPassword: newPassword?.trim(),
      oldPassword: oldPassword?.trim(),
    };

    // Validate required fields
    const validateFields = ["confirmPassword", "newPassword", "oldPassword"];
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

    // Check authentication
    if (!req.user) {
      throw new ApiError(403, "Unauthorized Access");
    }

    const userId = req.user.uCode;
    // Map roles to models
    const roleModelMap: any = {
      Admin: AdminUserModel,
      User: UserModel,
    };
    const model = roleModelMap[req.user.role];
    if (!UserModel) {
      throw new ApiError(400, "Invalid user role");
    }

    // Fetch user
    const user = await model.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Validate old password
    const isOldPasswordValid = await bcrypt.compare(
      trimmed.oldPassword,
      user.password
    );
    if (!isOldPasswordValid) {
      throw new ApiError(400, "Invalid old password");
    }

    // Validate new password
    // if (!PASSWORD_REGEX.test(trimmed.newPassword)) {
    //   throw new ApiError(
    //     400,
    //     "Password must be 8+ characters, include at least one letter, one number, and one special character"
    //   );
    // }

    // Validate confirm password
    if (trimmed.confirmPassword !== trimmed.newPassword) {
      throw new ApiError(400, "Confirm password does not match new password");
    }

    // Hash and save new password
    user.password = await bcrypt.hash(trimmed.newPassword, SALT_ROUNDS);
    await user.save();

    // Log the event (optional)
    console.log(`Password changed for user: ${userId}`);

    res
      .status(200)
      .json(new ApiResponse(200, { userId }, "Password changed successfully"));
  } catch (error) {
    next(error);
  }
}

export async function getNonce(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const nonce = Math.random().toString(36).slice(2);
    req.session.nonce = nonce;

    res
      .status(200)
      .json(new ApiResponse(200, { nonce }, "Password Reset successfully"));
  } catch (error) {
    next(error);
  }
}

export async function verifySiwe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { message, signature } = req.body;

  try {
    // Validate inputs
    if (!message || !signature) {
      throw new ApiError(400, "SIWE message and signature are required");
    }
    if (typeof message !== "string") {
      throw new ApiError(400, "SIWE message must be a string");
    }

    console.log("Received SIWE request:", {
      message,
      signature,
      sessionNonce: req.session.nonce,
      sessionID: req.sessionID,
    });

    // Parse JSON message
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message);
    } catch (error) {
      throw new ApiError(
        400,
        "Invalid SIWE message format: Must be valid JSON"
      );
    }

    // Validate parsed message
    if (!parsedMessage.domain) {
      throw new ApiError(400, "SIWE message domain is required");
    }

    // Create and verify SIWE message
    const siweMessage = new SiweMessage(parsedMessage);
    const { data: fields } = await siweMessage.verify({
      signature,
      nonce: req.session.nonce,
    });

    console.log("Verified SIWE fields:", fields);

    const walletAddress = fields.address;
    const user = await UserModel.findOne({ wallet_address: walletAddress });

    if (!user) {
      console.log("User not found for walletAddress:", walletAddress);
      throw new ApiError(401, "User not registered");
    }

    const token = signJWT({
      _id: user._id!,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const { password: userPassword, ...userWithoutPassword } = user.toObject();
    req.session.nonce = null;
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { user: userWithoutPassword, token },
          "SIWE authentication successful"
        )
      );
  } catch (error) {
    console.error("SIWE verification error:", error);
    next(error);
  }
}

export default {
  register,
  login,
  logout,
  adminLogin,
  registerAdmin,
  impersonation,
  checkUserToken,
  checkUsername,
  sendOtp,
  verifyUserOtp,
  resetPassword,
  changePassword,
  getNonce,
  verifySiwe,
  web3Registration,
};
