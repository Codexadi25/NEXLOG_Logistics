import React from 'react';
import { AuthProvider } from './context/AuthContext';
import AppRoutes from './routes/AppRoutes';
import './App.css';

/**
 * Root application component.
 * AuthProvider wraps everything so that all routes can access auth state.
 * AppRoutes contains the BrowserRouter + all route definitions.
 */
function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
