import { Schema, model, Document, Types } from "mongoose";

// Interface for Message subdocument
interface IMessage {
  sender: "user" | "admin";
  text: string;
  isRead: boolean;
}

// Interface for unreadMessages
interface IUnreadMessages {
  admin: number;
  user: number;
}

// Interface for Ticket document
export interface ITicket extends Document {
  userId: Types.ObjectId;
  title: string;
  description: string;
  status: "open" | "completed" | "closed";
  messages: IMessage[];
  unreadMessages: IUnreadMessages;
  createdAt: Date;
  updatedAt: Date;
}

// Message Schema
const messageSchema = new Schema<IMessage>(
  {
    sender: { type: String, enum: ["user", "admin"], required: true },
    text: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Ticket Schema
const TicketSchema = new Schema<ITicket>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["open", "completed", "closed"],
      default: "open",
    },
    messages: [messageSchema],
    unreadMessages: {
      admin: { type: Number, default: 0 },
      user: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export default model<ITicket>("Ticket", TicketSchema);
