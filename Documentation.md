# NEXLOG Architecture & Technical Documentation

## 1. System Overview
**NEXLOG** is designed as a highly scalable B2B logistics and delivery network platform. It bridges the gap between Hubs (Merchants), Customers, and Delivery Partners (Field Executives / FE) via a unified real-time dashboard.

### Core Modules:
1. **Order Management System (OMS):** Handles ingestion, tracking, and fulfillment lifecycles.
2. **Fleet & Dispatch:** Manages vehicle assignment, driver statuses, and geographical tracking.
3. **Support Lifeline:** A deeply integrated customer service and operational oversight tool.
4. **Live Tracking:** A WebSocket-powered module that visualizes package movement in real-time.

---

## 2. Database Schema (Mongoose)

### 2.1 User (`User.js`)
Handles RBAC (Role-Based Access Control) and Authentication.
- `role`: Enum `['admin', 'manager', 'agent', 'vendor', 'fe', 'customer']`
- `status`: Enum `['active', 'inactive', 'suspended']`
- `kyc`: Embedded object for identity verification (PAN, Aadhaar, Driving License).

### 2.2 Order (`Order.js`)
Tracks the lifecycle of a specific customer request.
- `status`: Transitions from `pending` -> `confirmed` -> `processing` -> `assigned` -> `picked_up` -> `in_transit` -> `delivered`.
- `internalLogs`: An array of support notes/comments appended by agents via the Lifeline dashboard.
- `pickupAddress` / `deliveryAddress`: Geo-tagged location data.

### 2.3 Shipment (`Shipment.js`)
A single shipment can fulfill an order. Sometimes separated for B2B bulk logistics.
- `trackingNumber`: Unique alphanumeric AWB.
- `trackingEvents`: Array of timestamps and location updates.
- `driverId`: Reference to the assigned delivery partner.

---

## 3. Real-Time WebSockets (`wsServer.js` & `useWebSocket.js`)
WebSockets are utilized to minimize polling overhead.
- **Server:** Attaches to the Express HTTP server via the `ws` package. Broadcasts `tracking_update` and `order_update` events.
- **Client:** React `useWebSocket` hook maintains the connection. Includes auto-reconnection logic and contextual subscriptions (so users only receive data for shipments they are actively tracking).

---

## 4. Frontend Architecture

### 4.1 Tokenized CSS (`App.css`)
The application relies strictly on CSS variables (`--bg-primary`, `--accent`, `--border`) rather than hardcoded colors. This ensures instant global theme switching (e.g., Light/Dark mode) and visual consistency.

### 4.2 Support Lifeline Dashboard (`LifelinePage.js`)
Designed for high-speed resolution by Support Agents:
- **Multi-Mode Search:** Users can query by Order ID, Shipment ID, Driver Phone, Customer Email, etc.
- **4-Pane Context:** Radically reduces time-to-resolution by showing Customer, Merchant, Driver, and Map Route context simultaneously.
- **Click-to-Copy:** Clickable UI elements that instantly copy IDs or phone numbers to the clipboard for external communication.
- **Crystal Timeline:** A visual "progress bar" styled as a timeline, mapping exact timestamps to order status progression.

---

## 5. Security & Authentication
- **JWT (JSON Web Tokens):** Used for stateless API authentication. Tokens are stored in `sessionStorage` to mitigate CSRF, though HttpOnly cookies are recommended for stricter environments.
- **Route Guards:** React Router components wrap protected routes, instantly rejecting users whose roles do not intersect with the required access array (e.g., `role={['admin', 'manager']}`).

---

## 6. Future Technical Roadmap
1. **Algorithmic Dispatching:** Auto-assigning orders based on KD-Tree geographic proximity and FE availability constraints.
2. **Automated KYC OCR:** Extracting textual data directly from uploaded driver licenses via external AI APIs to approve FEs instantly.
3. **Map Tiles Integration:** Upgrading the current CSS-based Route Visualizer to a native Mapbox or Google Maps implementation.
