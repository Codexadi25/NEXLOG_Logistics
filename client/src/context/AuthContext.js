import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_TIMEOUT = 300000; // 5 minutes (300 seconds)
const MAX_RETRIES = 3;
const RETRY_DELAY = 240000; // 4 minutes (240,000 ms)

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: API_TIMEOUT,
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Track retry count
  config.__retryCount = config.__retryCount || 0;
  return config;
});

// Response interceptor: retry on network/server errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Don't retry if no config, or if it was a cancel, or if max retries reached
    if (!config || axios.isCancel(error) || config.__retryCount >= MAX_RETRIES) {
      return Promise.reject(error);
    }

    // Retry on network errors (server down) or 502/503/504 status codes
    const isNetworkError = !error.response && error.code !== 'ECONNABORTED';
    const isServerError = error.response && [502, 503, 504].includes(error.response.status);

    if (isNetworkError || isServerError) {
      config.__retryCount += 1;
      const delay = RETRY_DELAY; // constant 4-minute delay
      console.log(`⏳ API retry ${config.__retryCount}/${MAX_RETRIES} in ${delay / 1000}s for ${config.url} (waiting for server to spin up)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
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

  const logout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, register, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { api };
