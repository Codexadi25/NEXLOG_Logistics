const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');

let wss;
const clients = new Map(); // userId -> Set of ws clients

function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const { query } = url.parse(req.url, true);
    const token = query.token;

    if (!token) {
      ws.close(4001, 'No token provided');
      return;
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.id;
    } catch (err) {
      ws.close(4002, 'Invalid token');
      return;
    }

    // Track client
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(ws);

    ws.userId = userId;
    ws.isAlive = true;

    console.log(`🔌 WS connected: user ${userId} (total: ${wss.clients.size})`);

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        handleMessage(ws, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      if (clients.has(userId)) {
        clients.get(userId).delete(ws);
        if (clients.get(userId).size === 0) {
          clients.delete(userId);
        }
      }
      console.log(`🔌 WS disconnected: user ${userId}`);
    });

    ws.on('error', (err) => {
      console.error('WS error:', err);
    });

    // Send welcome
    ws.send(JSON.stringify({ type: 'connected', message: 'WebSocket connected', userId }));
  });

  // Heartbeat
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  console.log('🔌 WebSocket server initialized');
  return wss;
}

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'subscribe_tracking':
      ws.subscribedShipments = ws.subscribedShipments || new Set();
      ws.subscribedShipments.add(msg.shipmentId);
      ws.send(JSON.stringify({ type: 'subscribed', shipmentId: msg.shipmentId }));
      break;
    case 'unsubscribe_tracking':
      if (ws.subscribedShipments) {
        ws.subscribedShipments.delete(msg.shipmentId);
      }
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
    default:
      break;
  }
}

// Broadcast to specific user
function broadcastToUser(userId, data) {
  if (clients.has(userId)) {
    const msg = JSON.stringify(data);
    clients.get(userId).forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }
}

// Broadcast tracking update to all subscribers of a shipment
function broadcastTrackingUpdate(shipmentId, data) {
  const msg = JSON.stringify({ type: 'tracking_update', shipmentId, ...data });
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN &&
        ws.subscribedShipments &&
        ws.subscribedShipments.has(shipmentId)) {
      ws.send(msg);
    }
  });
}

// Broadcast to all clients
function broadcastAll(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  });
}

// Broadcast order update to a user
function notifyOrderUpdate(userId, order) {
  broadcastToUser(userId, {
    type: 'order_update',
    order,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { initWebSocket, broadcastToUser, broadcastTrackingUpdate, broadcastAll, notifyOrderUpdate };
