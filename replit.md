# FileShare Pro - P2P File Sharing Application

## Overview

FileShare Pro is a peer-to-peer file sharing web application built with a modern full-stack architecture. The application allows users to create or join rooms for secure file sharing with real-time collaboration features. It uses a React frontend with TypeScript, an Express.js backend, PostgreSQL database with Drizzle ORM, and WebSocket for real-time communication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **Build Tool**: Vite for fast development and building
- **UI Components**: Comprehensive set of shadcn/ui components for consistent design

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Real-time Communication**: WebSocket (ws library) for live updates
- **File Upload**: Multer middleware for handling multipart/form-data
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Module System**: ES modules throughout the application

### Database Architecture
- **Database**: PostgreSQL (configured for Neon serverless)
- **Schema Management**: Drizzle ORM with migrations
- **Tables**: 
  - `rooms` - Store room information with unique codes
  - `connections` - Track active WebSocket connections
  - `fileTransfers` - Metadata for uploaded files

## Key Components

### Frontend Components
1. **Home Page** (`/pages/home.tsx`): Landing page with room creation and joining functionality
2. **Room Page** (`/pages/room.tsx`): Main file sharing interface with upload/download capabilities
3. **UI Components**: Complete set of reusable components from shadcn/ui
4. **WebSocket Manager**: Handles real-time communication with automatic reconnection
5. **QR Code Generator**: Custom implementation for sharing room links

### Backend Components
1. **Route Handler** (`/server/routes.ts`): API endpoints and WebSocket server setup
2. **Database Storage** (`/server/storage.ts`): Data access layer with type-safe operations
3. **File Upload System**: Multer configuration for handling file uploads to local storage
4. **WebSocket Server**: Real-time communication for live updates

### Shared Components
1. **Database Schema** (`/shared/schema.ts`): Drizzle schema definitions with relationships
2. **Type Definitions**: Shared TypeScript types for frontend-backend communication

## Data Flow

### Room Creation/Joining
1. User creates room → Backend generates unique code → Room stored in database
2. User joins room → Backend validates code → WebSocket connection established
3. Real-time updates sent to all connected clients in the room

### File Sharing
1. User selects file → Frontend handles upload with progress tracking
2. Multer processes multipart data → File saved to `/uploads` directory
3. File metadata stored in database → Real-time notification sent to room participants
4. Other users see file in download list → Can download directly from server

### Real-time Communication
1. WebSocket connections tracked per room in database
2. File upload events broadcast to all room participants
3. Connection status updates (user join/leave) sent in real-time
4. Automatic reconnection handling for reliability

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React 18 with extensive Radix UI component library
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack React Query for server state
- **Routing**: Wouter for lightweight routing
- **Utilities**: date-fns, clsx, class-variance-authority

### Backend Dependencies
- **Server**: Express.js with TypeScript support
- **Database**: Neon PostgreSQL with Drizzle ORM
- **File Upload**: Multer for multipart form handling
- **Real-time**: WebSocket (ws) for live communication
- **Session**: connect-pg-simple for PostgreSQL session storage

### Development Dependencies
- **Build Tools**: Vite with React plugin
- **TypeScript**: Full TypeScript support across the stack
- **Development**: Hot reload and error overlay for development

## Deployment Strategy

### Production Build
- Frontend builds to static files via Vite
- Backend bundles with esbuild for Node.js deployment
- Single deployment artifact with both frontend and backend

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- Development vs production modes handled automatically
- File uploads stored in local `/uploads` directory

### Scaling Considerations
- WebSocket connections managed per room for efficient resource usage
- File storage currently local (can be extended to cloud storage)
- Database optimized with proper indexes and relationships
- Session storage uses PostgreSQL for persistence

The application is designed as a monolithic full-stack application with clear separation between frontend and backend concerns, while sharing type definitions for consistency. The architecture supports real-time collaboration and can handle multiple concurrent rooms with file sharing capabilities.