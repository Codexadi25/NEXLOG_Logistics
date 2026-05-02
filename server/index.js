const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const shipmentRoutes = require('./routes/shipments');
const trackingRoutes = require('./routes/tracking');
const imageRoutes = require('./routes/images');
const dispatchRoutes = require('./routes/dispatch');
const dashboardRoutes = require('./routes/dashboard');
const usersRoutes = require('./routes/users');
const lifelineRoutes = require('./routes/lifeline');
const { initWebSocket } = require('./websocket/wsServer');

const app = express();
const server = http.createServer(app);

// Init WebSocket
initWebSocket(server);

// Middleware
app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    'http://localhost:3000',
    'https://nexloglogistics.web.app',
    'https://nexloglogistics.firebaseapp.com'
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/dispatch', dispatchRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/lifeline', lifelineRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server immediately (don't wait for MongoDB)
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});

// MongoDB connection with retry logic
const MAX_RETRIES = 10;
const RETRY_INTERVAL = 5000; // 5 seconds
let retryCount = 0;

const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/logistics_db');
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    retryCount++;
    console.error(`❌ MongoDB connection attempt ${retryCount}/${MAX_RETRIES} failed:`, err.message);
    if (retryCount < MAX_RETRIES) {
      console.log(`⏳ Retrying in ${RETRY_INTERVAL / 1000}s...`);
      setTimeout(connectMongoDB, RETRY_INTERVAL);
    } else {
      console.error('💀 Max retries reached. MongoDB is unavailable. Server running without database.');
      console.error('   Fix: Try disabling Cloudflare WARP or check your MONGODB_URI in .env');
    }
  }
};

connectMongoDB();

module.exports = { app, server };

// Trigger nodemon restart
