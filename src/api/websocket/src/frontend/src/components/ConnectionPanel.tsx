// Connection Panel Component

import React from 'react';
import type { ServerType, ConnectionStatus } from '../types';

const SERVER_TYPE_OPTIONS: { value: ServerType; label: string; description: string }[] = [
  {
    value: 'basic',
    label: 'Basic WebSocket',
    description: 'Standard WebSocket with basic features'
  },
  {
    value: 'advanced',
    label: 'Advanced WebSocket',
    description: 'WebSocket with rate limiting, history, and presence'
  },
  {
    value: 'socketio',
    label: 'Socket.IO',
    description: 'Socket.IO with namespaces and events'
  }
];

interface ConnectionPanelProps {
  serverType: ServerType;
  connectionStatus: ConnectionStatus;
  onServerTypeChange: (type: ServerType) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  serverType,
  connectionStatus,
  onServerTypeChange,
  onConnect,
  onDisconnect
}) => {
  const getStatusColor = () => {
    if (connectionStatus.connecting) return 'status-connecting';
    if (connectionStatus.connected) return 'status-connected';
    return 'status-disconnected';
  };

  const getStatusText = () => {
    if (connectionStatus.connecting) return 'Connecting...';
    if (connectionStatus.connected) return 'Connected';
    return 'Disconnected';
  };

  return (
    <div className="card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Connection Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus.connected ? 'bg-success-500' : 
              connectionStatus.connecting ? 'bg-warning-500' : 'bg-error-500'
            }`} />
            <span className={getStatusColor()}>
              {getStatusText()}
            </span>
          </div>
          
          {connectionStatus.clientId && (
            <div className="text-sm text-gray-500">
              ID: {connectionStatus.clientId.slice(0, 8)}...
            </div>
          )}
          
          {connectionStatus.error && (
            <div className="text-sm text-error-600">
              Error: {connectionStatus.error}
            </div>
          )}
        </div>

        {/* Connection Controls */}
        <div className="flex gap-2">
          {connectionStatus.connected ? (
            <button
              onClick={onDisconnect}
              className="btn-error"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={connectionStatus.connecting}
              className="btn-success"
            >
              {connectionStatus.connecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>
      </div>

      {/* Server Type Selection */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Server Type
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SERVER_TYPE_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`relative rounded-lg border-2 cursor-pointer transition-colors ${
                serverType === option.value
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => onServerTypeChange(option.value)}
            >
              <div className="p-4">
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="serverType"
                    value={option.value}
                    checked={serverType === option.value}
                    onChange={() => onServerTypeChange(option.value)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                  />
                  <label className="ml-3 block text-sm font-medium text-gray-900">
                    {option.label}
                  </label>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {option.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Server Info */}
        {connectionStatus.connected && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Connection Info
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Server Type:</span>
                <span className="ml-2 font-medium">
                  {connectionStatus.serverType || serverType}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Client ID:</span>
                <span className="ml-2 font-mono text-xs">
                  {connectionStatus.clientId}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionPanel;
