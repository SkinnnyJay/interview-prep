// Stats Panel Component

import React from 'react';
import type { ServerStats, ConnectionStatus } from '../types';

interface StatsPanelProps {
  stats: ServerStats | null;
  connectionStatus: ConnectionStatus;
}

const StatsPanel: React.FC<StatsPanelProps> = ({
  stats,
  connectionStatus
}) => {
  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const statItems = stats ? [
    {
      label: 'Active Connections',
      value: formatNumber(stats.activeConnections),
      icon: '👥',
      color: 'text-primary-600'
    },
    {
      label: 'Total Connections',
      value: formatNumber(stats.totalConnections),
      icon: '📊',
      color: 'text-success-600'
    },
    {
      label: 'Messages Sent',
      value: formatNumber(stats.totalMessages),
      icon: '💬',
      color: 'text-purple-600'
    },
    {
      label: 'Messages/sec',
      value: formatNumber(stats.messagesPerSecond),
      icon: '⚡',
      color: 'text-orange-600'
    },
    {
      label: 'Active Rooms',
      value: formatNumber(stats.rooms),
      icon: '🏠',
      color: 'text-indigo-600'
    },
    {
      label: 'Uptime',
      value: formatUptime(stats.uptime),
      icon: '⏱️',
      color: 'text-green-600'
    }
  ] : [];

  return (
    <div className="card">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Server Statistics
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Real-time server metrics and performance data
        </p>
      </div>

      <div className="p-4">
        {connectionStatus.connected && stats ? (
          <div className="space-y-4">
            {/* Connection Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Connection Details
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Server Type:</span>
                  <span className="font-medium capitalize">
                    {connectionStatus.serverType || 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Client ID:</span>
                  <span className="font-mono text-xs">
                    {connectionStatus.clientId?.slice(0, 12)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className="status-connected">Connected</span>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {statItems.map((item) => (
                <div
                  key={item.label}
                  className="bg-white border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-2xl">{item.icon}</div>
                    <div className={`text-right ${item.color}`}>
                      <div className="text-lg font-bold">{item.value}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Performance Indicators */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Performance
              </h3>
              
              {/* Messages per second indicator */}
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Message Rate</span>
                  <span className="font-medium">
                    {stats.messagesPerSecond} msg/s
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((stats.messagesPerSecond / 10) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>

              {/* Connection load indicator */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Connection Load</span>
                  <span className="font-medium">
                    {stats.activeConnections}/1000
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(stats.activeConnections / 1000) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Last Updated */}
            <div className="text-xs text-gray-500 text-center">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        ) : connectionStatus.connecting ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-3xl mb-2">⏳</div>
            <p>Connecting to server...</p>
            <p className="text-sm mt-1">
              Statistics will appear once connected
            </p>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <div className="text-3xl mb-2">📊</div>
            <p>No connection</p>
            <p className="text-sm mt-1">
              Connect to view server statistics
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPanel;
