import { Router } from "express";
import callBackController from '../controllers/callBackController'; 

const router = Router();

router.post('/callback/ctpeway/webhook', callBackController.processWebhook); 

export default router;