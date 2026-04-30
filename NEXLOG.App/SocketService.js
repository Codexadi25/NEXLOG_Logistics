/**
 * SocketService.js
 * 
 * Manages Socket.IO connection for real-time location streaming.
 * Handles reconnection, auth, and room joining for delivery sessions.
 */

import { io } from 'socket.io-client';
import { API } from './ApiService';

class _SocketService {
  constructor() {
    this._socket = null;
    this._isConnected = false;
    this._deliveryRoom = null;
  }

  connect(authToken) {
    if (this._socket?.connected) return;

    this._socket = io(API.SOCKET_URL, {
      auth: { token: authToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });

    this._socket.on('connect', () => {
      this._isConnected = true;
      console.log('[SocketService] Connected:', this._socket.id);
      // Rejoin room if we had one
      if (this._deliveryRoom) {
        this._socket.emit('join:delivery', { deliveryId: this._deliveryRoom });
      }
    });

    this._socket.on('disconnect', (reason) => {
      this._isConnected = false;
      console.warn('[SocketService] Disconnected:', reason);
    });

    this._socket.on('connect_error', (err) => {
      console.warn('[SocketService] Connection error:', err.message);
    });
  }

  reconnect() {
    if (!this._socket?.connected) {
      this._socket?.connect();
    }
  }

  disconnect() {
    this._deliveryRoom = null;
    this._socket?.disconnect();
    this._socket = null;
    this._isConnected = false;
  }

  joinDeliveryRoom(deliveryId) {
    this._deliveryRoom = deliveryId;
    if (this._isConnected) {
      this._socket.emit('join:delivery', { deliveryId });
    }
  }

  leaveDeliveryRoom(deliveryId) {
    this._deliveryRoom = null;
    if (this._isConnected) {
      this._socket.emit('leave:delivery', { deliveryId });
    }
  }

  emit(event, data) {
    if (this._isConnected) {
      this._socket.emit(event, data);
    }
    // If not connected, data will be flushed via REST fallback in LocationService
  }

  on(event, callback) {
    this._socket?.on(event, callback);
  }

  off(event, callback) {
    this._socket?.off(event, callback);
  }

  get isConnected() {
    return this._isConnected;
  }
}

export const SocketService = new _SocketService();
