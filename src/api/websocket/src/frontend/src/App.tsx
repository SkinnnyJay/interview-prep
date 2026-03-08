// Main WebSocket Demo Application

import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import ConnectionPanel from './components/ConnectionPanel';
import MessagePanel from './components/MessagePanel';
import ChatPanel from './components/ChatPanel';
import RoomPanel from './components/RoomPanel';
import StatsPanel from './components/StatsPanel';
import type { ServerType, ServerStats, ChatMessage, Room } from './types';

function App() {
  const [serverType, setServerType] = useState<ServerType>('basic');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<string>('');
  const [username, setUsername] = useState(
    () => 'User' + Math.floor(Math.random() * 1000)
  );

  const {
    connectionStatus,
    sendMessage,
    connect,
    disconnect,
    joinRoom,
    leaveRoom,
    lastMessage,
    messageHistory
  } = useWebSocket({
    serverType,
    onMessage: (message) => {
      console.log('Received message:', message);
      
      // Handle different message types
      switch (message.type) {
        case 'chat': {
          const p = message.payload && typeof message.payload === 'object' && message.payload as { username?: string; message?: string; room?: string };
          if (p && (p.message !== undefined || p.username !== undefined)) {
            setChatMessages(prev => [...prev, {
              id: message.id,
              username: p.username ?? 'Anonymous',
              message: typeof p.message === 'string' ? p.message : String(p.message ?? ''),
              timestamp: message.timestamp,
              room: p.room
            }]);
          }
          break;
        }
          
        case 'server_stats':
          setStats(message.payload);
          break;
          
        case 'room_joined':
          setRooms(prev => prev.map(room => 
            room.id === message.payload.room 
              ? { ...room, joined: true, clientCount: message.payload.clientCount }
              : room
          ));
          break;
          
        case 'room_left':
          setRooms(prev => prev.map(room => 
            room.id === message.payload.room 
              ? { ...room, joined: false }
              : room
          ));
          break;
      }
    },
    onConnect: (clientId) => {
      console.log('Connected with client ID:', clientId);
      // Request server stats on connect
      sendMessage({
        type: 'get_server_stats',
        payload: {}
      });
    },
    onDisconnect: (reason) => {
      console.log('Disconnected:', reason);
      setStats(null);
    },
    onError: (error) => {
      console.error('WebSocket error:', error);
    }
  });

  // Fetch stats periodically
  useEffect(() => {
    if (!connectionStatus.connected) return;

    const interval = setInterval(() => {
      sendMessage({
        type: 'get_server_stats',
        payload: {}
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [connectionStatus.connected, sendMessage]);

  // Handle server type change
  const handleServerTypeChange = (newType: ServerType) => {
    disconnect();
    setServerType(newType);
    setChatMessages([]);
    setRooms([]);
    setStats(null);
    // Connection will be re-established by the useWebSocket hook
  };

  // Send chat message
  const sendChatMessage = (message: string, room?: string) => {
    if (serverType === 'socketio') {
      // For Socket.IO, use the chat namespace if available
      sendMessage({
        type: 'send_message',
        payload: {
          username,
          message,
          room: room || currentRoom
        }
      });
    } else {
      // For standard WebSocket
      sendMessage({
        type: 'chat',
        payload: {
          username,
          message,
          room: room || currentRoom
        }
      });
    }
  };

  // Test functions
  const sendEcho = () => {
    sendMessage({
      type: 'echo',
      payload: { message: 'Echo test', timestamp: Date.now() }
    });
  };

  const sendBroadcast = () => {
    sendMessage({
      type: 'broadcast_test',
      payload: { message: 'Broadcast test from ' + username }
    });
  };

  const sendPing = () => {
    sendMessage({
      type: 'ping',
      payload: {}
    });
  };

  // Room management
  const handleJoinRoom = (roomName: string) => {
    if (!roomName.trim()) return;
    
    joinRoom(roomName);
    setCurrentRoom(roomName);
    
    // Add room to list if not exists
    setRooms(prev => {
      const exists = prev.find(r => r.id === roomName);
      if (exists) return prev;
      
      return [...prev, {
        id: roomName,
        name: roomName,
        clientCount: 1,
        joined: true
      }];
    });
  };

  const handleLeaveRoom = (roomName: string) => {
    leaveRoom(roomName);
    setCurrentRoom((prev) => (prev === roomName ? '' : prev));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            WebSocket Demo
          </h1>
          <p className="text-gray-600">
            Interactive demonstration of WebSocket implementations with React
          </p>
        </div>

        {/* Connection Panel */}
        <div className="mb-6">
          <ConnectionPanel
            serverType={serverType}
            connectionStatus={connectionStatus}
            onServerTypeChange={handleServerTypeChange}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Message Panel */}
            <MessagePanel
              messages={messageHistory}
              onSendEcho={sendEcho}
              onSendBroadcast={sendBroadcast}
              onSendPing={sendPing}
              connected={connectionStatus.connected}
            />

            {/* Chat Panel */}
            <ChatPanel
              messages={chatMessages}
              username={username}
              currentRoom={currentRoom}
              onSendMessage={sendChatMessage}
              onUsernameChange={setUsername}
              connected={connectionStatus.connected}
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Stats Panel */}
            <StatsPanel
              stats={stats}
              connectionStatus={connectionStatus}
            />

            {/* Room Panel */}
            <RoomPanel
              rooms={rooms}
              currentRoom={currentRoom}
              onJoinRoom={handleJoinRoom}
              onLeaveRoom={handleLeaveRoom}
              onSelectRoom={setCurrentRoom}
              connected={connectionStatus.connected}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-gray-500 text-sm">
          <p>
            WebSocket Demo - Built with React, TypeScript, and Tailwind CSS
          </p>
          <p className="mt-1">
            Server Types: Basic WebSocket | Advanced WebSocket | Socket.IO
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
