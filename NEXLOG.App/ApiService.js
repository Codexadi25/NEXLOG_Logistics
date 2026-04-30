/**
 * ApiService.js – Centralized HTTP client for NEXLOG Delivery App
 * Update BASE_URL to your server's LAN IP when running locally.
 * Use ngrok/HTTPS for production.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Change this to your server IP (use `ipconfig` on Windows) ──
const BASE_URL = process.env.REACT_APP_API_URL || 'http://192.168.1.100:5000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://192.168.1.100:5000';

async function getHeaders(isFormData = false) {
  const token = await AsyncStorage.getItem('authToken');
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (!isFormData) headers['Content-Type'] = 'application/json';
  return headers;
}

async function request(method, path, body, isFormData = false) {
  try {
    const headers = await getHeaders(isFormData);
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    if (err.message === 'Network request failed') {
      throw new Error('Cannot connect to server. Check your Wi-Fi and server IP.');
    }
    throw err;
  }
}

export const API = {
  BASE_URL,
  SOCKET_URL,
  get:    (path)           => request('GET',    path),
  post:   (path, body)     => request('POST',   path, body),
  put:    (path, body)     => request('PUT',    path, body),
  patch:  (path, body)     => request('PATCH',  path, body),
  delete: (path)           => request('DELETE', path),
  upload: (path, formData) => request('POST',   path, formData, true),
};

// ── Auth helpers ─────────────────────────────────────────────────────────────
export async function loginUser(email, password) {
  const data = await API.post('/auth/login', { email, password });
  await AsyncStorage.setItem('authToken', data.token);
  await AsyncStorage.setItem('userData', JSON.stringify(data.user));
  return data;
}

export async function logoutUser() {
  await AsyncStorage.multiRemove(['authToken', 'userData']);
}

export async function getSavedUser() {
  const u = await AsyncStorage.getItem('userData');
  const t = await AsyncStorage.getItem('authToken');
  return { user: u ? JSON.parse(u) : null, token: t };
}

export async function updateProfile(updates) {
  const data = await API.patch('/auth/me', updates);
  await AsyncStorage.setItem('userData', JSON.stringify(data.user));
  return data;
}
