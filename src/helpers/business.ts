import OrderModel from "../models/order";
import UserModel from "../models/user";
import team from "./team";
import wallet from "./wallet";

const business = {
    myActivePackage: async (uCode: string) => {
        try {
            // sum the bv of all orders with status 1 and payOutStatus 0
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode, status: 1, payOutStatus: 0 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return 0;
            }
            return businessDetails[0].totalAmount;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    myPackage: async (uCode: string) => {
        try {
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode, status: 1 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return 0;
            }
            return businessDetails[0].totalAmount;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    myActiveDirectBusiness: async (uCode: string) => {
        try {
            const myActiveDirect = await team.myActiveDirect(uCode);
            if (myActiveDirect.length === 0) {
                return 0;
            }
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode: { $in: myActiveDirect }, status: 1, payOutStatus: 0 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return 0;
            }
            return businessDetails[0].totalAmount;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    myDirectBusiness: async (uCode: string) => {
        try {
            const myDirect = await team.myDirect(uCode);
            if (myDirect.length === 0) {
                return 0;
            }
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode: { $in: myDirect }, status: 1 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return 0;
            }
            return businessDetails[0].totalAmount;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    myActiveTeamBusiness: async (uCode: string) => {
        try {
            const myActiveTeam = await team.myActiveTeam(uCode);
            if (myActiveTeam.length === 0) {
                return 0;
            }
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode: { $in: myActiveTeam }, status: 1, payOutStatus: 0 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return 0;
            }
            return businessDetails[0].totalAmount;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    myTeamBusiness: async (uCode: string) => {
        try {
            // here we have to sum up for all the levels
            const myTeam = await team.myTeam(uCode);
            if (myTeam.length === 0) {
                return 0;
            }
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode: { $in: myTeam }, status: 1 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return 0;
            }
            return businessDetails[0].totalAmount;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    myLevelBusiness: async (uCode: string, level: number) => {
        // this is somewhat similar to myTeamBusiness but this time we loop through the levels
        // and get the business of each level and return in array format i.e. [level1business, level2business, ...]
        try {
            const myTeam = await team.myTeam(uCode, level);
            if (myTeam.length === 0) {
                return [];
            }
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode: { $in: myTeam }, status: 1 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return [];
            }
            return businessDetails.map((item) => item.totalAmount);
        } catch (error) {
            console.log(error);
            throw error;
        }
        
    },
    myActiveLevelBusiness: async (uCode: string, level: number) => {
        // this is somewhat similar to myTeamBusiness but this time we loop through the levels
        // and get the business of each level and return in array format i.e. [level1business, level2business, ...]
        try {
            const myTeam = await team.myActiveTeam(uCode, level);
            if (myTeam.length === 0) {
                return [];
            }
            const businessDetails = await OrderModel.aggregate([
                { $match: { uCode: { $in: myTeam }, status: 1, payOutStatus: 0 } },
                { $group: { _id: null, totalAmount: { $sum: "$bv" } } },
            ]);
            if (businessDetails.length === 0) {
                return [];
            }
            return businessDetails.map((item) => item.totalAmount);
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    remainingCap: async (uCode: string) => {
        try {
            const myCurrrentUsage = await wallet.getWalletBalanceBySlug(uCode, "capping");
            const myMaxCapPer = await UserModel.findOne({ _id: uCode }).select("capping");
            if (!myMaxCapPer || myMaxCapPer === 0) {
                return 999999999999; // if capping is not set then return max value
            }
            const myTotalCap = Number(business.myPackage(uCode)) * myMaxCapPer / 100;
            return myTotalCap - Number(myTotalCap) - Number(myCurrrentUsage); // myTotalCap - myCurrrentUsage;
        } catch (error) {
            console.log(error);
            throw error;
        }
    }
};

export default business;