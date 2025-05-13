import PoolModel from '../models/pool';
import mongoose from 'mongoose';
import { fetchAdminSettingsBySlug } from './settings';
import UserModel from '../models/user';
import PinSettingsModel from '../models/pinSettings';

const pool = {
    poolDetail: async (uCode: string | mongoose.Types.ObjectId, poolType: string): Promise<object> => {
        try {
            const poolDetails = await PoolModel.findOne({ uCode: new mongoose.Types.ObjectId(uCode), poolType });
            if (!poolDetails) return {};
            return poolDetails;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
    poolTeam: async (uCode: string | mongoose.Types.ObjectId, poolType: string): Promise<string[] | string[][]> => {
        try {
            let poolTeam: string[][] = []; // Array of uCode arrays grouped by level
            const legsSetting = await fetchAdminSettingsBySlug('adminSettings', 'autopool_legs');
            if (!legsSetting) return [];
            const levelSettings = await fetchAdminSettingsBySlug('adminSettings', 'autopool_levels');
            if (!levelSettings) return [];
            const maxLevels = Number(levelSettings.value);
            if (isNaN(maxLevels) || maxLevels <= 0) return [];

            const userId = typeof uCode === 'string' ? new mongoose.Types.ObjectId(uCode) : uCode;
            const poolDetails = await PoolModel.findOne({ uCode: userId, poolType }).select('_id');
            if (!poolDetails) return [];

            let parentId = [poolDetails._id]; // Array of parent IDs

            for (let i = 0; i < maxLevels; i++) {
                if (parentId.length === 0) break;
                const parent = await PoolModel.find({ _id: { $in: parentId } }).select('uCode _id');
                if (!parent || parent.length === 0) break;

                // Map uCodes for this level
                poolTeam.push(parent.map((item) => item.uCode.toString()));
                // Update parentId for next level
                parentId = parent.map((item) => item._id);
            }

            return poolTeam; // Returns string[][] (array of uCode arrays)
        } catch (error) {
            console.error(`Error fetching pool team for uCode: ${uCode}`, error);
            throw error;
        }
    },

    poolRegister: async (uCode: string | mongoose.Types.ObjectId, poolType: string, parentId: string): Promise<object> => {
        try {
            const legsSetting = await fetchAdminSettingsBySlug('adminSettings', 'autopool_legs');
            if (!legsSetting) return {};
            const pinSetting = await PinSettingsModel.findOne({poolType});
            if (!pinSetting) return {};
            const poolParent = await pool.nextPoolParent(null, poolType) as { _id: mongoose.Types.ObjectId };
            if (!poolParent) return {}; 
            let currentPosition = 0;
            const positionDet = await PoolModel.find({ parentId: poolParent?._id });
            currentPosition = positionDet.length;
            const nextPosition = currentPosition + 1;
            if (Number(legsSetting.value) < nextPosition) return {};
            // create PoolModel Entry
            const newPoolEntry = {
                uCode: new mongoose.Types.ObjectId(uCode),
                poolId: pinSetting.poolId,
                parentId: poolParent?._id,
                poolType,
                poolPosition: nextPosition
            }
            const newEntry = await PoolModel.create(newPoolEntry);
            // Need to place income
            return newEntry;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },

    nextPoolParent: async (uCode: string | mongoose.Types.ObjectId | null, poolType: string): Promise<object> => {
        try {
            const legsSetting = await fetchAdminSettingsBySlug('adminSettings', 'autopool_legs');
            let nextParentDetails = await PoolModel.findOne({});
            
            if (!legsSetting) return [];
            if (!uCode) {
                const filledUpLastParent = await PoolModel.findOne({ poolPosition: Number(legsSetting.value), poolType }).select('_id').sort({_id: -1});
                if (filledUpLastParent) {
                    nextParentDetails = await PoolModel.findOne({ _id: {$gt: filledUpLastParent._id}});
                }
            } else {
                const sponsor = await UserModel.findOne({_id: new mongoose.Types.ObjectId(uCode)});
                const sponsorPoolDetail = await PoolModel.findOne({ uCode: sponsor._id, poolType });
                if (sponsorPoolDetail) {
                    const sponsorPoolTeam = await pool.poolTeam(sponsor._id, poolType);
                    // notmalize sponsorPoolTeam in a single array of ucodes
                    const normalizedSponsorPoolTeam = sponsorPoolTeam.flat();
                    for (const poolEntry of normalizedSponsorPoolTeam) {
                        // Process each pool entry
                        const downs = await PoolModel.find({parentId: new mongoose.Types.ObjectId(poolEntry)});
                        if (downs.length < Number(legsSetting.value)) {
                            nextParentDetails = await PoolModel.findOne({ _id: new mongoose.Types.ObjectId(poolEntry)});
                            break;
                        }
                    }
                }
            }
            if (!nextParentDetails) return [];
           return nextParentDetails;
        } catch (error) {
            console.log(error);
            throw error;
        }
    },
};

export default pool;