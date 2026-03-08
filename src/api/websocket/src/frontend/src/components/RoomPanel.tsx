// Room Panel Component

import React, { useState } from 'react';
import type { Room } from '../types';

const PREDEFINED_ROOMS = [
  { name: 'general', description: 'General discussion' },
  { name: 'tech', description: 'Technology topics' },
  { name: 'random', description: 'Random conversations' },
] as const;

interface RoomPanelProps {
  rooms: Room[];
  currentRoom: string;
  onJoinRoom: (room: string) => void;
  onLeaveRoom: (room: string) => void;
  onSelectRoom?: (room: string) => void;
  connected: boolean;
}

const RoomPanel: React.FC<RoomPanelProps> = ({
  rooms,
  currentRoom,
  onJoinRoom,
  onLeaveRoom,
  onSelectRoom,
  connected
}) => {
  const [newRoomName, setNewRoomName] = useState('');

  const handleCreateRoom = () => {
    if (!newRoomName.trim() || !connected) return;

    onJoinRoom(newRoomName.trim());
    setNewRoomName('');
  };

  return (
    <div className="card">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Rooms
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Join rooms to chat with specific groups
        </p>
      </div>

      <div className="p-4">
        {/* Create Room */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Create or Join Room
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Enter room name..."
              className="input flex-1"
              disabled={!connected}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleCreateRoom();
              }}
            />
            <button
              onClick={handleCreateRoom}
              disabled={!connected || !newRoomName.trim()}
              className="btn-primary"
            >
              Join
            </button>
          </div>
        </div>

        {/* Predefined Rooms */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Quick Join
          </h3>
          <div className="space-y-2">
            {PREDEFINED_ROOMS.map((room) => {
              const isJoined = rooms.some(r => r.id === room.name && r.joined);
              const isCurrent = currentRoom === room.name;
              
              return (
                <div
                  key={room.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => isJoined && onSelectRoom?.(room.name)}
                  onKeyDown={(e) => isJoined && onSelectRoom && (e.key === 'Enter' || e.key === ' ') && onSelectRoom(room.name)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                    isCurrent 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">#{room.name}</div>
                    <div className="text-xs text-gray-500">{room.description}</div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                    
                    {isJoined ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); onLeaveRoom(room.name); }}
                        disabled={!connected}
                        className="text-xs btn-secondary"
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); onJoinRoom(room.name); }}
                        disabled={!connected}
                        className="text-xs btn-primary"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Joined Rooms */}
        {rooms.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Your Rooms
            </h3>
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => room.joined && onSelectRoom?.(room.id)}
                  onKeyDown={(e) => room.joined && onSelectRoom && (e.key === 'Enter' || e.key === ' ') && onSelectRoom(room.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${
                    currentRoom === room.id 
                      ? 'border-primary-500 bg-primary-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">#{room.name}</div>
                    <div className="text-xs text-gray-500">
                      {room.clientCount} member{room.clientCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {currentRoom === room.id && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                    
                    {room.joined && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onLeaveRoom(room.id); }}
                        disabled={!connected}
                        className="text-xs btn-secondary"
                      >
                        Leave
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Empty State */}
        {rooms.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <div className="text-3xl mb-2">🏠</div>
            <p className="text-sm">No rooms joined yet</p>
            <p className="text-xs mt-1">
              Create or join a room to start group conversations
            </p>
          </div>
        ) : null}
      </div>

      {/* Connection Status */}
      {!connected && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          Connect to join rooms
        </div>
      )}
    </div>
  );
};

export default RoomPanel;
