# 🚚 LogiTrack – Delivery Partner Tracking App

A full-stack logistics location tracking system for delivery partners, built with **React Native** (Android) + **Node.js** + **MongoDB**.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Delivery Partner App                       │
│  (React Native – Android)                                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  BackgroundGeolocation (foreground + background)     │   │
│  │  • GPS when available (high accuracy)                │   │
│  │  • Network/WiFi fallback when GPS is OFF             │   │
│  │  • Headless mode when app is KILLED                  │   │
│  └──────────────┬───────────────────────────────────────┘   │
│                 │  raw location events                       │
│  ┌──────────────▼───────────────────────────────────────┐   │
│  │  LocationService (buffer layer)                      │   │
│  │  • Accumulates points in memory + AsyncStorage       │   │
│  │  • Flushes batch via REST every 60 seconds           │   │
│  │  • Emits live events via Socket.IO (no delay)        │   │
│  └──────────┬─────────────────────┬─────────────────────┘   │
│             │                     │                          │
│       REST batch              Socket live                    │
│      (every 60s)            (every location)                 │
└─────────────┼─────────────────────┼────────────────────────┘
              │                     │
┌─────────────▼─────────────────────▼────────────────────────┐
│                    Node.js Backend                           │
│                                                              │
│  POST /api/locations/batch  ←── batched points (60s delay)  │
│  Socket: location:live      ←── real-time feed              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MongoDB – LocationBatch collection                  │   │
│  │  • One document per flush (≈ 4–8 points/batch)       │   │
│  │  • TTL index: auto-delete after 90 days              │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Socket.IO rooms:  delivery:{id}  ← ops dashboard joins     │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Features

| Feature | How it works |
|---|---|
| **GPS tracking** | `react-native-background-geolocation` with `DESIRED_ACCURACY_HIGH` |
| **Location OFF fallback** | Automatic degradation to network/WiFi provider (`accuracy > 100m → 'network'`) |
| **Background tracking** | `stopOnTerminate: false` – survives app backgrounding |
| **Killed app tracking** | `enableHeadless: true` + Android headless task |
| **Boot persistence** | `startOnBoot: true` + `RECEIVE_BOOT_COMPLETED` permission |
| **1-min buffer** | `setInterval(flush, 60_000)` in `LocationService` – batch REST POST |
| **Real-time feed** | Socket.IO `location:live` event fired on every GPS update |
| **Offline resilience** | Buffer persisted to `AsyncStorage`; re-queued on flush failure |
| **MongoDB storage** | `LocationBatch` model – one doc per 60s flush, with TTL index |

---

## Project Structure

```
LogisticsTracker/
├── App.js                        # Root navigator, session restore
├── package.json                  # RN dependencies
├── android/
│   └── AndroidManifest.xml       # All required permissions
│
├── src/
│   ├── context/
│   │   └── AuthContext.js
│   ├── services/
│   │   ├── LocationService.js    # ⭐ Core tracking + buffer logic
│   │   ├── SocketService.js      # Socket.IO client
│   │   └── ApiService.js         # HTTP client
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── DashboardScreen.js
│   │   ├── ActiveDeliveryScreen.js
│   │   └── HistoryScreen.js
│   └── components/
│       ├── LocationStatusBar.js
│       └── StatusBadge.js
│
└── backend/
    ├── server.js                 # Express + Socket.IO + routes
    ├── package.json
    ├── .env.example
    └── models/
        ├── DeliveryPartner.js
        ├── Delivery.js           # in models/index.js
        └── LocationBatch.js      # in models/index.js
```

---

## Setup

### 1. React Native App

```bash
# Install dependencies
npm install

# For react-native-background-geolocation (requires license for production)
# https://github.com/transistorsoft/react-native-background-geolocation

# Link native modules
npx react-native run-android
```

Update `src/services/ApiService.js`:
```js
const BASE_URL = 'https://your-backend.com/api';
const SOCKET_URL = 'https://your-backend.com';
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
node server.js
```

### 3. MongoDB Atlas

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Whitelist your server IP
3. Paste connection string into `MONGO_URI` in `.env`

The `LocationBatch` collection has a **90-day TTL index** – old location data is automatically purged.

---

## Android Permissions Required

| Permission | Purpose |
|---|---|
| `ACCESS_FINE_LOCATION` | High-accuracy GPS |
| `ACCESS_COARSE_LOCATION` | Network/WiFi fallback |
| `ACCESS_BACKGROUND_LOCATION` | Tracking when app is backgrounded/killed |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` | Persistent notification during tracking |
| `RECEIVE_BOOT_COMPLETED` | Restart tracking after reboot |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Prevent Doze mode from killing the tracker |
| `WAKE_LOCK` | Keep CPU alive during background updates |

> **Note:** On Android 11+, `ACCESS_BACKGROUND_LOCATION` must be granted separately in Settings → App → Permissions → Location → "Allow all the time". The app will prompt for this.

---

## Location Buffer: How it Works

```
t=0s   GPS fix → buffer = [pt1]          → Socket: location:live (instant)
t=15s  GPS fix → buffer = [pt1, pt2]     → Socket: location:live (instant)
t=30s  GPS fix → buffer = [pt1..pt3]     → Socket: location:live (instant)
t=45s  GPS fix → buffer = [pt1..pt4]     → Socket: location:live (instant)
t=60s  FLUSH   → POST /locations/batch   → MongoDB saved ✅ → buffer = []
t=75s  GPS fix → buffer = [pt5]          → ...
```

- **Live tracking** (no delay): operations team gets real-time position via Socket.IO
- **Persistent storage** (60s delay): batches saved to MongoDB with full metadata
- **Offline**: buffer persisted to `AsyncStorage`, retried on next flush

---

## MongoDB Document Example

```json
{
  "_id": "65f1a2b3...",
  "deliveryId": "65e9c1d2...",
  "partnerId": "65e8a0b1...",
  "flushedAt": "2024-03-13T10:31:00.000Z",
  "pointCount": 4,
  "points": [
    {
      "lat": 28.6139,
      "lng": 77.2090,
      "accuracy": 8,
      "speed": 5.2,
      "heading": 127,
      "altitude": 216,
      "provider": "gps",
      "timestamp": "2024-03-13T10:30:00.000Z",
      "isMoving": true,
      "batteryLevel": 0.82
    }
  ]
}
```
