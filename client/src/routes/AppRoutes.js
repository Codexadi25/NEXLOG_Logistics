import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { WebSocketProvider } from '../hooks/useWebSocket';
import Home from '../pages/Home';
import LoginPage from '../pages/LoginPage';
import TrackingPage from '../pages/TrackingPage';
import DashboardLayout from '../components/dashboard/DashboardLayout';
import DriverLayout from '../components/dashboard/DriverLayout';

// Loading screen shown while AuthContext resolves the session
function LoadingScreen() {
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

/**
 * Guard for authenticated routes.
 * If loading → show spinner.
 * If not authenticated → redirect to /login.
 */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Guard for public-only routes (login / home).
 * If already authenticated → redirect to /dashboard.
 */
function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * The authenticated app shell — driver gets DriverLayout, everyone else DashboardLayout.
 */
function AuthenticatedApp() {
  const { user, token } = useAuth();
  return (
    <WebSocketProvider token={token}>
      {user?.role === 'driver' ? <DriverLayout /> : <DashboardLayout />}
    </WebSocketProvider>
  );
}

/**
 * All application routes defined in one central module.
 *
 * Route table:
 *   /              → Home (marketing / landing page)
 *   /login         → LoginPage  (public only — redirects to /dashboard if logged in)
 *   /track         → TrackingPage (always public)
 *   /dashboard     → DashboardLayout / DriverLayout (private)
 *   /*             → redirect to /
 */
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public marketing page */}
        <Route
          path="/"
          element={
            <PublicOnlyRoute>
              <Home />
            </PublicOnlyRoute>
          }
        />

        {/* Auth page — redirects to /dashboard after successful login */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />

        {/* Public tracking — no auth required */}
        <Route path="/track" element={<TrackingPage />} />

        {/* Protected dashboard — all sub-pages are handled inside DashboardLayout */}
        <Route
          path="/dashboard/*"
          element={
            <PrivateRoute>
              <AuthenticatedApp />
            </PrivateRoute>
          }
        />

        {/* Catch-all: send to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
