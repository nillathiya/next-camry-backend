import { Router } from "express";
import {
  register,
  login,
  sendOtp,
  sendForgotOtp,
  logout,
  adminLogin,
  registerAdmin,
  impersonation,
  checkUserToken,
  checkUsername,
  verifyUserOtp,
  resetPassword,
  changePassword,
  web3Registration,
  getNonce,
  verifySiwe,
} from "../controllers/authController";
import { auth } from "../middlewares/auth";

const router = Router();

router.post("/register", register);
router.post("/web3-register", web3Registration);
router.post("/login", login);
router.post("/send-otp", sendOtp);
router.post("/send-forgot-otp", sendForgotOtp);
router.post("/logout", logout);
router.post("/admin/login", adminLogin);
router.post("/admin/register", registerAdmin);
router.post("/admin/impersonate", auth, impersonation);
router.post("/check-token", checkUserToken);
router.post("/check-username", checkUsername);
router.post("/verify-otp", verifyUserOtp);
router.post("/reset-password", resetPassword);
router.post("/change-password", auth, changePassword);
router.get("/nonce", getNonce);
router.post("/siwe", verifySiwe);

export default router;
