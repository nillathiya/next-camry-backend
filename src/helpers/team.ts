import OrderModel from "../models/order";
import UserModel from "../models/user";

const team = {
    myActiveDirect: async (uCode: string | string[]): Promise<string[] | Record<string, string[]>> => {
        try {
            if (typeof uCode === "string") {
                const users = await UserModel.find({
                    sponsorUCode: uCode,
                    "accountStatus.activeStatus": 1,
                    "accountStatus.blockStatus": 0
                }).select('_id');

                return users.map(user => user._id.toString());
            }

            if (Array.isArray(uCode)) {
                const users = await UserModel.find({
                    sponsorUCode: { $in: uCode },
                    "accountStatus.activeStatus": 1,
                    "accountStatus.blockStatus": 0
                }).select('_id sponsorUCode');

                return users.reduce((acc, user) => {
                    const sponsor = user.sponsorUCode.toString();
                    if (!acc[sponsor]) {
                        acc[sponsor] = [];
                    }
                    acc[sponsor].push(user._id.toString());
                    return acc;
                }, {} as Record<string, string[]>);
            }
            return [];
        } catch (error) {
            console.error('Error in myActiveDirect:', error);
            throw error;
        }
    },

    myDirect: async (uCode: string | string[]): Promise<string[] | Record<string, string[]>> => {
        try {
            if (typeof uCode === "string") {
                const users = await UserModel.find({
                    sponsorUCode: uCode
                }).select('_id');

                return users.map(user => user._id.toString());
            }

            if (Array.isArray(uCode)) {
                const users = await UserModel.find({
                    sponsorUCode: { $in: uCode }
                }).select('_id sponsorUCode');

                return users.reduce((acc, user) => {
                    const sponsor = user.sponsorUCode.toString();
                    if (!acc[sponsor]) {
                        acc[sponsor] = [];
                    }
                    acc[sponsor].push(user._id.toString());
                    return acc;
                }, {} as Record<string, string[]>);
            }

            return [];
        } catch (error) {
            console.error('Error in myDirect:', error);
            throw error;
        }
    },

    myActiveTeam: async (uCode: string, level: number = 10): Promise<Array<Record<string, string[]>>> => {
        try {
            const result: Array<Record<string, string[]>> = [];

            const fetchLevel = async (currentCode: string, currentLevel: number): Promise<boolean> => {
                if (currentLevel > level) return false;

                const users = await team.myActiveDirect(currentCode);
                if (!Array.isArray(users) || users.length === 0) return false;

                result[currentLevel - 1] = { [currentCode]: users };

                let hasNextLevel = false;
                for (const userId of users) {
                    const found = await fetchLevel(userId, currentLevel + 1);
                    hasNextLevel = hasNextLevel || found;
                }

                return true;
            };

            await fetchLevel(uCode, 1);

            return result;
        } catch (error) {
            console.error('Error in myActiveTeam:', error);
            throw error;
        }
    },
    myTeam: async (uCode: string, level: number = 10): Promise<Array<Record<string, string[]>>> => {
        try {
            const result: Array<Record<string, string[]>> = [];

            const fetchLevel = async (currentCode: string, currentLevel: number): Promise<boolean> => {
                if (currentLevel > level) return false;

                const users = await team.myDirect(currentCode);
                if (!Array.isArray(users) || users.length === 0) return false;

                result[currentLevel - 1] = { [currentCode]: users };

                let hasNextLevel = false;
                for (const userId of users) {
                    const found = await fetchLevel(userId, currentLevel + 1);
                    hasNextLevel = hasNextLevel || found;
                }

                return true;
            };

            await fetchLevel(uCode, 1);

            return result;
        } catch (error) {
            console.error('Error in myTeam:', error);
            throw error;
        }
    },
    myActiveUpline: async (uCode: string): Promise<string[]> => {
        try {
            const result: string[] = [];
            let currentCode = uCode;
            while (currentCode) {
                const user = await UserModel.findOne({ _id: currentCode, "accountStatus.activeStatus": 1, "accountStatus.blockStatus": 0 }).select('_id sponsorUCode'); 
                if (!user) break;
                result.push(user._id.toString());
                currentCode = user.sponsorUCode;
            }
            return result;
        } catch (error) {
            console.error('Error in myActiveUpline:', error);
            throw error;
        }
    }
};

export default team;