import express, { Request, Router } from "express";
import userController from "../controllers/userController";
import auth from "../middlewares/auth";
import { upload } from "../utils/multer";

// Define the user structure set by auth middleware
interface AuthenticatedUser {
  uCode: string;
}

// Extend Request type for authenticated routes
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

// Function to configure router based on edit profile setting
async function configureRouter(): Promise<Router> {
  const router = express.Router();

  // Standard routes with auth middleware
  router.post("/admin/register", auth, userController.adminRegister);
  router.get("/profile", auth, userController.profile);
  router.post("/my-wallets", auth, userController.myWallets);
  router.get("/wallet", auth, userController.getUserWallet);
  router.post("/create-wallet", userController.createWallet);
  router.get("/check-wallet", userController.checkWallet);
  router.post("/check-name", auth, userController.checkUsername);
  router.post("/top-up", auth, userController.userTopUp);
  router.post(
    "/get-crypto-deposit-address",
    auth,
    userController.getUserCryptoDepositAddress
  );
  router.get("/orders", auth, userController.getOrders);
  router.get("/", auth, userController.getUsers);
  router.get("/:id", auth, userController.getUserById);
  router.post("/send-otp", auth, userController.sendOtpToUser);
  router.post("/send-critical-otp", auth, userController.sendCriticalOtp);
  router.post("/verify-otp", auth, userController.verifyUserOtp);
  router.post("/generation-tree", auth, userController.getUserGenerationTree);
  router.get("/list/directs", auth, userController.getUserDirects);

  router.post(
    "/edit-profile",
    auth,
    upload.single("profilePicture"),
    userController.editProfile
  );

  return router;
}

// Export the configured router
export default configureRouter().catch((error) => {
  console.error("Failed to configure router:", error);
  throw error;
});
