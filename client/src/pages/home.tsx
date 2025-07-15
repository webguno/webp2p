import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Share, Plus, LogIn, Shield, Zap, Smartphone } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const { toast } = useToast();

  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/rooms");
      return response.json();
    },
    onSuccess: (room) => {
      toast({
        title: "Room created",
        description: "Share the room code with others to start sharing files",
      });
      setLocation(`/room/${room.code}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create room. Please try again.",
        variant: "destructive",
      });
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("POST", "/api/rooms/join", { code });
      return response.json();
    },
    onSuccess: (room) => {
      toast({
        title: "Joined room",
        description: `You are now connected to room ${room.code}`,
      });
      setLocation(`/room/${room.code}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Room not found. Please check the code and try again.",
        variant: "destructive",
      });
    },
  });

  const handleJoinRoom = () => {
    if (roomCode.length !== 6) {
      toast({
        title: "Invalid room code",
        description: "Please enter a 6-digit room code",
        variant: "destructive",
      });
      return;
    }
    joinRoomMutation.mutate(roomCode.toUpperCase());
    setShowJoinModal(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    }}>
      <Card className="w-full max-w-md mx-auto shadow-2xl">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Share className="text-white text-2xl" size={32} />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">FileShare Pro</h1>
            <p className="text-gray-600">Secure peer-to-peer file sharing</p>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={() => createRoomMutation.mutate()}
              disabled={createRoomMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-3"
            >
              <Plus className="text-lg" />
              <span>{createRoomMutation.isPending ? "Creating..." : "Create Room"}</span>
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => setShowJoinModal(true)}
              className="w-full border-2 border-primary text-primary hover:bg-primary/5 font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3"
            >
              <LogIn className="text-lg" />
              <span>Join Room</span>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500 mb-2">Features</p>
            <div className="flex justify-center space-x-6 text-xs text-gray-600">
              <div className="flex items-center space-x-1">
                <Shield className="text-green-500" size={16} />
                <span>Secure</span>
              </div>
              <div className="flex items-center space-x-1">
                <Zap className="text-yellow-500" size={16} />
                <span>Fast</span>
              </div>
              <div className="flex items-center space-x-1">
                <Smartphone className="text-primary" size={16} />
                <span>Mobile</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showJoinModal} onOpenChange={setShowJoinModal}>
        <DialogContent className="w-full max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-gray-900">Join Room</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-2">
                Room Code
              </Label>
              <Input 
                id="roomCode"
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder="Enter 6-digit room code"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-center text-lg font-mono tracking-widest uppercase"
                maxLength={6}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleJoinRoom();
                  }
                }}
              />
            </div>
            
            <Button 
              onClick={handleJoinRoom}
              disabled={joinRoomMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200"
            >
              {joinRoomMutation.isPending ? "Joining..." : "Join Room"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
