import { Request, Response } from "express";
import Ticket, { ITicket } from "../models/ticket";
import mongoose from "mongoose";
import common from "../helpers/common";

// Create a new ticket
export const createTicket = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, title, description } = req.body;

    const validateFields = ["userId", "title", "description"];
    const response = await common.requestFieldsValidation(
      validateFields,
      req.body
    );

    if (!response.status) {
      res.status(400).json({
        error: `Missing fields: ${
          response.missingFields?.join(", ") || "Unknown"
        }`,
      });
      return;
    }
    const newTicket = new Ticket({
      userId,
      title,
      description,
      status: "open",
      messages: [],
      unreadMessages: { admin: 0, user: 0 },
    });

    await newTicket.save();

    (global as any).io.to("admin-room").emit("newTicketCreated", newTicket);

    res
      .status(201)
      .json({ success: true, message: "Ticket created", ticket: newTicket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// User sends a message
export const sendMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { ticketId, text, sender } = req.body;
 
    const validateFields = ["ticketId", "text", "sender"];
    const response = await common.requestFieldsValidation(
      validateFields,
      req.body
    );

    if (!response.status) {
      res.status(400).json({
        error: `Missing fields: ${
          response.missingFields?.join(", ") || "Unknown"
        }`,
      });
      return;
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (ticket.status !== "open") {
      res
        .status(403)
        .json({ error: "Cannot send messages in a closed/completed ticket" });
      return;
    }

    const newMessage = { sender, text, isRead: false };
    ticket.messages.push(newMessage);

    if (sender === "user") {
      ticket.unreadMessages.admin += 1;
    } else {
      ticket.unreadMessages.user += 1;
    }

    await ticket.save();

    (global as any).io
      .to(ticket.userId.toString())
      .emit("newMessage", { ticketId, sender, text, isRead: false });
    (global as any).io.to("admin-room").emit("newMessage", {
      ticketId,
      sender,
      text,
      userId: ticket.userId.toString(),
      isRead: false,
    });

    res.status(200).json({ success: true, message: "Message sent", ticket });
  } catch (error: any) {
    console.log("Error sending message: " + error.message);
    res.status(500).json({ error: "Server error" });
  }
};

// Admin replies to a ticket
export const replyMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { ticketId, text } = req.body;
    if (!ticketId || !text) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (ticket.status !== "open") {
      res
        .status(403)
        .json({ error: "Cannot reply in a closed/completed ticket" });
      return;
    }

    ticket.messages.push({ sender: "admin", text, isRead: false });
    ticket.unreadMessages.user += 1;
    ticket.updatedAt = new Date();
    await ticket.save();

    (global as any).io
      .to(ticket.userId.toString())
      .emit("newMessage", { ticketId, sender: "admin", text, isRead: false });
    (global as any).io.to("admin-room").emit("newMessage", {
      ticketId,
      sender: "admin",
      text,
      userId: ticket.userId.toString(),
      isRead: false,
    });

    res
      .status(200)
      .json({ status: "success", message: "Reply sent", data: ticket });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch all tickets for a user
export const getUserTickets = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }

    const tickets = await Ticket.find({ userId })
      .populate("userId", "username name")
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch all tickets (Admin)
export const getAllTickets = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const tickets = await Ticket.find({}, "_id status unreadMessages userId")
      .populate("userId", "username name")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      status: "success",
      message: "Successfully retrieved all tickets",
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Admin updates ticket status
export const updateTicketStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;

    if (!ticketId || !status) {
      res.status(400).json({ error: "Missing ticketId or status" });
      return;
    }

    if (!["open", "completed", "closed"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    ticket.status = status;
    ticket.updatedAt = new Date();
    await ticket.save();

    res.status(200).json({
      status: "success",
      message: `Ticket status updated to ${status}`,
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Admin deletes a ticket
export const deleteTicket = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    if (!ticketId) {
      res.status(400).json({ error: "Missing ticketId" });
      return;
    }

    const ticket = await Ticket.findByIdAndDelete(ticketId);
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Ticket deleted" });
  } catch (error) {
    console.log("Ticket deletion error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Fetch ticket messages & mark as read
export const getTicketMessages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const { role } = req.query; // Changed from req.body to req.query for GET request

    if (!ticketId || !role) {
      res.status(400).json({ error: "Missing ticketId or role" });
      return;
    }

    const ticket = await Ticket.findById(ticketId).populate(
      "userId",
      "username name"
    );
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    let messagesUpdated = false;

    if (role === "admin") {
      ticket.messages.forEach((msg) => {
        if (msg.sender === "user" && !msg.isRead) {
          msg.isRead = true;
          messagesUpdated = true;
        }
      });
      ticket.unreadMessages.admin = 0;
    } else if (role === "user") {
      ticket.messages.forEach((msg) => {
        if (msg.sender === "admin" && !msg.isRead) {
          msg.isRead = true;
          messagesUpdated = true;
        }
      });
      ticket.unreadMessages.user = 0;
    } else {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    if (messagesUpdated) {
      await ticket.save();

      (global as any).io
        .to(ticket.userId.toString())
        .emit("messagesRead", { ticketId });
      (global as any).io.to("admin-room").emit("messagesRead", { ticketId });
    }

    res.status(200).json({
      status: "success",
      message: "Ticket messages retrieved and marked as read",
      data: ticket,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete all tickets
export const deleteAllTickets = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    await Ticket.deleteMany({});
    res.status(200).json({ success: true, message: "All tickets deleted" });
  } catch (error) {
    console.error("Error deleting all tickets:", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Mark messages as read
export const markMessagesAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { ticketId, userId, adminId } = req.body;

    if (!ticketId || (!userId && !adminId)) {
      res
        .status(400)
        .json({ success: false, error: "Missing ticketId or userId/adminId" });
      return;
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      res.status(404).json({ success: false, error: "Ticket not found" });
      return;
    }

    let messagesUpdated = false;

    if (userId) {
      ticket.messages.forEach((msg) => {
        if (msg.sender === "admin" && !msg.isRead) {
          msg.isRead = true;
          messagesUpdated = true;
        }
      });
      ticket.unreadMessages.user = 0;
    }

    if (adminId) {
      ticket.messages.forEach((msg) => {
        if (msg.sender === "user" && !msg.isRead) {
          msg.isRead = true;
          messagesUpdated = true;
        }
      });
      ticket.unreadMessages.admin = 0;
    }

    if (messagesUpdated) {
      await ticket.save();
      (global as any).io
        .to(ticket.userId.toString())
        .emit("messagesRead", { ticketId });
      (global as any).io.to("admin-room").emit("messagesRead", { ticketId });
    }

    res.status(200).json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};
