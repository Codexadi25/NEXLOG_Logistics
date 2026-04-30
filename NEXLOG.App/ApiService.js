/**
 * ApiService.js – Centralized HTTP client
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://your-backend.com/api'; // Replace with your server
const SOCKET_URL = 'https://your-backend.com';    // Replace with your server

async function getHeaders() {
  const token = await AsyncStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method, path, body) {
  const headers = await getHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const API = {
  BASE_URL,
  SOCKET_URL,
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
};
