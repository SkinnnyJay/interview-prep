// Message Panel Component

import React, { useState, useRef, useEffect } from 'react';
import type { WebSocketMessage } from '../types';

interface MessagePanelProps {
  messages: WebSocketMessage[];
  onSendEcho: () => void;
  onSendBroadcast: () => void;
  onSendPing: () => void;
  connected: boolean;
}

const MessagePanel: React.FC<MessagePanelProps> = ({
  messages,
  onSendEcho,
  onSendBroadcast,
  onSendPing,
  connected
}) => {
  const [customMessage, setCustomMessage] = useState('');
  const [customType, setCustomType] = useState('custom');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getMessageTypeColor = (type: string) => {
    const base = type.replace(/^sent_/, '');
    const isSent = type.startsWith('sent_');
    const sentClass = 'border-l-4 border-l-amber-400';
    switch (base) {
      case 'connect':
        return `bg-success-50 text-success-700 border-success-200 ${isSent ? sentClass : ''}`;
      case 'disconnect':
        return `bg-error-50 text-error-700 border-error-200 ${isSent ? sentClass : ''}`;
      case 'error':
        return `bg-error-50 text-error-700 border-error-200 ${isSent ? sentClass : ''}`;
      case 'ping':
      case 'pong':
        return `bg-blue-50 text-blue-700 border-blue-200 ${isSent ? sentClass : ''}`;
      case 'echo_response':
        return `bg-purple-50 text-purple-700 border-purple-200 ${isSent ? sentClass : ''}`;
      case 'broadcast_message':
        return `bg-orange-50 text-orange-700 border-orange-200 ${isSent ? sentClass : ''}`;
      case 'room_joined':
      case 'room_left':
        return `bg-indigo-50 text-indigo-700 border-indigo-200 ${isSent ? sentClass : ''}`;
      case 'chat':
        return `bg-emerald-50 text-emerald-700 border-emerald-200 ${isSent ? sentClass : ''}`;
      case 'send_message':
        return `bg-amber-50 text-amber-700 border-amber-200 ${sentClass}`;
      default:
        return `bg-gray-50 text-gray-700 border-gray-200 ${isSent ? sentClass : ''}`;
    }
  };

  const renderPayload = (payload: unknown, type?: string): React.ReactNode => {
    if (typeof payload === 'string') return payload;
    if (typeof payload === 'object' && payload !== null) {
      const obj = payload as Record<string, unknown>;
      const isChat = type === 'chat' || type === 'sent_send_message' || type === 'send_message';
      const messageText = typeof obj.message === 'string' ? obj.message : null;
      return (
        <div className="mt-1">
          {isChat && messageText !== null && (
            <p className="text-sm font-medium text-gray-800 mb-1">
              Message text: &quot;{messageText}&quot;
            </p>
          )}
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      );
    }
    return String(payload);
  };

  return (
    <div className="card">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Message Console
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Real-time WebSocket message log and testing tools
        </p>
      </div>

      {/* Test Controls */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={onSendPing}
            disabled={!connected}
            className="btn-secondary"
          >
            Send Ping
          </button>
          <button
            onClick={onSendEcho}
            disabled={!connected}
            className="btn-secondary"
          >
            Send Echo
          </button>
          <button
            onClick={onSendBroadcast}
            disabled={!connected}
            className="btn-secondary"
          >
            Send Broadcast
          </button>
        </div>

        {/* Custom Message */}
        <div className="flex gap-2">
          <select
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            className="input flex-shrink-0"
            disabled={!connected}
          >
            <option value="custom">Custom</option>
            <option value="test">Test</option>
            <option value="notification">Notification</option>
            <option value="status">Status</option>
          </select>
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Enter custom message..."
            className="input flex-1"
            disabled={!connected}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && customMessage.trim()) {
                // This would need to be passed as a prop to send custom messages
                setCustomMessage('');
              }
            }}
          />
          <button
            onClick={() => {
              if (customMessage.trim()) {
                // This would need to be passed as a prop to send custom messages
                setCustomMessage('');
              }
            }}
            disabled={!connected || !customMessage.trim()}
            className="btn-primary"
          >
            Send
          </button>
        </div>
      </div>

      {/* Messages Display */}
      <div className="h-96 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">📡</div>
            <p>No messages yet</p>
            <p className="text-sm mt-1">
              Connect to start receiving messages
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`border rounded-lg p-3 ${getMessageTypeColor(message.type)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {message.type.startsWith('sent_')
                        ? `Sent: ${message.type.replace('sent_', '')}`
                        : message.type}
                    </span>
                    {message.clientId && (
                      <span className="text-xs font-mono bg-white bg-opacity-50 px-2 py-1 rounded">
                        {message.clientId.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                  <span className="text-xs opacity-75">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                
                {message.payload && (
                  <div className="mt-2">
                    {renderPayload(message.payload, message.type)}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Count */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        {messages.length} message{messages.length !== 1 ? 's' : ''} (sent + received)
      </div>
    </div>
  );
};

export default MessagePanel;
