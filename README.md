# NEXLOG Logistics 🚀

**NEXLOG** is a cutting-edge, high-performance B2B Logistics and Quick Commerce fleet management SaaS application, developed by **Aditya Tech & Devoops**. Built with the MERN stack (MongoDB, Express.js, React, Node.js), it provides end-to-end visibility and operational control for modern delivery ecosystems.

## ✨ Key Features

- **Live WebSocket Tracking**: Real-time geolocation updates and route visualization.
- **Support Lifeline Dashboard**: A powerful "Crystal" lifecycle timeline, 4-pane context views, and multi-mode deep search for rapid issue resolution.
- **Dispatch & Fleet Management**: Auto and manual driver assignment, status tracking, and performance metrics.
- **Role-Based Access Control (RBAC)**: Secure workspaces tailored for Admins, Managers, Agents, Delivery Partners (FE), and Customers.
- **Quick Actions & Issue Logging**: Integrated tagging and internal support notes system.
- **Responsive & Modern UI**: Deep aesthetic integration using CSS variables, glassmorphism, and dynamic micro-animations.

## 🛠️ Technology Stack

- **Frontend**: React.js, Context API, Axios, Vanilla CSS (Tokenized Design System).
- **Backend**: Node.js, Express.js, WebSockets (ws).
- **Database**: MongoDB (Mongoose).
- **Authentication**: JWT (JSON Web Tokens).

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas (or local MongoDB instance)
- Firebase Account (for auth/storage features if used)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/nexlog-logistics.git
   cd nexlog-logistics
   ```

2. **Install Server Dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies:**
   ```bash
   cd ../client
   npm install
   ```

4. **Environment Setup:**
   Duplicate the `.env.example` files in both the `client/` and `server/` directories, rename them to `.env`, and populate them with your credentials (e.g., MongoDB URI, JWT Secret, Firebase Config).

5. **Run the Application Locally:**
   Open two terminal windows:
   
   *Terminal 1 (Backend):*
   ```bash
   cd server
   npm run dev
   ```
   
   *Terminal 2 (Frontend):*
   ```bash
   cd client
   npm start
   ```

## 🌐 Production Deployment

- **Frontend:** Pre-configured for Firebase Hosting (`nexloglogistics.web.app`).
- **Backend:** Pre-configured for Render (`nexlog-logistics.onrender.com`).

## 📄 License
Property of Aditya Tech & Devoops. All rights reserved.
