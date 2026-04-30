import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL ||
  `ws://${window.location.hostname}:5000/ws`;

const WebSocketContext = createContext(null);

export function WebSocketProvider({ token, children }) {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const listeners = useRef(new Map());
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectDelay = 30000; // max 30s between retries

  const connect = useCallback(() => {
    if (!token) return;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    // Clean up any existing connection
    if (ws.current) {
      ws.current.onopen = null;
      ws.current.onmessage = null;
      ws.current.onclose = null;
      ws.current.onerror = null;
      if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
        ws.current.close(1000);
      }
    }

    try {
      const socket = new WebSocket(`${WS_URL}?token=${token}`);

      socket.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
        console.log('🔌 WS connected');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          // Fire type-specific listeners
          if (listeners.current.has(data.type)) {
            listeners.current.get(data.type).forEach((cb) => cb(data));
          }
          // Fire wildcard listeners
          if (listeners.current.has('*')) {
            listeners.current.get('*').forEach((cb) => cb(data));
          }
        } catch (e) {}
      };

      socket.onclose = (e) => {
        setConnected(false);
        if (e.code !== 1000 && e.code !== 4001 && e.code !== 4002) {
          // Exponential backoff with cap
          const delay = Math.min(3000 * Math.pow(1.5, reconnectAttempts.current), maxReconnectDelay);
          reconnectAttempts.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      ws.current = socket;
    } catch (err) {
      console.error('WS connection failed:', err);
    }
  }, [token]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close(1000);
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback((type, callback) => {
    if (!listeners.current.has(type)) listeners.current.set(type, new Set());
    listeners.current.get(type).add(callback);
    return () => listeners.current.get(type)?.delete(callback);
  }, []);

  const subscribeTracking = useCallback((shipmentId) => {
    send({ type: 'subscribe_tracking', shipmentId });
  }, [send]);

  const value = { connected, lastMessage, send, subscribe, subscribeTracking };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return a no-op fallback if used outside provider
    return { connected: false, lastMessage: null, send: () => {}, subscribe: () => () => {}, subscribeTracking: () => {} };
  }
  return context;
}
