import business from "../helpers/business";
import wallet from "../helpers/wallet";
import db from "../models";
import IncomeTransactionModel from "../models/incomeTransaction";
import OrderModel from "../models/order";
import PinSettingsModel from "../models/pinSettings";
import UserModel, { User } from "../models/user";
import moment from "moment-timezone";
import WalletSettingsModel from "../models/walletSettings";
import CompanyInfoModel from "../models/companyInfo";
import PlanModel from "../models/plan";
import RankSettingsModel from "../models/rankSettings";
import team from "../helpers/team";
import RankModel from "../models/rank";
import mongoose, { mongo } from "mongoose";
import response from "../utils/response";

const timeZone = process.env.TIME_ZONE || "Asia/Kolkata";
export async function roi(): Promise<any[]> {
    try {
        const orders = await OrderModel.find({ payOutStatus: 0, status: 1 });
        if (orders.length === 0) {
            return [];
        }
        const source = 'roi';
        const wSettings = await WalletSettingsModel.findOne({ slug: source, status: 1 });
        if (!wSettings) {
            throw new Error(`Wallet settings for slug '${source}' not found or not active for users`);
        }
        const currency = await CompanyInfoModel.findOne({ label: 'currency' });
        const incomeWallet = 'main_wallet';
        // fetch createdAt and updatedAt of the ${timeZone} timezone in format of mongodb's Date format
        const createdAt = moment.tz(timeZone).toDate();
        const updatedAt = moment.tz(timeZone).toDate();
        for (const order of orders) {
            const pin = await PinSettingsModel.findById(order.pinId);
            if (!pin) continue; // Skip if pin not found
            const userData = await UserModel.findOne({ _id: order.uCode, "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
            if (!userData) continue; // Skip if user not found
            const amount = order.amount || 0;
            if (amount <= 0) continue; // Skip if amount is not valid
            const roi = pin.roi || 0;
            if (roi <= 0) continue; // Skip if roi is not valid
            let payable = (amount * roi) / 100;
            const remainingCap = await business.remainingCap(userData._id);
            if (remainingCap <= 0 || remainingCap === undefined) continue; // Skip if remaining cap is not valid
            if (payable > remainingCap) {
                payable = remainingCap; // Adjust payable amount to remaining cap
            }
            if (payable < 0) continue; // Skip if payable amount is not valid
            const currentWalletBalance = await wallet.getWalletBalanceBySlug(userData._id, incomeWallet);
            if (currentWalletBalance === null || currentWalletBalance === undefined) continue; // Skip if currentWalletBalance is not valid
            const postWalletBalance = currentWalletBalance + payable;
            // create a IncomeTransaction
            const incomeTransaction = {
                uCode: order.uCode,
                pinId: order.pinId,
                amount: payable,
                walletType: incomeWallet,
                source,
                postWalletBalance,
                currentWalletBalance,
                txType: "income",
                validity: pin.validity,
                response: order._id.toString(),
                remark: `${wSettings.name} of ${currency?.value} ${payable} for order ${order.amount}`,
                status: 1,
                createdAt: createdAt,
                updatedAt: updatedAt,
            };
            const transaction = await IncomeTransactionModel.create(incomeTransaction);
            if (!transaction) continue; // Skip if transaction is not created
            // update wallet balances
            const sourceAdd = await wallet.manageWalletAmounts(userData._id, source, payable);
            if (!sourceAdd || sourceAdd.status === 0) continue; // Skip if sourceAdd is not valid
            const walletAdd = await wallet.manageWalletAmounts(userData._id, incomeWallet, payable);
            if (!walletAdd || walletAdd.status === 0) continue; // Skip if walletAdd is not valid
            // add capping
            await wallet.manageWalletAmounts(userData._id, 'capping', payable);

            // if roi_level is yes in adminSettings then access the level_roi async function
            const adminSettings = "yes";
            if (adminSettings === "yes") {
                // await level_roi(userData, amount, 7);
            }

        }
        return orders;
    } catch (error) {
        console.error("Error in roi function:", error);
        throw error;
    }
}

async function level_roi(userData: any, amount: number, level: number) {
    try {
        const source = 'level_roi';
        const wSettings = await WalletSettingsModel.findOne({ slug: source, status: 1 });
        if (!wSettings) {
            throw new Error(`Wallet settings for slug '${source}' not found or not active for users`);
        }
        const currency = await CompanyInfoModel.findOne({ label: 'currency' });
        // fet the array of plan from PlanModel where slug in level_roi it's value will be an array of percentages
        const plan = await PlanModel.findOne({ slug: 'level_roi' });
        if (!plan) {
            throw new Error(`Plan for slug '${source}' not found or not active for users`);
        }
        const incomeWallet = 'main_wallet';
        // fetch createdAt and updatedAt of the ${timeZone} timezone in format of mongodb's Date format
        const createdAt = moment.tz(timeZone).toDate();
        const updatedAt = moment.tz(timeZone).toDate();
        const txUserData = userData;
        let levelUserData = userData as User;
        // the loop should be from 1 to min(level, plan.value.length)
        for (let i = 1; i <= Math.min(level, plan.value.length); i++) {
            const percentage = plan?.value[i - 1];
            if (!percentage) continue; // Skip if percentage is not valid
            // here we will iterate again and again to get userData of the level using sponsorUCode which gives us again and again new userData
            const user = await UserModel.findOne({ _id: levelUserData.sponsorUCode, "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
            if (!user) continue; // Skip if user is not found
            levelUserData = user as User;
            let payable = (amount * percentage) / 100;
            if (payable <= 0) continue; // Skip if payable amount is not valid
            const remainingCap = await business.remainingCap(user._id);
            if (remainingCap <= 0 || remainingCap === undefined) continue; // Skip if remaining cap is not valid
            if (payable > remainingCap) {
                payable = remainingCap; // Adjust payable amount to remaining cap
            }
            if (payable < 0) continue; // Skip if payable amount is not valid
            const currentWalletBalance = await wallet.getWalletBalanceBySlug(user._id, incomeWallet);
            if (currentWalletBalance === null || currentWalletBalance === undefined) continue; // Skip if currentWalletBalance is not valid
            const postWalletBalance = currentWalletBalance + payable;
            // create a IncomeTransaction
            const incomeTransaction = {
                txUCode: new mongoose.Types.ObjectId(txUserData._id),
                uCode: txUserData._id,
                pinId: txUserData.pinId,
                amount: payable,
                walletType: incomeWallet,
                source,
                postWalletBalance,
                currentWalletBalance,
                txType: "income",
                validity: txUserData.validity,
                response: txUserData._id.toString(),
                remark: `${wSettings.name} of ${currency?.value} ${payable} for level ${i}`,
                status: 1,
                createdAt: createdAt,
                updatedAt: updatedAt,
            };
            const transaction = await IncomeTransactionModel.create(incomeTransaction);
            if (!transaction) continue; // Skip if transaction is not created
            // update wallet balances
            const sourceAdd = await wallet.manageWalletAmounts(user._id, source, payable);
            if (!sourceAdd || sourceAdd.status === 0) continue; // Skip if sourceAdd is not valid
            const walletAdd = await wallet.manageWalletAmounts(user._id, incomeWallet, payable);
            if (!walletAdd || walletAdd.status === 0) continue; // Skip if walletAdd is not valid
            // add capping
            await wallet.manageWalletAmounts(user._id, 'capping', payable);
        }
    } catch (error) {
        console.error("Error in level_roi function:", error);
        throw error;
    }
}

export async function daily_level(): Promise<any[]> {
    try {
        const users = await UserModel.find({ "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
        if (users.length === 0) {
            throw new Error("No active users found");
        }
        const source = 'daily_level';
        const wSettings = await WalletSettingsModel.findOne({ slug: source, status: 1 });
        if (!wSettings) {
            throw new Error(`Wallet settings for slug '${source}' not found or not active for users`);
        }
        const currency = await CompanyInfoModel.findOne({ label: 'currency' });
        // fetch the array of plan from PlanModel where slug in daily_level it's value will be an array of fixed amounts
        const plan = await PlanModel.findOne({ slug: 'daily_level' });
        const planCondition = await PlanModel.findOne({ slug: 'daily_level_req_direct' });
        if (!plan || !planCondition) {
            throw new Error(`Plan for slug '${source}' not found or not active for users`);
        }
        let totalDirectReq = 0;
        for (const user of users) {
            const myUpline = await team.myActiveUpline(user._id);
            if (!myUpline || myUpline.length === 0) continue; // Skip if upline is not found
            // now iterate through the myUpline and get the userData of each upline should be no more than plan.value.length
            for (let i = 0; i < Math.min(myUpline.length, plan.value.length, planCondition.value.length); i++) {
                const upline = myUpline[i];
                const directReq = planCondition.value[i];
                totalDirectReq = directReq + totalDirectReq;
                const uplineId = new mongoose.Types.ObjectId(upline);
                const userData = await UserModel.findOne({ _id: uplineId, "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
                if (!userData) continue; // Skip if user is not found
                const myActiveDirect = await team.myActiveDirect(userData._id);
                // myActiveDirect should be an array of userData._id
                if (!Array.isArray(myActiveDirect) || myActiveDirect.length === 0) continue; // Skip if myActiveDirect is not valid
                if (!myActiveDirect || myActiveDirect.length < directReq) continue; // Skip if active direct is not valid
                const percentage = plan?.value[i];
                if (!percentage) continue; // Skip if percentage is not valid
                let payable = plan.value[i];
                if (payable <= 0) continue; // Skip if payable amount is not valid
                const remainingCap = await business.remainingCap(userData._id);
                if (remainingCap <= 0 || remainingCap === undefined) continue; // Skip if remaining cap is not valid
                if (payable > remainingCap) {
                    payable = remainingCap; // Adjust payable amount to remaining cap
                }
                if (payable < 0) continue; // Skip if payable amount is not valid
                const currentWalletBalance = await wallet.getWalletBalanceBySlug(userData._id, 'main_wallet');
                if (currentWalletBalance === null || currentWalletBalance === undefined) continue; // Skip if currentWalletBalance is not valid
                const postWalletBalance = currentWalletBalance + payable;
                // create a IncomeTransaction
                const incomeTransaction = {
                    txUCode: new mongoose.Types.ObjectId(user._id),
                    uCode: userData._id,
                    pinId: userData.pinId,
                    amount: payable,
                    walletType: 'main_wallet',
                    source,
                    postWalletBalance,
                    currentWalletBalance,
                    txType: "income",
                    validity: userData.validity,
                    response: userData._id.toString(),
                    remark: `${wSettings.name} of ${currency?.value} ${payable} for level ${i}`,
                    status: 1,
                };
                const transaction = await IncomeTransactionModel.create(incomeTransaction);
                if (!transaction) continue; // Skip if transaction is not created
                // update wallet balances
                const sourceAdd = await wallet.manageWalletAmounts(userData._id, source, payable);
                if (!sourceAdd || sourceAdd.status === 0) continue; // Skip if sourceAdd is not valid
                const walletAdd = await wallet.manageWalletAmounts(userData._id, 'main_wallet', payable);
                if (!walletAdd || walletAdd.status === 0) continue; // Skip if walletAdd is not valid
                // add capping
                await wallet.manageWalletAmounts(userData._id, 'capping', payable);
            }
        }
        return users;
    } catch (error) {
        console.error("Error in daily_level function:", error);
        throw error;
    }
}


export async function reward(): Promise<any[]> {
    try {
        const users = await UserModel.find({ "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
        if (users.length === 0) {
            throw new Error("No active users found");
        }
        const source = 'reward';
        const wSettings = await WalletSettingsModel.findOne({ slug: source, status: 1 });
        if (!wSettings) {
            throw new Error(`Wallet settings for slug '${source}' not found or not active for users`);
        }
        const currency = await CompanyInfoModel.findOne({ label: 'currency' });
        // fetch the array of plan from PlanModel where slug in reward it's value will be an array of fixed amounts
        const plan = await RankSettingsModel.findOne({ slug: 'reward' });
        if (!plan) {
            throw new Error(`Plan for slug '${source}' not found or not active for users`);
        }
        const planCondition = await RankSettingsModel.findOne({ slug: 'reward_req_team' });
        if (!planCondition) {
            throw new Error(`Plan condition for slug '${source}' not found or not active for users`);
        }
        for (const user of users) {
            const myActiveTeam = await team.myActiveTeam(user._id);
            if (!myActiveTeam || myActiveTeam.length === 0) continue; // Skip if myActiveTeam is not valid
            // here myActiveTeam is an array <Array<Record<string, string[]>> so we need to count the number of users in each level and make an array again of counts
            const myActiveTeamCount = myActiveTeam.map((item) => {
                const key = Object.keys(item)[0];
                return item[key].length;
            });
            // now we need to run for loop to compare the myActiveTeamCount with planCondition.value
            for (let i = 0; i < Math.min(myActiveTeamCount.length, planCondition.value.length); i++) {
                const checkRankExist = await RankModel.findOne({ uCode: user._id, rank: i + 1 });
                if (checkRankExist) continue; // Skip if rank already exists
                const levelTeamReqCount = Number(planCondition.value[i]);
                const myActiveTeamCountValue = myActiveTeamCount[i];
                if (myActiveTeamCountValue < levelTeamReqCount) continue; // Skip if myActiveTeamCount is not valid
                let payable = Number(plan.value[i]);
                if (payable <= 0) continue; // Skip if payable amount is not valid
                const remainingCap = await business.remainingCap(user._id);
                if (remainingCap <= 0 || remainingCap === undefined) continue; // Skip if remaining cap is not valid
                if (payable > remainingCap) {
                    payable = remainingCap; // Adjust payable amount to remaining cap
                }
                if (payable < 0) continue; // Skip if payable amount is not valid
                const currentWalletBalance = await wallet.getWalletBalanceBySlug(user._id, 'main_wallet');
                if (currentWalletBalance === null || currentWalletBalance === undefined) continue; // Skip if currentWalletBalance is not valid
                const postWalletBalance = currentWalletBalance + payable;
                // create a IncomeTransaction
                const incomeTransaction = {
                    uCode: user._id,
                    pinId: user.pinId,
                    amount: payable,
                    walletType: 'main_wallet',
                    source,
                    postWalletBalance,
                    currentWalletBalance,
                    txType: "income",
                    validity: user.validity,
                    response: user._id.toString(),
                    remark: `${wSettings.name} of ${currency?.value} ${payable} for level ${i}`,
                    status: 1,
                    createdAt: moment.tz(timeZone).toDate(),
                    updatedAt: moment.tz(timeZone).toDate(),
                }
                const transaction = await IncomeTransactionModel.create(incomeTransaction);
                if (!transaction) continue; // Skip if transaction is not created
                const rankCreate = await RankModel.create({
                    uCode: user._id,
                    rank: i+1,
                    isCompleted: true,
                });
                if (!rankCreate) continue; // Skip if rankCreate is not created
                const sourceAdd = await wallet.manageWalletAmounts(user._id, source, payable);
                if (!sourceAdd || sourceAdd.status === 0) continue; // Skip if sourceAdd is not valid
                // update wallet balances
                const walletAdd = await wallet.manageWalletAmounts(user._id, 'main_wallet', payable);
                if (!walletAdd || walletAdd.status === 0) continue; // Skip if walletAdd is not valid
                // add capping
                await wallet.manageWalletAmounts(user._id, 'capping', payable);
            }
        }
        return users;
    } catch (error) {
        console.error("Error in reward function:", error);
        throw error;
    }
}

export async function withdraw_level(uCode: string, amount: number): Promise<any[]> {
    try {
        const user = await UserModel.findOne({ _id: uCode, "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
        if (!user) {
            throw new Error("User not found or inactive");
        }
        const source = 'withdraw_level';
        const wSettings = await WalletSettingsModel.findOne({ slug: source, status: 1 });
        if (!wSettings) {
            throw new Error(`Wallet settings for slug '${source}' not found or not active for users`);
        }
        const currency = await CompanyInfoModel.findOne({ label: 'currency' });
        // fetch the array of plan from PlanModel where slug in withdraw_level it's value will be an array of fixed amounts
        const plan = await PlanModel.findOne({ slug: 'withdraw_level' });
        if (!plan) {
            throw new Error(`Plan for slug '${source}' not found or not active for users`);
        }
        const myActiveUpline = await team.myActiveUpline(user._id);
        if (!myActiveUpline || myActiveUpline.length === 0) return []; // Skip if myActiveUpline is not valid
        // now iterate through the myActiveUpline and get the userData of each upline should be no more than plan.value.length
        for (let i = 0; i < Math.min(myActiveUpline.length, plan.value.length); i++) {
            const upline = myActiveUpline[i];
            const uplineId = new mongoose.Types.ObjectId(upline);
            const userData = await UserModel.findOne({ _id: uplineId, "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
            if (!userData) continue; // Skip if user is not found
            const myActiveDirect = await team.myActiveDirect(userData._id);
            // myActiveDirect should be an array of userData._id
            if (!Array.isArray(myActiveDirect) || myActiveDirect.length === 0) continue; // Skip if myActiveDirect is not valid
            if (!myActiveDirect || myActiveDirect.length < plan.value[i]) continue; // Skip if active direct is not valid
            let payable = (plan.value[i] * amount) / 100;
            if (payable <= 0) continue; // Skip if payable amount is not valid
            const remainingCap = await business.remainingCap(userData._id);
            if (remainingCap <= 0 || remainingCap === undefined) continue; // Skip if remaining cap is not valid
            if (payable > remainingCap) {
                payable = remainingCap; // Adjust payable amount to remaining cap
            }
            if (payable < 0) continue; // Skip if payable amount is not valid
            const currentWalletBalance = await wallet.getWalletBalanceBySlug(userData._id, 'main_wallet');
            if (currentWalletBalance === null || currentWalletBalance === undefined) continue; // Skip if currentWalletBalance is not valid
            const postWalletBalance = currentWalletBalance + payable;
            // create a IncomeTransaction
            const incomeTransaction = {
                txUCode: new mongoose.Types.ObjectId(uCode),
                uCode: userData._id,
                pinId: userData.pinId,
                amount: payable,
                walletType: 'main_wallet',
                source,
                postWalletBalance,
                currentWalletBalance,
                txType: "income",
                validity: userData.validity,
                response: userData._id.toString(),
                remark: `${wSettings.name} of ${currency?.value} ${payable} for level ${i}`,
                status: 1,
                createdAt: moment.tz(timeZone).toDate(),
                updatedAt: moment.tz(timeZone).toDate(),
            }
            const transaction = await IncomeTransactionModel.create(incomeTransaction);
            if (!transaction) continue; // Skip if transaction is not created
            const sourceAdd = await wallet.manageWalletAmounts(userData._id, source, payable);
            if (!sourceAdd || sourceAdd.status === 0) continue; // Skip if sourceAdd is not valid
            // update wallet balances
            const walletAdd = await wallet.manageWalletAmounts(userData._id, 'main_wallet', payable);
            if (!walletAdd || walletAdd.status === 0) continue; // Skip if walletAdd is not valid
            // add capping
            await wallet.manageWalletAmounts(userData._id, 'capping', payable);

        }
        return user;
    } catch (error) {
        console.error("Error in withdraw_level function:", error);
        throw error;
    }
}

export async function growthBooster(): Promise<any[]> {
    try {
        const users = await UserModel.find({ "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 });
        if (users.length === 0) {
            throw new Error("No active users found");
        }
        const source = 'growth_booster';
        const wSettings = await WalletSettingsModel.findOne({ slug: source, status: 1 });
        if (!wSettings) {
            throw new Error(`Wallet settings for slug '${source}' not found or not active for users`);
        }
        const createdAt = moment.tz(timeZone).toDate();
        const updatedAt = moment.tz(timeZone).toDate();
        const currency = await CompanyInfoModel.findOne({ label: 'currency' });
        // fetch the array of plan from PlanModel where slug in growth_booster it's value will be an array of fixed amounts
        const plan = await RankSettingsModel.findOne({ slug: 'growth_booster' });
        if (!plan) {
            throw new Error(`Plan for slug '${source}' not found or not active for users`);
        }
        const planCondition = await RankSettingsModel.findOne({ slug: 'growth_booster_req_level_business' });
        if (!planCondition) {
            throw new Error(`Plan condition for slug '${source}' not found or not active for users`);
        }
        for (const user of users) {
            const myLevelBusiness = await business.myLevelBusiness(user._id, plan.value.length);
            if (!myLevelBusiness || myLevelBusiness.length === 0) continue; // Skip if myLevelBusiness is not valid
            // this will be array of business of each level which we will directly compare with planCondition.value
            for (let i = 0; i < Math.min(myLevelBusiness.length, planCondition.value.length); i++) {
                const levelBusinessReqCount = Number(planCondition.value[i]);
                const myLevelBusinessCount = myLevelBusiness[i];
                if (myLevelBusinessCount < levelBusinessReqCount) continue; // Skip if myLevelBusiness is not valid
                let payable = Number(plan.value[i]);
                if (payable <= 0) continue; // Skip if amount is not valid
                const remainingCap = await business.remainingCap(user._id);
                if (remainingCap <= 0 || remainingCap === undefined) continue; // Skip if remaining cap is not valid
                if (payable > remainingCap) {
                    payable = remainingCap; // Adjust amount to remaining cap
                }
                if (payable < 0) continue; // Skip if amount is not valid
                const currentWalletBalance = await wallet.getWalletBalanceBySlug(user._id, 'main_wallet');
                if (currentWalletBalance === null || currentWalletBalance === undefined) continue; // Skip if currentWalletBalance is not valid
                const postWalletBalance = currentWalletBalance + payable;
                // create a IncomeTransaction
                const incomeTransaction = {
                    uCode: user._id,
                    pinId: user.pinId,
                    amount: payable,
                    walletType: 'main_wallet',
                    source,
                    postWalletBalance,
                    currentWalletBalance,
                    txType: "income",
                    status: 1,
                    response: i.toString(),
                    remark: `${wSettings.name} of ${currency?.value} ${payable} for level ${i}`,
                    createdAt: createdAt,
                    updatedAt: updatedAt,
                };
                const transaction = await IncomeTransactionModel.create(incomeTransaction);
                if (!transaction) continue; // Skip if transaction is not created
                const sourceAdd = await wallet.manageWalletAmounts(user._id, source, payable);
                if (!sourceAdd || sourceAdd.status === 0) continue; // Skip if sourceAdd is not valid
                // update wallet balances
                const walletAdd = await wallet.manageWalletAmounts(user._id, 'main_wallet', payable);
                if (!walletAdd || walletAdd.status === 0) continue; // Skip if walletAdd is not valid
                // add capping
                await wallet.manageWalletAmounts(user._id, 'capping', payable);
            }
        }
        return users;
    } catch (error) {
        console.error("Error in growthBooster function:", error);
        throw error;
    }
}
