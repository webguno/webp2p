import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  socketId: text("socket_id").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  connectedAt: timestamp("connected_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const fileTransfers = pgTable("file_transfers", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type"),
  size: integer("size").notNull(),
  uploadedBy: text("uploaded_by"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  downloadCount: integer("download_count").default(0).notNull(),
});

export const roomsRelations = relations(rooms, ({ many }) => ({
  connections: many(connections),
  fileTransfers: many(fileTransfers),
}));

export const connectionsRelations = relations(connections, ({ one }) => ({
  room: one(rooms, {
    fields: [connections.roomId],
    references: [rooms.id],
  }),
}));

export const fileTransfersRelations = relations(fileTransfers, ({ one }) => ({
  room: one(rooms, {
    fields: [fileTransfers.roomId],
    references: [rooms.id],
  }),
}));

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  connectedAt: true,
});

export const insertFileTransferSchema = createInsertSchema(fileTransfers).omit({
  id: true,
  uploadedAt: true,
  downloadCount: true,
});

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertFileTransfer = z.infer<typeof insertFileTransferSchema>;
export type FileTransfer = typeof fileTransfers.$inferSelect;
