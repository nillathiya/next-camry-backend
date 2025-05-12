import { Router } from "express";
import * as ticketController from "../controllers/ticket.controller";

const router = Router();

router.post("/create", ticketController.createTicket);
router.post("/message/send", ticketController.sendMessage);
router.get("/user/:userId", ticketController.getUserTickets);
router.get("/all", ticketController.getAllTickets);
router.post("/message/reply", ticketController.replyMessage);
router.patch("/status/:ticketId", ticketController.updateTicketStatus);
router.delete("delete/:ticketId", ticketController.deleteTicket);
router.get("/:ticketId/messages", ticketController.getTicketMessages);
router.delete("/delete/all", ticketController.deleteAllTickets);
router.patch("/mark-read", ticketController.markMessagesAsRead);

export default router;
