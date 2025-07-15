import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage_multer,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

interface WebSocketMessage {
  type: string;
  payload?: any;
}

interface ExtendedWebSocket extends WebSocket {
  roomId?: number;
  socketId?: string;
}

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active connections
  const activeConnections = new Map<string, ExtendedWebSocket>();

  // API Routes
  
  // Create room
  app.post("/api/rooms", async (req, res) => {
    try {
      const code = generateRoomCode();
      const room = await storage.createRoom({ code, isActive: true });
      res.json(room);
    } catch (error) {
      console.error("Error creating room:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  // Join room
  app.post("/api/rooms/join", async (req, res) => {
    try {
      const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
      const room = await storage.getRoomByCode(code);
      
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      
      res.json(room);
    } catch (error) {
      console.error("Error joining room:", error);
      res.status(400).json({ message: "Invalid room code" });
    }
  });

  // Get room files
  app.get("/api/rooms/:roomId/files", async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const files = await storage.getFilesByRoom(roomId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Upload file
  app.post("/api/rooms/:roomId/upload", upload.single('file'), async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const { uploadedBy } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const room = await storage.getRoomById(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const fileTransfer = await storage.createFileTransfer({
        roomId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedBy: uploadedBy || 'Anonymous'
      });

      // Broadcast file upload to all room members
      broadcastToRoom(roomId, {
        type: 'file_uploaded',
        payload: fileTransfer
      });

      res.json(fileTransfer);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // Download file
  app.get("/api/files/:fileId/download", async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);
      const file = await storage.getFileById(fileId);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      const filePath = path.join(uploadsDir, file.filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      await storage.incrementDownloadCount(fileId);
      
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Get room connections
  app.get("/api/rooms/:roomId/connections", async (req, res) => {
    try {
      const roomId = parseInt(req.params.roomId);
      const connections = await storage.getActiveConnections(roomId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // WebSocket handlers
  function broadcastToRoom(roomId: number, message: WebSocketMessage) {
    activeConnections.forEach((ws, socketId) => {
      if (ws.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    const socketId = Math.random().toString(36).substring(2, 15);
    ws.socketId = socketId;
    activeConnections.set(socketId, ws);

    console.log(`WebSocket connected: ${socketId}`);

    ws.on('message', async (data) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join_room':
            const { roomCode, userInfo } = message.payload;
            const room = await storage.getRoomByCode(roomCode);
            
            if (room) {
              ws.roomId = room.id;
              
              // Create connection record
              await storage.createConnection({
                roomId: room.id,
                socketId,
                ipAddress: req.socket.remoteAddress,
                userAgent: req.headers['user-agent'] || '',
                isActive: true
              });

              // Send confirmation
              ws.send(JSON.stringify({
                type: 'room_joined',
                payload: { room, socketId }
              }));

              // Broadcast user joined to room
              broadcastToRoom(room.id, {
                type: 'user_joined',
                payload: { socketId, userInfo }
              });

              // Send current connections and files
              const connections = await storage.getActiveConnections(room.id);
              const files = await storage.getFilesByRoom(room.id);
              
              ws.send(JSON.stringify({
                type: 'room_state',
                payload: { connections, files }
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'Room not found' }
              }));
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Invalid message format' }
        }));
      }
    });

    ws.on('close', async () => {
      console.log(`WebSocket disconnected: ${socketId}`);
      
      if (ws.roomId) {
        // Deactivate connection
        await storage.deactivateConnection(socketId);
        
        // Broadcast user left to room
        broadcastToRoom(ws.roomId, {
          type: 'user_left',
          payload: { socketId }
        });
      }
      
      activeConnections.delete(socketId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for ${socketId}:`, error);
    });
  });

  return httpServer;
}
