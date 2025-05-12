import business from "../helpers/business";
import OrderModel from "../models/order";
import UserModel from "../models/user";


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