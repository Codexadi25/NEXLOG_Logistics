import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { auth, googleProvider } from '../Firebase';
import { signInWithPopup } from 'firebase/auth';

const AuthContext = createContext(null);

const API_TIMEOUT = 300000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 240000; // 4 minutes

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: API_TIMEOUT,
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.__retryCount = config.__retryCount || 0;
  return config;
});

// Response interceptor: retry on network/server errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || axios.isCancel(error) || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }
    const isNetworkError = !error.response && error.code !== 'ECONNABORTED';
    const isServerError = error.response && [502, 503, 504].includes(error.response.status);
    if (isNetworkError || isServerError) {
      config.__retryCount += 1;
      console.log(`⏳ API retry ${config.__retryCount}/${MAX_RETRIES} in ${RETRY_DELAY / 1000}s for ${config.url}`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return api(config);
    }
    return Promise.reject(error);
  }
);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(sessionStorage.getItem('token'));

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      sessionStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchMe();
    else setLoading(false);
  }, [token, fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    sessionStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (userData) => {
    const { data } = await api.post('/auth/register', userData);
    sessionStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  /**
   * Google Sign-In / Sign-Up
   * 1. Opens Google popup via Firebase client SDK
   * 2. Gets Firebase ID token
   * 3. Sends to our backend /auth/google which verifies & upserts the user in MongoDB
   * 4. Returns our own JWT
   */
  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    const { data } = await api.post('/auth/google', { idToken });
    sessionStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    // Also sign out from Firebase (non-blocking)
    try { auth.signOut(); } catch (e) {}
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, register, loginWithGoogle, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { api };
