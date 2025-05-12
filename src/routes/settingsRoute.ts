import { Router, NextFunction } from 'express';
import { Request, Response } from 'express';
import { fetchUserSettingsBySlug, fetchAdminSettingsBySlug } from '../helpers/settings';
import { ApiError } from '../utils/error';
import auth from '../middlewares/auth';
import { ApiResponse } from '../utils/response';

const router = Router();
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
router.post('/website-settings', asyncHandler(async (req: Request, res: Response) => {
  const { setting } = req.body;

  if (!setting || typeof setting !== 'string') {
    throw new ApiError(400, 'Valid slug is required in body as "setting"');
  }

  const websiteSetting = await fetchUserSettingsBySlug('websiteSettings', setting);
  if (!websiteSetting) {
    throw new ApiError(404, `No active website setting found for slug '${setting}'`);
  }

  res.status(200).json(new ApiResponse(200, websiteSetting, 'Website setting retrieved successfully'));
}));

router.post(
  '/user-settings',
  auth, // Add auth middleware here
  asyncHandler(async (req: Request, res: Response) => {
    const { setting } = req.body;
    // console.log(setting);
    if (!setting || typeof setting !== 'string') {
      throw new ApiError(400, 'Valid slug is required in body as "setting"');
    }

    const userSetting = await fetchUserSettingsBySlug('userSettings', setting);
    if (!userSetting) {
      throw new ApiError(404, `No active website setting found for slug '${setting}'`);
    }

    res.status(200).json(new ApiResponse(200, userSetting, 'Website setting retrieved successfully'));
  })
);

router.post('/admin/admin-settings', asyncHandler(async (req: Request, res: Response) => {
    const { setting } = req.body;
  
    if (!setting || typeof setting !== 'string') {
      throw new ApiError(400, 'Valid slug is required in body as "setting"');
    }
  
    const adminSetting = await fetchAdminSettingsBySlug('adminSettings', setting);
    if (!adminSetting) {
      throw new ApiError(404, `No active website setting found for slug '${setting}'`);
    }
  
    res.status(200).json(new ApiResponse(200, adminSetting, 'Website setting retrieved successfully'));
}));

router.post('/wallet/wallet-settings', asyncHandler(async (req: Request, res: Response) => {
    const { setting } = req.body;
  
    if (!setting || typeof setting !== 'string') {
      throw new ApiError(400, 'Valid slug is required in body as "setting"');
    }
  
    const walletSetting = await fetchUserSettingsBySlug('walletSettings', setting);
    if (!walletSetting) {
      throw new ApiError(404, `No active website setting found for slug '${setting}'`);
    }
  
    res.status(200).json(new ApiResponse(200, walletSetting, 'Website setting retrieved successfully'));
}));


export default router;