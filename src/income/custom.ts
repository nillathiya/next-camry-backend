import mongoose, { mongo } from "mongoose";
import business from "../helpers/business";
import OrderModel from "../models/order";
import UserModel from "../models/user";
import pool from "../helpers/pool";
import PlanModel from "../models/plan";
import IncomeTransactionModel from "../models/incomeTransaction";
import team from "../helpers/team";
import WalletSettingsModel from "../models/walletSettings";
import CompanyInfoModel from "../models/companyInfo";
import moment from "moment-timezone";
import wallet from "../helpers/wallet";

const timeZone = process.env.TIMEZONE || "Asia/Kolkata";


// user deactivation accountStatus.activeStatus changing from 1 to 0 
export async function updateUserStatus() {
    try {
        const currentDate = new Date();
        const users = await UserModel.find({
            "accountStatus.activeStatus": 1,
            "accountStatus.blockStatus": 0,
        });

        if (users.length === 0) {
            console.log("No users found for status update.");
            return;
        }

        for (const user of users) {
            const remainingCap = await business.remainingCap(user.uCode);
            if (remainingCap <= 0) {
                user.accountStatus.activeStatus = 0; // Change activeStatus to 0
            }
            await user.save();
            // make all orders payoutStatus 1 of this user
            await OrderModel.updateMany(
                { uCode: user._id, status: 1, payOutStatus: 0 },
                { $set: { payOutStatus: 1 } }
            );
        }
        console.log(`${users.length} users updated to inactive status.`);
    } catch (error) {
        console.error("Error updating user status:", error);
    }
}


export async function UpdateOrderPayoutStatus() {
    try {
        const users = await UserModel.find({
            "accountStatus.activeStatus": 1,
            "accountStatus.blockStatus": 0,
        });
        if (users.length === 0) {
            console.log("No users found for payout status update.");
            return;
        }
        for (const user of users) {
            const orders = await OrderModel.find({
                uCode: user._id,
                status: 1,
            }).sort({ _id: -1 });
            if (orders.length === 0) {
                console.log(`No orders found for user ${user.uCode}.`);
                continue;
            }
            const userCapPer = user.capping;
            let remainingCap = await business.remainingCap(user._id);
            for (const order of orders) {
                const orderCap = order.amount * userCapPer / 100;
                if (remainingCap > 0) {
                    order.payOutStatus = 0;
                    remainingCap -= orderCap;
                } else {
                    order.payOutStatus = 1;
                }
                await order.save();
            }
        }
    } catch (error) {
        console.error("Error updating order payout status:", error);
    }
}

export async function autopoolIncome(uCode: string | mongoose.Types.ObjectId, poolType: string, pCode: string | mongoose.Types.ObjectId) {
    try {
        const source = `${poolType}_income`;
        const wSettings = await WalletSettingsModel.findOne({ slug: source, status: 1 });
        if (!wSettings) {
            return false;
        }
        const incomeWallet = 'main_wallet';
        const currency = await CompanyInfoModel.findOne({ label: 'currency' });
        const createdAt = moment.tz(timeZone).toDate();
        const updatedAt = moment.tz(timeZone).toDate();
        const userId = new mongoose.Types.ObjectId(uCode);
        const userData = await UserModel.findOne({ _id: userId });
        if (!userData) {
            console.log(`User with ID ${uCode} not found.`);
            return false;
        }
        const parentDetails = await pool.poolParent(pCode) as { uCode: mongoose.Types.ObjectId };
        if (!parentDetails || !parentDetails.uCode) {
            console.log(`Parent details for ID ${pCode} are invalid or missing uCode.`);
            return false;
        }
        if (!parentDetails) {
            console.log(`Parent details for ID ${pCode} not found.`);
            return false;
        }
        const plan = await PlanModel.findOne({ slug: `${poolType}_total_income` });
        if (!plan) {
            console.log(`Plan with slug ${poolType} not found.`);
            return false;
        }
        const planCondition = await PlanModel.findOne({ slug: `${poolType}_req_team` });
        if (!planCondition) {
            console.log(`Plan with slug ${poolType}_req_team not found.`);
            return false;
        }
        const planCondition2 = await PlanModel.findOne({ slug: `${poolType}_req_direct` });
        if (!planCondition2) {
            console.log(`Plan with slug ${poolType}_req_direct not found.`);
            return false;
        }
        const currentPoolTeam = await pool.poolTeam(parentDetails.uCode, poolType);
        for (let i = 0; i < Math.min(planCondition.value.length, planCondition2.value.length, plan.value.length); i++) {
            const user = await UserModel.findOne({ _id: parentDetails.uCode });
            if (!user) {
                console.log(`User with ID ${parentDetails.uCode} not found.`);
                return false;
            }
            // Process user for autopool income
            const teamReq = Number(planCondition.value[i]);
            const directReq = Number(planCondition2.value[i]);
            let payable = Number(plan.value[i]);
            if (payable > user.remainingCap) {
                payable = user.remainingCap;
            }
            const currentLevelTeam = currentPoolTeam[i];
            const currentLevelTeamCount = currentLevelTeam ? currentLevelTeam.length : 0;
            const myDirects = await team.myActiveDirect(parentDetails.uCode.toString());
            const checkTransaction = await IncomeTransactionModel.findOne({ uCode: parentDetails.uCode, response: `${i}`, source: `${poolType}_income` });
            if (checkTransaction) {
                continue;
            }
            if (currentLevelTeamCount >= teamReq && Number(myDirects.length) >= directReq && payable > 0) {
                const currentWalletBalance = await wallet.getWalletBalanceBySlug(parentDetails.uCode.toString(), incomeWallet);
                const postWalletBalance = currentWalletBalance ? currentWalletBalance : 0 + payable;
                // create a IncomeTransaction
                const incomeTransaction = {
                    txUCode: new mongoose.Types.ObjectId(uCode),
                    uCode: parentDetails.uCode,
                    amount: payable,
                    walletType: incomeWallet,
                    source,
                    postWalletBalance,
                    currentWalletBalance,
                    txType: "income",
                    response: `${i}`,
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
                return true;
            }
        }
    } catch (error) {
        console.error("Error updating autopool income:", error);
    }
}