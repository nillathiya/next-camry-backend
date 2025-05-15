import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import common from "../helpers/common";
import { ApiError } from "../utils/error";
import PinSettingsModel, { IPinSettings } from "../models/pinSettings";
import { AuthenticatedRequest } from "../types";
import OrderModel from "../models/order";
import UserModel from "../models/user";
import { fetchUserSettingsBySlug } from "../helpers/settings";
import FundTransactionModel from "../models/fundTransaction";
import { ApiResponse } from "../utils/response";

export const createTopUp = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const { pinId, amount, username } = req.body;

    try {
        // Validate authenticated user
        if (!req.user) {
            throw new ApiError(403, 'Unauthorized Access');
        }

        // Validate required fields
        const validateFields = ['pinId'];
        const validation = await common.requestFieldsValidation(validateFields, req.body);
        if (!validation.status) {
            throw new ApiError(400, `Missing fields: ${validation.missingFields?.join(', ') || 'Unknown'}`);
        }

        // Fetch receiver user
        const receiverUser = username
            ? await UserModel.findOne({ username }).select('_id username accountStatus uCode')
            : await UserModel.findById(req.user.uCode).select('_id username accountStatus uCode');
        if (!receiverUser) {
            throw new ApiError(400, 'Top-up user not found');
        }

        const isSelfTopUp = req.user.uCode === receiverUser._id.toString();

        // Fetch pin settings
        const pinSetting = await PinSettingsModel.findById(pinId).lean<IPinSettings>();
        if (!pinSetting) {
            throw new ApiError(404, 'Package not found');
        }

        // Determine order amount
        let orderAmount: number;
        if (pinSetting.type === 'fix') {
            if (!pinSetting.rateMin || pinSetting.rateMin <= 0) {
                throw new ApiError(400, 'Invalid package amount');
            }
            orderAmount = pinSetting.rateMin;
        } else if (pinSetting.type === 'range') {
            if (!amount || isNaN(amount)) {
                throw new ApiError(400, 'Amount is required');
            }
            if (amount < (pinSetting.rateMin || 0)) {
                throw new ApiError(400, `Amount must be at least ${pinSetting.rateMin}`);
            }
            if (pinSetting.rateMax && amount > pinSetting.rateMax) {
                throw new ApiError(400, `Amount must not exceed ${pinSetting.rateMax}`);
            }
            orderAmount = amount;
        } else {
            throw new ApiError(400, 'Unsupported pin type');
        }

        // Check if first order
        const isFirstOrder = !(await OrderModel.exists({ uCode: receiverUser._id }));
        // TODO: Implement auto pool entry for first order if required

        // Generate new active ID
        const maxActiveId = await UserModel.find({ 'accountStatus.activeStatus': 1 })
            .select('accountStatus.activeId')
            .then(users => Math.max(...users.map(user => user.accountStatus.activeId || 0), 0));
        const newActiveId = maxActiveId + 1;

        // Fetch wallet settings
        const topUpFundWallet = await fetchUserSettingsBySlug('userSettings', 'topup_fund_wallet');
        if (
            !topUpFundWallet?.value ||
            !Array.isArray(topUpFundWallet.value) ||
            !topUpFundWallet.value[0] ||
            typeof topUpFundWallet.value[0] === 'string' ||
            !('key' in topUpFundWallet.value[0])
        ) {
            throw new ApiError(400, 'Top-up wallet setting not found');
        }
        const walletType = topUpFundWallet.value[0].key;

        // Perform wallet transaction
        const deductUserId = isSelfTopUp ? req.user.uCode : receiverUser._id.toString();
        const walletTransaction = await common.manageWalletAmounts(deductUserId, walletType, -orderAmount);
        if (!walletTransaction.status) {
            throw new ApiError(400, walletTransaction.message || 'Wallet transaction failed');
        }


        // Create order
        const orderPayload = {
            uCode: receiverUser._id,
            pinId: new mongoose.Types.ObjectId(pinId),
            activeId: newActiveId,
            txType: isFirstOrder ? 'topup' : 'retopup',
            bv: orderAmount,
            pv: orderAmount,
            amount: orderAmount,
            status: 1,
        };
        const newOrder = await new OrderModel(orderPayload).save();
        if (!newOrder) {
            throw new ApiError(400, 'Failed to create order');
        }

        // Create transaction record
        const transactionPayload = {
            uCode: receiverUser._id,
            txUCode: req.user.uCode,
            txType: isFirstOrder ? 'topup' : 'retopup',
            debitCredit: 'DEBIT',
            walletType,
            amount: orderAmount,
            state: 1,
            isRetrieveFund: false,
            remark: isSelfTopUp
                ? `${req.user.username} top-up of amount ${orderAmount}`
                : `${req.user.username} top-up for ${receiverUser.username} of amount ${orderAmount}`,
        };
        const newTransaction = await new FundTransactionModel(transactionPayload).save();
        if (!newTransaction) {
            throw new ApiError(400, 'Failed to save transaction');
        }

        // Activate receiver account if needed
        if (receiverUser.accountStatus.activeStatus === 0) {
            await UserModel.updateOne(
                { _id: receiverUser._id },
                { $set: { 'accountStatus.activeStatus': 1, 'accountStatus.activeId': newActiveId } },

            );
        }
        // Fetch the created order for response
        const createdOrder = await OrderModel.findOne({ activeId: newActiveId }).populate("pinId").lean();
        res.status(200).json(new ApiResponse(200, createdOrder, 'Top-up successful'));
    } catch (error) {
        next(error);
    }
};
export default {
    createTopUp,
};
