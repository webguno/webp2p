import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { wsManager } from "@/lib/websocket";
import { generateQRCode, getShareUrl } from "@/lib/qrcode";
import { 
  Share, 
  Users, 
  Upload, 
  Download, 
  Copy, 
  RefreshCw, 
  LogOut,
  CloudUpload,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  File
} from "lucide-react";
import type { Room, Connection, FileTransfer } from "@shared/schema";

interface RoomPageProps {
  params: { code: string };
}

export default function RoomPage({ params }: RoomPageProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");

  // Join room query
  const { data: room, isLoading, error } = useQuery({
    queryKey: ["/api/rooms/join"],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/rooms/join", { code: params.code });
      return response.json() as Promise<Room>;
    },
  });

  // Files query
  const { data: files = [], refetch: refetchFiles } = useQuery({
    queryKey: ["/api/rooms", room?.id, "files"],
    queryFn: async () => {
      if (!room) return [];
      const response = await apiRequest("GET", `/api/rooms/${room.id}/files`);
      return response.json() as Promise<FileTransfer[]>;
    },
    enabled: !!room,
  });

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!room) throw new Error("No room");
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploadedBy', 'You');

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

        xhr.open('POST', `/api/rooms/${room.id}/upload`);
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      toast({
        title: "Upload successful",
        description: "File has been uploaded and is now available for download",
      });
      refetchFiles();
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: () => {
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      });
      setIsUploading(false);
      setUploadProgress(0);
    },
  });

  // Initialize WebSocket connection
  useEffect(() => {
    if (!room) return;

    const initWebSocket = async () => {
      try {
        await wsManager.connect();
        
        // Join room via WebSocket
        wsManager.send({
          type: 'join_room',
          payload: { 
            roomCode: room.code,
            userInfo: { name: 'You' }
          }
        });

        // Set up event listeners
        wsManager.on('room_state', (payload) => {
          setConnections(payload.connections);
        });

        wsManager.on('user_joined', () => {
          // Refresh connections
          queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id, "connections"] });
        });

        wsManager.on('user_left', () => {
          // Refresh connections
          queryClient.invalidateQueries({ queryKey: ["/api/rooms", room.id, "connections"] });
        });

        wsManager.on('file_uploaded', () => {
          refetchFiles();
          toast({
            title: "New file available",
            description: "A new file has been shared in this room",
          });
        });

      } catch (error) {
        console.error('WebSocket connection failed:', error);
        toast({
          title: "Connection error",
          description: "Failed to connect to room. Some features may not work.",
          variant: "destructive",
        });
      }
    };

    initWebSocket();

    // Generate QR code
    const shareUrl = getShareUrl(room.code);
    const qrCode = generateQRCode(shareUrl);
    setQrCodeUrl(qrCode);

    return () => {
      wsManager.disconnect();
    };
  }, [room, queryClient, refetchFiles, toast]);

  const handleFileSelect = (files: FileList) => {
    if (files.length > 0) {
      setIsUploading(true);
      uploadMutation.mutate(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(params.code).then(() => {
      toast({
        title: "Copied!",
        description: "Room code copied to clipboard",
      });
    });
  };

  const downloadFile = (file: FileTransfer) => {
    window.open(`/api/files/${file.id}/download`, '_blank');
    toast({
      title: "Download started",
      description: "File download has been initiated",
    });
  };

  const leaveRoom = () => {
    wsManager.disconnect();
    setLocation("/");
  };

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <File className="text-gray-600" />;
    
    if (mimeType.includes('pdf')) return <FileText className="text-red-600" />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet className="text-green-600" />;
    if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="text-blue-600" />;
    
    return <File className="text-gray-600" />;
  };

  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-900">Joining room...</p>
          <p className="text-sm text-gray-500">Please wait while we connect you</p>
        </div>
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="text-red-600" size={32} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Room not found</h1>
            <p className="text-gray-600 mb-4">The room code you entered is invalid or the room no longer exists.</p>
            <Button onClick={() => setLocation("/")} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Share className="text-white text-sm" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">FileShare Pro</h1>
                <p className="text-sm text-gray-500">Room: <span className="font-mono">{room.code}</span></p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-gray-600">{connections.length} connected</span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={leaveRoom}
                className="text-gray-400 hover:text-gray-600"
              >
                <LogOut size={18} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column - Room Info & QR Code */}
          <div className="lg:col-span-1 space-y-6">
            {/* Room Info Card */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Room Information</h3>
                
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="bg-gray-100 rounded-xl p-4 mb-3">
                      {qrCodeUrl && (
                        <img 
                          src={qrCodeUrl} 
                          alt={`QR Code for room ${room.code}`} 
                          className="w-32 h-32 mx-auto rounded-lg" 
                        />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Scan to join room</p>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Room Code</p>
                      <p className="text-2xl font-mono font-bold text-gray-900">{room.code}</p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={copyRoomCode}
                    variant="secondary"
                    className="w-full flex items-center justify-center space-x-2"
                  >
                    <Copy size={16} />
                    <span>Copy Room Code</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Connected Users */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Users</h3>
                <div className="space-y-3">
                  {connections.map((connection, index) => (
                    <div key={connection.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Users className="text-white text-xs" size={12} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {index === 0 ? 'You' : `User ${index + 1}`}
                        </p>
                        <p className="text-xs text-gray-500">{connection.ipAddress}</p>
                      </div>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    </div>
                  ))}
                  {connections.length === 0 && (
                    <div className="text-center py-4">
                      <p className="text-gray-500">No other users connected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - File Operations */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* File Upload Area */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Files</h3>
                
                <div 
                  className="border-2 border-dashed border-gray-300 hover:border-primary rounded-xl p-8 text-center transition-all duration-200 cursor-pointer hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                      <CloudUpload className="text-primary" size={32} />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-900">Drop files here or click to upload</p>
                      <p className="text-sm text-gray-500 mt-1">Supports all file types up to 100MB</p>
                    </div>
                    <Button className="bg-primary hover:bg-primary/90">
                      Select Files
                    </Button>
                  </div>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
                />
                
                {/* Upload Progress */}
                {isUploading && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Upload className="text-blue-600" size={20} />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Uploading file...</p>
                        <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-sm text-blue-600">{Math.round(uploadProgress)}%</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Available Files */}
            <Card className="shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Available Files</h3>
                  <Button 
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchFiles()}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <RefreshCw size={16} />
                  </Button>
                </div>
                
                {/* File List */}
                <div className="space-y-3">
                  {files.length > 0 ? files.map((file) => (
                    <div key={file.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.originalName}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)} • Uploaded by {file.uploadedBy} • {formatTimeAgo(file.uploadedAt)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm"
                          onClick={() => downloadFile(file)}
                          className="bg-primary hover:bg-primary/90"
                        >
                          <Download size={16} />
                        </Button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FolderOpen className="text-gray-400" size={32} />
                      </div>
                      <p className="text-gray-500">No files available yet</p>
                      <p className="text-sm text-gray-400 mt-1">Upload files to share with room members</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
