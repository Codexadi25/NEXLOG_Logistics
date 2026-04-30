/**
 * server.js – LogiTrack Backend
 * Express + Socket.IO + MongoDB
 * 
 * Endpoints:
 *   POST /api/auth/login
 *   GET  /api/deliveries
 *   PATCH /api/deliveries/:id/status
 *   POST /api/locations/batch     ← 1-min buffered batch
 *   GET  /api/locations/:deliveryId
 *
 * Socket events:
 *   location:live     ← from partner app (real-time, no delay)
 *   partner:online / partner:offline
 *   join:delivery / leave:delivery
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ── Models ────────────────────────────────────────────────────────────────────
const DeliveryPartner = require('./models/DeliveryPartner');
const Delivery = require('./models/Delivery');
const LocationBatch = require('./models/LocationBatch');

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'],
});

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// ── MongoDB ───────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅  MongoDB connected'))
  .catch((err) => { console.error('MongoDB error:', err); process.exit(1); });

// ── JWT helpers ───────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ message: 'Unauthorized' });
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

/* ── Auth ── */
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password)
    return res.status(400).json({ message: 'Phone and password required' });

  const partner = await DeliveryPartner.findOne({ phone });
  if (!partner || !(await bcrypt.compare(password, partner.passwordHash)))
    return res.status(401).json({ message: 'Invalid credentials' });

  partner.lastSeen = new Date();
  partner.status = 'online';
  await partner.save();

  res.json({
    token: signToken(partner._id),
    partner: {
      _id: partner._id,
      name: partner.name,
      phone: partner.phone,
      vehicleType: partner.vehicleType,
      vehicleNumber: partner.vehicleNumber,
      avatar: partner.avatar,
    },
  });
});

/* ── Deliveries ── */
app.get('/api/deliveries', authMiddleware, async (req, res) => {
  const { partnerId, date } = req.query;
  const filter = { partnerId };

  if (date === 'today') {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    filter.scheduledDate = { $gte: start, $lte: end };
  }

  const deliveries = await Delivery.find(filter).sort({ createdAt: 1 });
  res.json({ deliveries });
});

app.patch('/api/deliveries/:id/status', authMiddleware, async (req, res) => {
  const { status, location, timestamp } = req.body;

  const delivery = await Delivery.findById(req.params.id);
  if (!delivery) return res.status(404).json({ message: 'Delivery not found' });

  delivery.status = status;
  delivery.statusHistory.push({ status, location, timestamp: timestamp || new Date() });

  if (status === 'delivered') delivery.deliveredAt = new Date();
  if (status === 'failed') delivery.failedAt = new Date();

  await delivery.save();

  // Notify ops dashboard via socket
  io.to(`delivery:${req.params.id}`).emit('delivery:statusUpdate', {
    deliveryId: req.params.id,
    status,
    location,
    timestamp,
  });

  res.json({ delivery });
});

/* ── Locations (batch, 1-min buffer) ── */
app.post('/api/locations/batch', authMiddleware, async (req, res) => {
  const { deliveryId, partnerId, points, flushedAt } = req.body;

  if (!points?.length)
    return res.status(400).json({ message: 'No location points provided' });

  // Save the full batch as one document
  const batch = await LocationBatch.create({
    deliveryId,
    partnerId,
    points,
    flushedAt: flushedAt || new Date(),
    pointCount: points.length,
  });

  // Broadcast each point to ops dashboard room (with the buffer delay already baked in)
  points.forEach((pt) => {
    io.to(`delivery:${deliveryId}`).emit('location:batch_point', {
      deliveryId,
      partnerId,
      point: pt,
    });
  });

  res.json({ saved: batch._id, count: points.length });
});

/* ── Location history ── */
app.get('/api/locations/:deliveryId', authMiddleware, async (req, res) => {
  const batches = await LocationBatch.find({
    deliveryId: req.params.deliveryId,
  }).sort({ flushedAt: 1 });

  // Flatten all batches into a single ordered array
  const points = batches.flatMap((b) => b.points);
  res.json({ points, batchCount: batches.length });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.use((socket, next) => {
  // Authenticate socket connections
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = verifyToken(token);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on('join:delivery', ({ deliveryId }) => {
    socket.join(`delivery:${deliveryId}`);
    console.log(`[Socket] ${socket.id} joined delivery:${deliveryId}`);
  });

  socket.on('leave:delivery', ({ deliveryId }) => {
    socket.leave(`delivery:${deliveryId}`);
  });

  // Real-time live position (no delay – instant broadcast to ops)
  socket.on('location:live', (data) => {
    const { deliveryId, partnerId, point } = data;
    socket.to(`delivery:${deliveryId}`).emit('location:live', {
      partnerId,
      point,
    });
  });

  socket.on('partner:online', ({ partnerId }) => {
    socket.broadcast.emit('partner:online', { partnerId });
  });

  socket.on('partner:offline', ({ partnerId }) => {
    socket.broadcast.emit('partner:offline', { partnerId });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀  LogiTrack server running on port ${PORT}`);
});

module.exports = app;
