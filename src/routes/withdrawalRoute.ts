import { Router } from "express";
import withdrawalController from "../controllers/withdrawalController";
import auth from "../middlewares/auth";

const router = Router();

// withdrawal methods:
router.get("/methods", auth, withdrawalController.getAllWithdrawalMethods);
router.post("/methods", auth, withdrawalController.addWithdrawalMethod);
// withdrawal account types:
router.post(
  "/account-types",
  auth,
  withdrawalController.addWithdrawalAccountType
);
router.get(
  "/account-types",
  auth,
  withdrawalController.getAllWithdrawalAccountTypes
);
router.put(
  "/account-types/:id",
  auth,
  withdrawalController.updateWithdrawalAccountType
);
// withdrawal user account types:
router.post("/user/accounts", auth, withdrawalController.AddWithdrawalAccount);
router.get(
  "/user/accounts",
  auth,
  withdrawalController.getAllUserWithdrawalAccounts
);
router.post("/user/user-other", auth, withdrawalController.AddWithdrawalAccount);
router.put(
  "/user/accounts/:id/disable",
  auth,
  withdrawalController.disableUserWithdrawalAccount
);

export default router;
