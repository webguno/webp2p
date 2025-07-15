import { rooms, connections, fileTransfers, type Room, type Connection, type FileTransfer, type InsertRoom, type InsertConnection, type InsertFileTransfer } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Room operations
  createRoom(room: InsertRoom): Promise<Room>;
  getRoomByCode(code: string): Promise<Room | undefined>;
  getRoomById(id: number): Promise<Room | undefined>;
  
  // Connection operations
  createConnection(connection: InsertConnection): Promise<Connection>;
  getActiveConnections(roomId: number): Promise<Connection[]>;
  deactivateConnection(socketId: string): Promise<void>;
  getConnectionBySocketId(socketId: string): Promise<Connection | undefined>;
  
  // File operations
  createFileTransfer(fileTransfer: InsertFileTransfer): Promise<FileTransfer>;
  getFilesByRoom(roomId: number): Promise<FileTransfer[]>;
  getFileById(id: number): Promise<FileTransfer | undefined>;
  incrementDownloadCount(fileId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const [room] = await db
      .insert(rooms)
      .values(insertRoom)
      .returning();
    return room;
  }

  async getRoomByCode(code: string): Promise<Room | undefined> {
    const [room] = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.code, code), eq(rooms.isActive, true)));
    return room || undefined;
  }

  async getRoomById(id: number): Promise<Room | undefined> {
    const [room] = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, id), eq(rooms.isActive, true)));
    return room || undefined;
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const [connection] = await db
      .insert(connections)
      .values(insertConnection)
      .returning();
    return connection;
  }

  async getActiveConnections(roomId: number): Promise<Connection[]> {
    return await db
      .select()
      .from(connections)
      .where(and(eq(connections.roomId, roomId), eq(connections.isActive, true)));
  }

  async deactivateConnection(socketId: string): Promise<void> {
    await db
      .update(connections)
      .set({ isActive: false })
      .where(eq(connections.socketId, socketId));
  }

  async getConnectionBySocketId(socketId: string): Promise<Connection | undefined> {
    const [connection] = await db
      .select()
      .from(connections)
      .where(and(eq(connections.socketId, socketId), eq(connections.isActive, true)));
    return connection || undefined;
  }

  async createFileTransfer(insertFileTransfer: InsertFileTransfer): Promise<FileTransfer> {
    const [fileTransfer] = await db
      .insert(fileTransfers)
      .values(insertFileTransfer)
      .returning();
    return fileTransfer;
  }

  async getFilesByRoom(roomId: number): Promise<FileTransfer[]> {
    return await db
      .select()
      .from(fileTransfers)
      .where(eq(fileTransfers.roomId, roomId))
      .orderBy(desc(fileTransfers.uploadedAt));
  }

  async getFileById(id: number): Promise<FileTransfer | undefined> {
    const [file] = await db
      .select()
      .from(fileTransfers)
      .where(eq(fileTransfers.id, id));
    return file || undefined;
  }

  async incrementDownloadCount(fileId: number): Promise<void> {
    await db
      .update(fileTransfers)
      .set({ downloadCount: sql`${fileTransfers.downloadCount} + 1` })
      .where(eq(fileTransfers.id, fileId));
  }
}

export const storage = new DatabaseStorage();
