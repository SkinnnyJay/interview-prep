// Chat Panel Component

import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  username: string;
  currentRoom: string;
  onSendMessage: (message: string, room?: string) => void;
  onUsernameChange: (username: string) => void;
  connected: boolean;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  username,
  currentRoom,
  onSendMessage,
  onUsernameChange,
  connected
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [tempUsername, setTempUsername] = useState(username);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Update temp username when prop changes
  useEffect(() => {
    setTempUsername(username);
  }, [username]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !connected) return;
    
    onSendMessage(newMessage.trim(), currentRoom);
    setNewMessage('');
  };

  const handleUsernameSubmit = () => {
    if (tempUsername.trim() && tempUsername !== username) {
      onUsernameChange(tempUsername.trim());
    }
    setIsEditingUsername(false);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const filteredMessages = currentRoom 
    ? messages.filter(msg => msg.room === currentRoom)
    : messages.filter(msg => !msg.room);

  return (
    <div className="card">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Chat {currentRoom && `- ${currentRoom}`}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {currentRoom ? `Room: ${currentRoom}` : 'Global chat'}
            </p>
          </div>
          
          {/* Username Editor */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Username:</span>
            {isEditingUsername ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value)}
                  className="input text-sm w-24"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleUsernameSubmit();
                    if (e.key === 'Escape') {
                      setTempUsername(username);
                      setIsEditingUsername(false);
                    }
                  }}
                  onBlur={handleUsernameSubmit}
                  autoFocus
                />
              </div>
            ) : (
              <button
                onClick={() => setIsEditingUsername(true)}
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {username}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages Display */}
      <div className="h-80 overflow-y-auto p-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>No messages yet</p>
            <p className="text-sm mt-1">
              {currentRoom 
                ? `Start chatting in ${currentRoom}` 
                : 'Start a conversation'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.username === username ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.username === username
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium opacity-75">
                      {message.username}
                    </span>
                    <span className="text-xs opacity-75 ml-2">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm">{message.message}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Type a message${currentRoom ? ` to ${currentRoom}` : ''}...`}
            className="input flex-1"
            disabled={!connected}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!connected || !newMessage.trim()}
            className="btn-primary"
          >
            Send
          </button>
        </div>
        
        {!connected && (
          <p className="text-xs text-gray-500 mt-2">
            Connect to start chatting
          </p>
        )}
      </div>

      {/* Message Count */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''} 
        {currentRoom && ` in ${currentRoom}`}
      </div>
    </div>
  );
};

export default ChatPanel;
