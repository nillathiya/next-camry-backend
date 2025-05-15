import { Router } from "express";
import authRoute from "./authRoute"; // Synchronous route (assuming no async)
import settingsRoute from "./settingsRoute"; // Synchronous route (assuming no async)
import userRoutes from "./userRoutes"; // Async route returning Promise<Router>
import fundRoutes from "./fundRoute";
import userSettingRoutes from "./userSettingRoute";
import adminSettingRoutes from "./adminSettingRoute";
import pinSettingRoutes from "./pinSettingRoute";
import withdrawalRoutes from "./withdrawalRoute";
import kycRoutes from "./kycRoutes";
import callBackRoutes from "./callBackRoute";
import companyInfoRoutes from "./companyInfoRoute";
import rankSettingsRoutes from "./rankSettingRoute";
import newsEventRoutes from "./newsEventRoute";
import ticketRoutes from "./ticketRoute";
import websiteSettingRoutes from "./websiteSettingRoute";
import walletSettingRoutes from "./walletSettingRoute";
import topUpRoutes from "./topUpRoute";

async function configureRoutes(): Promise<Router> {
  const router = Router();

  // Mount synchronous routes directly
  router.use("/api/auth", authRoute);
  router.use("/api/settings", settingsRoute);
  router.use("/api/fund", fundRoutes);
  router.use("/api/user-setting", userSettingRoutes);
  router.use("/api/admin-setting", adminSettingRoutes);
  router.use("/api/website-setting", websiteSettingRoutes);
  router.use("/api/wallet-setting", walletSettingRoutes);
  router.use("/api/pin-setting", pinSettingRoutes);
  router.use("/api/withdrawal", withdrawalRoutes);
  router.use("/api/kyc", kycRoutes);
  router.use("/api/company-info", companyInfoRoutes);
  router.use("/api/rank-setting", rankSettingsRoutes);
  router.use("/api/news-events", newsEventRoutes);
  router.use("/api/tickets", ticketRoutes);
  router.use("/api/top-up", topUpRoutes);

  // Mount async routes (await the Promise<Router>)
  const userRouter = await userRoutes;
  router.use("/api/user", userRouter);

  router.use("/", callBackRoutes);

  // Add more routes here as needed (e.g., /users, /transactions)
  return router;
}

export default configureRoutes().catch((error) => {
  console.error("Failed to configure routes:", error);
  throw error;
});
