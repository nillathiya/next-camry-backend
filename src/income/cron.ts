import { roi, growthBooster, daily_level, reward } from './model';
import { updateUserStatus, UpdateOrderPayoutStatus } from './custom';
import cron from 'node-cron';
const timezone = 'Asia/Kolkata';

// Schedule roi to run every day at 00:01 at given ${timezone}
cron.schedule('1 0 * * *', async () => {
    roi();
}, {
    timezone: timezone
});
// Schedule growthBooster to run every week on sunday at 00:30 at given ${timezone}
cron.schedule('30 0 * * 0', async () => {
    growthBooster();
}, {
    timezone: timezone
});
// Schedule daily_level to run every day at 00:50 at given ${timezone}
cron.schedule('50 0 * * *', async () => {
    daily_level();
}, {
    timezone: timezone
});

// Schedule reward to run every day at 00:55 at given ${timezone}
cron.schedule('55 0 * * *', async () => {
    reward();
}, {
    timezone: timezone
});


// updateUserStatus(); daily at night 23:45
cron.schedule('45 23 * * *', async () => {
    await updateUserStatus();
}, {
    timezone: timezone
});

// UpdateOrderPayoutStatus(); daily at night 23:00
cron.schedule('0 23 * * *', async () => {
    await UpdateOrderPayoutStatus();
}, {
    timezone: timezone
});


