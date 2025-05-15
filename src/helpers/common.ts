import { ObjectId } from "mongodb";
import UserModel from "../models/user";
import WalletModel, { IWallet } from "../models/wallet";
import walletSettings, { WalletSettings } from "../models/walletSettings";

interface CommonUtils {
  requestFieldsValidation: (
    fields: string[],
    postData: Record<string, any>
  ) => Promise<{ status: boolean; message: string; missingFields?: string[] }>;

  manageWalletAmounts: (
    userId: string,
    slug: string,
    amount: Number
  ) => Promise<{ status: number; message: string }>;

  getBalance: (userId: string, walletSlug: string) => Promise<Number>;

  generateSlug:(title:string)=>Promise<string>;
}

const common: CommonUtils = {
  requestFieldsValidation: async (fields = [], postData = {}) => {
    if (!Array.isArray(fields)) {
      return { status: false, message: "Fields parameter must be an array" };
    }
    if (typeof postData !== "object" || postData === null) {
      return { status: false, message: "postData must be an object" };
    }

    const missingFields = fields.filter(
      (field) => !postData[field]?.toString().trim()
    );

    if (missingFields.length > 0) {
      return {
        status: false,
        message: "Missing required fields",
        missingFields,
      };
    }

    return { status: true, message: "All required fields are present" };
  },

  manageWalletAmounts: async (userId, slug, amount) => {
    try {
      // Ensure amount is always a number
      const amountNumber = Number(amount);

      // Check if amount is a valid number
      if (isNaN(amountNumber)) {
        return {
          status: 0,
          message: "Invalid amount provided. It should be a number.",
        };
      }

      const currentUser = await UserModel.findOne({ _id: userId });
      if (!currentUser) {
        return {
          status: 0,
          message: "User not found",
        };
      }

      const walletSetting = await walletSettings.findOne({
        slug: slug,
      });
      if (!walletSetting || !walletSetting.slug) {
        return {
          status: 0,
          message: "WalletSetting not found",
        };
      }

      const wallet = await WalletModel.findOne({
        uCode: currentUser._id,
      });

      const walletColumn: keyof IWallet = "c1";
      if (!wallet) {
        const walletData = {
          uCode: currentUser._id,
          username: currentUser.username,
          [walletColumn]: amountNumber,
        };
        const newWallet = new WalletModel(walletData);
        const createNewWallet = await newWallet.save();
        if (!createNewWallet) {
          return { status: 0, message: "Wallet not created" };
        }
      } else {
        const oldAmount = wallet[walletColumn];

        let newAmount = oldAmount || 0;
        if (amountNumber > 0) {
          newAmount = oldAmount + amountNumber;
        } else {
          newAmount = oldAmount - Math.abs(amountNumber);
        }

        if (newAmount < 0) {
          return { status: 0, message: "Wallet doesn't have enough Balance" };
        }

        // update wallet
        const walletUpdatedData = {
          [walletColumn]: newAmount,
        };
        const walletUpdatedResponse = await WalletModel.findByIdAndUpdate(
          wallet._id,
          walletUpdatedData,
          {
            new: true,
          }
        );
        if (!walletUpdatedResponse) {
          return { status: 0, message: "Wallet not found" };
        }
      }

      return { status: 1, message: "Records updated successfully." };
    } catch (err: any) {
      return { status: 0, message: err.message || err };
    }
  },

  getBalance: async (uCode, walletSlug) => {
    try {
      const currentUser = await UserModel.findOne({ _id: uCode });
      if (!currentUser) {
        return {
          status: 0,
          message: "User not found",
        };
      }
      const walletSetting = await walletSettings.findOne({ slug: walletSlug });
      // console.log("walletSetting", walletSetting);
      if (!walletSetting) {
        return 0;
      }
      const walletColumn = walletSetting.column as string;
      const wallet = await WalletModel.findOne({
        uCode,
      }).lean();
      if (!wallet) {
        const walletData = {
          uCode: new ObjectId(uCode),
          username: currentUser.username,
        };

        if (!(walletColumn in walletData)) {
          return 0;
        }

        const newWallet = new WalletModel(walletData);
        await newWallet.save();
        return 0;
      }
      return wallet[walletColumn as keyof IWallet] || 0;
    } catch (error) {
      console.error(error);
      return 0;
    }
  },

  generateSlug:async(title:string)=>{
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }
};

export default common;
