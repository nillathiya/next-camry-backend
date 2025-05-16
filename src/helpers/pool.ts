import PoolModel, { IPool } from '../models/pool';
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

    poolRegister: async (uCode: string | mongoose.Types.ObjectId, poolType: string): Promise<IPool | null> => {
        try {
            const legsSetting = await fetchAdminSettingsBySlug('adminSettings', 'autopool_legs');
            console.log("legsSetting", legsSetting);

            if (!legsSetting) return null;
            // const pinSetting = await PinSettingsModel.findOne({ poolType });
            // console.log("pinSetting",pinSetting);

            // if (!pinSetting) return null
            const existedPool = await PoolModel.findOne(({ poolType }));
            console.log("pool", existedPool);

            if (!existedPool) return null

            const poolParent = await pool.nextPoolParent(null, poolType) as { _id: mongoose.Types.ObjectId };
            console.log("poolParent", poolParent);

            if (!poolParent) return null;
            let currentPosition = 0;
            const positionDet = await PoolModel.find({ parentId: poolParent?._id });
            currentPosition = positionDet.length;
            const nextPosition = currentPosition + 1;
            if (Number(legsSetting.value) < nextPosition) return null;
            // create PoolModel Entry
            const newPoolEntry = {
                uCode: new mongoose.Types.ObjectId(uCode),
                // poolId: pinSetting.poolId,
                poolId: existedPool.poolId,
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
    nextPoolParent: async (uCode: string | mongoose.Types.ObjectId | null, poolType: string): Promise<IPool | null> => {
        try {
            const legsSetting = await fetchAdminSettingsBySlug('adminSettings', 'autopool_legs');
            if (!legsSetting) {
                console.error(`Autopool legs setting not found for poolType: ${poolType}`);
                return null;
            }
            const maxLegs = Number(legsSetting.value);
            if (isNaN(maxLegs) || maxLegs <= 0) {
                console.error(`Invalid autopool legs value: ${legsSetting.value}`);
                return null;
            }

            let nextParentDetails: IPool | null = null;

            if (!uCode) {
                const eligibleParents = await PoolModel.aggregate([
                    {
                        $match: { poolType },
                    },
                    {
                        $lookup: {
                            from: 'pools',
                            localField: '_id',
                            foreignField: 'parentId',
                            as: 'children',
                        },
                    },
                    {
                        $match: {
                            $expr: { $lt: [{ $size: '$children' }, maxLegs] },
                        },
                    },
                    {
                        $sort: { _id: 1 },
                    },
                    {
                        $limit: 1,
                    },
                ]);

                console.log("nextParentDetails", nextParentDetails);

                nextParentDetails = eligibleParents.length > 0 ? eligibleParents[0] : null;

                if (!nextParentDetails) {
                    const firstPoolEntry = await PoolModel.findOne({ poolType })
                        .sort({ _id: 1 })
                        .lean<IPool>();
                    nextParentDetails = firstPoolEntry || null;
                }
            } else {
                const sponsor = await UserModel.findOne({ _id: new mongoose.Types.ObjectId(uCode) });
                if (!sponsor) {
                    console.error(`Sponsor not found for uCode: ${uCode}`);
                    return null;
                }
                const sponsorPoolDetail = await PoolModel.findOne({ uCode: sponsor._id, poolType });
                if (sponsorPoolDetail) {
                    const sponsorPoolTeam = await pool.poolTeam(sponsor._id, poolType);
                    const normalizedSponsorPoolTeam = sponsorPoolTeam.flat();
                    for (const poolEntry of normalizedSponsorPoolTeam) {
                        const downs = await PoolModel.find({ parentId: new mongoose.Types.ObjectId(poolEntry) });
                        if (downs.length < maxLegs) {
                            nextParentDetails = await PoolModel.findOne({ _id: new mongoose.Types.ObjectId(poolEntry) }).lean<IPool>();
                            break;
                        }
                    }
                }
            }

            return nextParentDetails || null;
        } catch (error) {
            console.error(`Error finding next pool parent for uCode: ${uCode}, poolType: ${poolType}`, error);
            throw new Error('Failed to find next pool parent');
        }
    },
    poolParent: async (pCode: string | mongoose.Types.ObjectId): Promise<object> => {
        try {
            const poolId = new mongoose.Types.ObjectId(pCode);
            const poolDetails = await PoolModel.findById(poolId);
            if (!poolDetails) {
                console.log(`Pool details for ID ${poolId} not found.`);
                return {};
            }
            const parentDetails = await PoolModel.findById(poolDetails.parentId);
            if (!parentDetails) {
                console.log(`Parent details for ID ${poolDetails.parentId} not found.`);
                return {};
            }
            return parentDetails;
        } catch (error) {
            console.log(error);
            throw new Error('Error fetching pool parent');
        }
    }
};

export default pool;