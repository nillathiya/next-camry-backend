import { Router } from "express";
import fundController from "../controllers/fundController";
import { upload } from "../utils/multer";
import auth from "../middlewares/auth";

const router = Router();

router.get("/deposit-methods", fundController.getAllDepositMethods);
router.get("/deposit-accounts", fundController.getAllDepositeAccounts);
router.post(
  "/create-transaction",
  upload.single("paymentSlip"),
  auth,
  fundController.createFundTransactionController
);
router.get("/transactions", auth, fundController.getAllFundTransactions);
router.get("/transactions/user", auth, fundController.getUserFundTransactions);
router.put(
  "/transactions/:id/user",
  auth,
  fundController.updateUserFundTransaction
);
router.post("/transactions/verify", auth, fundController.verifyTransaction);
router.post("/transfer/user", auth, fundController.userFundTransfer);
router.post(
  "/transfer/admin",
  auth,
  fundController.adminFundTransferAndRetrieve
);
router.post("/convert/user", auth, fundController.userFundConvert);
router.post(
  "/withdrawal/user-other",
  auth,
  fundController.userFundManualWithdrawal
);
router.post("/withdrawal/user", auth, fundController.userFundWithdrawal);
router.put("/withdrawal/user/:id", auth, fundController.updateUserWithdrawal);
router.get("/income", auth, fundController.getAllIncomeTransactions);
router.get("/withdrawals", auth, fundController.getAllWithdrawalTransactions);

export default router;
