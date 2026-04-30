# NEXLOG — B2B Logistics Management & Order Tracking System

A full-stack B2B logistics platform built with **Express.js**, **React.js**, **MongoDB**, and **WebSockets (WSS)**. Features real-time shipment tracking, order management, and SVG image storage for delivery items.

---

## 🏗️ Architecture

```
logistics-app/
├── server/                   # Express.js backend
│   ├── index.js              # Entry point (Express + HTTP + WS)
│   ├── seed.js               # Demo data seeder
│   ├── models/
│   │   ├── User.js           # User model (bcrypt auth)
│   │   ├── Order.js          # Orders with item SVG images
│   │   └── Shipment.js       # Shipments with live tracking
│   ├── routes/
│   │   ├── auth.js           # JWT auth routes
│   │   ├── orders.js         # Full CRUD for orders
│   │   ├── shipments.js      # Shipment management
│   │   ├── tracking.js       # Public tracking endpoint
│   │   ├── dashboard.js      # Analytics & stats
│   │   └── images.js         # Image → SVG conversion
│   ├── middleware/
│   │   └── auth.js           # JWT middleware + RBAC
│   ├── websocket/
│   │   └── wsServer.js       # WSS server with subscriptions
│   └── utils/
│       └── imageConverter.js # Sharp-based image → SVG pipeline
│
└── client/                   # React.js frontend
    └── src/
        ├── App.js            # Root with auth routing
        ├── App.css           # Design system (CSS variables)
        ├── context/
        │   └── AuthContext.js    # JWT auth + Axios instance
        ├── hooks/
        │   └── useWebSocket.js   # WSS hook with auto-reconnect
        ├── pages/
        │   └── LoginPage.js      # Auth page
        └── components/
            ├── dashboard/
            │   ├── DashboardLayout.js  # Sidebar + header shell
            │   └── DashboardHome.js    # Stats + Recharts
            ├── orders/
            │   ├── OrdersPage.js       # Orders table + filters
            │   └── OrderModal.js       # Create/edit + image upload
            ├── shipments/
            │   └── ShipmentsPage.js    # Shipment management
            └── tracking/
                └── TrackingPage.js     # Live tracking + route viz
```

---

## ⚙️ Tech Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Backend     | Express.js (Node.js)                           |
| Database    | MongoDB + Mongoose ODM                         |
| Real-time   | WebSocket (ws library) — `wss://`              |
| Auth        | JWT + bcrypt                                   |
| Image→SVG   | Sharp (resize/optimize) + base64 SVG wrapper   |
| Frontend    | React.js 18                                    |
| Charts      | Recharts                                       |
| Fonts       | Rajdhani, Space Mono, Inter                    |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- npm

### 1. Clone & Install

```bash
cd logistics-app
npm install          # root deps
cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/logistics_db
JWT_SECRET=your-super-secret-key-change-this
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Seed Demo Data

```bash
cd server
node seed.js
```

This creates demo users and 30 orders with 8 shipments.

### 4. Start Development

From the **root** directory:
```bash
npm run dev
```

Or separately:
```bash
# Terminal 1 — Backend
cd server && npm run dev   # http://localhost:5000

# Terminal 2 — Frontend
cd client && npm start     # http://localhost:3000
```

---

## 👤 Demo Accounts

| Role    | Email                     | Password    |
|---------|---------------------------|-------------|
| Admin   | admin@nexlog.com          | admin123    |
| Manager | manager@nexlog.com        | manager123  |
| Driver  | driver@nexlog.com         | driver123   |
| Client  | client@acme.com           | client123   |
| Client  | client2@techsupply.com    | client123   |

---

## 🔌 WebSocket Protocol

Connect to `ws://localhost:5000/ws?token=<JWT>`

### Client → Server messages:
```json
{ "type": "subscribe_tracking", "shipmentId": "<id>" }
{ "type": "unsubscribe_tracking", "shipmentId": "<id>" }
{ "type": "ping" }
```

### Server → Client messages:
```json
{ "type": "connected", "userId": "..." }
{ "type": "tracking_update", "shipmentId": "...", "status": "...", "currentLocation": {...} }
{ "type": "order_update", "order": {...} }
{ "type": "subscribed", "shipmentId": "..." }
```

---

## 🖼️ Image → SVG Pipeline

When uploading an item image:
1. **Multer** receives the multipart upload (max 5MB)
2. **Sharp** resizes to max 400×400px and optimizes as PNG
3. The PNG is base64-encoded and wrapped in an `<svg>` element with embedded `<image>` tag
4. The SVG string is stored directly in MongoDB on the Order's item subdocument
5. The frontend renders it using `dangerouslySetInnerHTML`

This approach keeps images portable, queryable alongside order data, and renderable in any browser without separate file storage.

---

## 📡 API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
PATCH  /api/auth/me
PATCH  /api/auth/change-password
```

### Orders
```
GET    /api/orders           (paginated, filtered)
GET    /api/orders/:id
POST   /api/orders
PATCH  /api/orders/:id
DELETE /api/orders/:id       (admin only)
PATCH  /api/orders/:orderId/items/:itemId/image
```

### Shipments
```
GET    /api/shipments
GET    /api/shipments/:id
POST   /api/shipments
PATCH  /api/shipments/:id    (status, location, events, POD)
GET    /api/shipments/track/:trackingNumber  (public)
```

### Dashboard
```
GET    /api/dashboard/stats
```

### Images
```
POST   /api/images/convert   (multipart image → SVG)
POST   /api/images/signature (base64 PNG → SVG)
GET    /api/images/placeholder?label=X
```

---

## 🔐 Role-Based Access

| Feature             | Admin | Manager | Driver | Client |
|---------------------|-------|---------|--------|--------|
| View all orders     | ✅    | ✅      | ❌     | ❌     |
| View own orders     | ✅    | ✅      | ✅     | ✅     |
| Create orders       | ✅    | ✅      | ❌     | ✅     |
| Update status       | ✅    | ✅      | ✅     | ❌     |
| Delete orders       | ✅    | ❌      | ❌     | ❌     |
| Create shipments    | ✅    | ✅      | ❌     | ❌     |
| Update location     | ✅    | ✅      | ✅     | ❌     |
| Dashboard stats     | ✅    | ✅      | ✅*    | ✅*    |

*Filtered to their own data

---

## 🌐 Production Deployment

### MongoDB Atlas
Update `MONGODB_URI` in `.env` to your Atlas connection string.

### Build frontend
```bash
cd client && npm run build
```

Then serve `client/build` as static files from Express (add to `server/index.js`):
```js
app.use(express.static(path.join(__dirname, '../client/build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));
```

### WebSocket on production
Update `REACT_APP_WS_URL` in client `.env`:
```env
REACT_APP_WS_URL=wss://your-domain.com/ws
```
