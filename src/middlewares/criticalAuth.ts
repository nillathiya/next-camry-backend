import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../helpers/auth';
import { verifyOTP } from '../helpers/otp';
import { ApiError } from '../utils/error';

export async function criticalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = req.headers.authorization?.split(' ')[1];
    const otp = req.headers['x-otp'] as string;

    if (!token) throw new ApiError(401, 'No token provided');
    if (!otp) throw new ApiError(401, 'No OTP provided');

    try {
        const decoded = verifyJWT(token);
        const uCode = decoded.id;
        (req as Request & { user?: { uCode: string } }).user = { uCode };

        // Use username from body for registration OTP check
        const username = req.body.username || uCode;
        const isValidOTP = await verifyOTP(username, otp);
        if (!isValidOTP) throw new ApiError(401, 'Invalid or expired OTP');

        next();
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(401, 'Authentication failed');
    }
}
export default criticalAuth;