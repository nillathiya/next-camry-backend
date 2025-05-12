import { Server } from "socket.io";
import http from "http";
import { Express } from "express";

let io: Server;

/**
 * Initializes WebSocket server
 * @param app - Express application
 * @returns {http.Server} - Returns the HTTP server instance
 */
export const initializeSocket = (app: Express) => {
  const server = http.createServer(app);
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      allowedHeaders: ["Authorization"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Assign io to global.io
  (global as any).io = io;

  const onlineUsers = new Map(); // Track online users
  const onlineAdmins = new Set(); // Track online admins

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Old code: User registers to receive messages in their private room
    socket.on("register", (userId) => {
      if (!userId) return;
      socket.join(userId);
      onlineUsers.set(userId, socket.id);
      console.log(`User ${userId} joined their room`);
    });

    // Old code: Admin joins the admin room
    socket.on("adminJoin", (adminId) => {
      socket.join("admin-room");
      onlineAdmins.add(adminId);
      console.log("Admin joined the admin room");
    });

    // Old code: Admin sends a message
    socket.on(
      "adminSendMessage",
      ({ ticketId, userId, text, createdAt, _id }) => {
        console.log(
          "ticketId:",
          ticketId,
          "userId:",
          userId,
          "text:",
          text,
          "createdAt:",
          createdAt,
          "_id:",
          _id
        );
        if (!ticketId || !userId || !text) return;
        io.to(userId).emit("newMessage", {
          ticketId,
          sender: "admin",
          text,
          createdAt,
          _id,
        });
        console.log(
          `Admin message sent to User ${userId} in Ticket ${ticketId}`
        );
      }
    );

    // Old code: User sends a message
    socket.on("userSendMessage", ({ ticketId, text, sender, isRead }) => {
      if (!ticketId || !text || !sender) return;
      io.to("admin-room").emit("newMessage", {
        ticketId,
        sender,
        text,
        isRead,
      });
      console.log(`User message sent in Ticket ${ticketId}`);
    });

    // Old code: SeenRequest event
    socket.on("seenRequest", ({ ticketId, sender, userId }) => {
      if (!ticketId || !sender) return;
      console.log(
        `📢 SeenRequest event received for ticketId: ${ticketId} from ${sender}`
      );
      if (sender === "admin") {
        io.to(userId).emit("seenRequest", { ticketId });
        console.log(
          `📢 Emitted seenRequest event to user for ticketId: ${ticketId}`
        );
      } else if (sender === "user") {
        io.to("admin-room").emit("seenRequest", { ticketId });
        console.log(
          `📢 Emitted seenRequest event to admin-room for ticketId: ${ticketId}`
        );
      }
    });

    // Old code: Seen event
    socket.on("seen", ({ ticketId, sender, userId }) => {
      if (!ticketId || !sender) return;
      console.log(
        `📢 Seen event received for ticketId: ${ticketId} from ${sender}`
      );
      if (sender === "admin") {
        io.to(userId).emit("seen", { ticketId });
        console.log(`📢 Emitted seen event to user for ticketId: ${ticketId}`);
      } else if (sender === "user") {
        io.to("admin-room").emit("seen", { ticketId });
        console.log(
          `📢 Emitted seen event to admin-room for ticketId: ${ticketId}`
        );
      }
    });

    // Old code: New ticket event
    socket.on("newTicket", (newTicket) => {
      if (!newTicket) return;
      io.to("admin-room").emit("newTicketCreated", newTicket);
      console.log(`New Ticket Created: ${newTicket._id}`);
    });

    // Old code: Disconnect handling
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          console.log(`User ${userId} went offline`);
          break;
        }
      }
      onlineAdmins.forEach((adminId) => {
        if (adminId === socket.id) {
          onlineAdmins.delete(adminId);
          console.log(`Admin ${adminId} went offline`);
        }
      });
    });

    // New code: Basic join event
    socket.on("join", (userId) => {
      console.log(`User joined room: ${userId}`);
      socket.join(userId);
    });

    // New code: Basic disconnect event
    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return server;
};

/**
 * Emits an event to a specific user
 */
export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) {
    console.error("Socket.io is not initialized!");
    return;
  }
  console.log(`Emitting event: '${event}' to user: ${userId} with data:`, data);
  io.to(userId).emit(event, data);
};

/**
 * Emits a new ticket event to the admin room
 */
export const emitNewTicket = (newTicket: any) => {
  if (!io) {
    console.error("Socket.io is not initialized!");
    return;
  }
  console.log(
    `Emitting newTicketCreated to admin-room with ticket:`,
    newTicket
  );
  io.to("admin-room").emit("newTicketCreated", newTicket);
};
