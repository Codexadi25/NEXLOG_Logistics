import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './hooks/useWebSocket';
import LoginPage from './pages/LoginPage';
import TrackingPage from './pages/TrackingPage';
import DashboardLayout from './components/dashboard/DashboardLayout';
import './App.css';

function AppContent() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">
          <svg viewBox="0 0 60 60" width="60" height="60">
            <polygon points="30,5 55,20 55,40 30,55 5,40 5,20" fill="none" stroke="#00d4ff" strokeWidth="2"/>
            <polygon points="30,15 45,23 45,37 30,45 15,37 15,23" fill="none" stroke="#00d4ff" strokeWidth="1.5" opacity="0.6"/>
            <circle cx="30" cy="30" r="5" fill="#00d4ff"/>
          </svg>
          <span>NEXLOG</span>
        </div>
        <div className="loading-bar"><div className="loading-bar-inner"/></div>
      </div>
    );
  }

  // Simple custom routing for public pages
  if (window.location.pathname === '/track') {
    return <TrackingPage />;
  }

  if (!user) return <LoginPage />;

  return (
    <WebSocketProvider token={token}>
      <DashboardLayout />
    </WebSocketProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
