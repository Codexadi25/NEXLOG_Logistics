/**
 * LocationService.js
 * 
 * Handles:
 *  - Foreground GPS tracking (high accuracy)
 *  - Background tracking via react-native-background-geolocation
 *  - 1-minute buffer: collects coordinates, flushes to server every 60s
 *  - Works whether device location is "on" (GPS) or "off" (network/WiFi fallback)
 *  - Persists buffer to AsyncStorage so no data is lost on crash/kill
 */

import BackgroundGeolocation from 'react-native-background-geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SocketService } from './SocketService';
import { API } from './ApiService';

const BUFFER_KEY = 'location_buffer';
const FLUSH_INTERVAL_MS = 60 * 1000; // 1 minute

class _LocationService {
  constructor() {
    this._buffer = [];
    this._flushTimer = null;
    this._deliveryId = null;
    this._partnerId = null;
    this._isTracking = false;
    this._subscribers = [];
  }

  // ─── Public API ────────────────────────────────────────────────

  /**
   * Start tracking for a given delivery.
   * @param {string} deliveryId  - Active delivery ObjectId
   * @param {string} partnerId   - Delivery partner ObjectId
   */
  async startTracking(deliveryId, partnerId) {
    if (this._isTracking) return;

    this._deliveryId = deliveryId;
    this._partnerId = partnerId;
    this._isTracking = true;

    // Load any persisted buffer (e.g. after crash)
    await this._loadBuffer();

    // Configure BackgroundGeolocation
    await BackgroundGeolocation.ready({
      // ── Geolocation ──────────────────────────────────────────
      desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
      distanceFilter: 10,          // fire every 10 m of movement
      locationUpdateInterval: 15000, // Android: min 15s between updates
      minimumActivityType: BackgroundGeolocation.MOTION_TYPE_ON_FOOT,

      // ── Network ──────────────────────────────────────────────
      // Falls back to network/WiFi location when GPS is unavailable
      locationAuthorizationRequest: 'Always',
      backgroundPermissionRationale: {
        title: "Allow {applicationName} to access your location in the background?",
        message: "LogiTrack uses your location to update delivery status in real time.",
        positiveAction: "Allow in Background",
        negativeAction: "Cancel",
      },

      // ── Battery ──────────────────────────────────────────────
      stopOnTerminate: false,      // keep tracking after app is killed
      startOnBoot: true,           // restart tracking after device reboot
      enableHeadless: true,        // Android headless mode (app killed)
      heartbeatInterval: 60,       // wake up every 60s if stationary

      // ── HTTP (fallback when socket is down) ──────────────────
      url: `${API.BASE_URL}/locations/batch`,
      method: 'POST',
      batchSync: true,
      autoSync: false,             // we handle syncing manually via flush
      headers: { Authorization: `Bearer ${await _getToken()}` },
      params: { deliveryId, partnerId },

      // ── Debug ────────────────────────────────────────────────
      debug: __DEV__,
      logLevel: __DEV__
        ? BackgroundGeolocation.LOG_LEVEL_VERBOSE
        : BackgroundGeolocation.LOG_LEVEL_OFF,
    });

    // Listen for location events
    BackgroundGeolocation.onLocation(this._onLocation.bind(this), this._onError.bind(this));
    BackgroundGeolocation.onHeartbeat(this._onHeartbeat.bind(this));
    BackgroundGeolocation.onConnectivityChange(this._onConnectivity.bind(this));

    await BackgroundGeolocation.start();

    // Start the 1-minute flush timer
    this._startFlushTimer();

    console.log('[LocationService] Tracking started', { deliveryId, partnerId });
  }

  async stopTracking() {
    if (!this._isTracking) return;
    this._isTracking = false;

    clearInterval(this._flushTimer);
    this._flushTimer = null;

    // Final flush before stopping
    await this._flushBuffer();

    await BackgroundGeolocation.stop();
    await BackgroundGeolocation.removeListeners();

    this._buffer = [];
    this._deliveryId = null;
    this._partnerId = null;

    console.log('[LocationService] Tracking stopped');
  }

  /**
   * Subscribe to live location updates (for UI map rendering).
   * Returns an unsubscribe function.
   */
  subscribe(callback) {
    this._subscribers.push(callback);
    return () => {
      this._subscribers = this._subscribers.filter((cb) => cb !== callback);
    };
  }

  getIsTracking() {
    return this._isTracking;
  }

  // ─── Private ──────────────────────────────────────────────────

  _onLocation(location) {
    const point = this._normalizeLocation(location);

    // 1. Notify live UI subscribers immediately (no delay)
    this._subscribers.forEach((cb) => cb(point));

    // 2. Push to buffer (will be flushed every 60s)
    this._buffer.push(point);
    this._persistBuffer();

    // 3. Emit real-time event via Socket (for ops dashboard)
    //    This is the "live" feed – still sent instantly.
    SocketService.emit('location:live', {
      deliveryId: this._deliveryId,
      partnerId: this._partnerId,
      point,
    });
  }

  _onHeartbeat({ location }) {
    // Called when device is stationary – still get a position
    if (location) this._onLocation(location);
  }

  _onError(error) {
    console.warn('[LocationService] Error:', error);
    // Degrade gracefully: attempt a network location request
    BackgroundGeolocation.getCurrentPosition({
      samples: 1,
      persist: true,
      extras: { fallback: true },
    })
      .then(this._onLocation.bind(this))
      .catch(() => {});
  }

  _onConnectivity({ connected }) {
    if (connected && this._buffer.length > 0) {
      // Back online – flush immediately
      this._flushBuffer();
    }
  }

  _normalizeLocation(raw) {
    return {
      lat: raw.coords.latitude,
      lng: raw.coords.longitude,
      accuracy: raw.coords.accuracy,          // metres
      speed: raw.coords.speed ?? 0,           // m/s
      heading: raw.coords.heading ?? 0,
      altitude: raw.coords.altitude ?? 0,
      provider: raw.coords.accuracy > 100
        ? 'network'
        : 'gps',                              // infer provider from accuracy
      timestamp: raw.timestamp,
      isMoving: raw.is_moving,
      batteryLevel: raw.battery?.level ?? -1,
    };
  }

  // ─── Buffer ────────────────────────────────────────────────────

  _startFlushTimer() {
    this._flushTimer = setInterval(() => {
      this._flushBuffer();
    }, FLUSH_INTERVAL_MS);
  }

  async _flushBuffer() {
    if (this._buffer.length === 0) return;

    const snapshot = [...this._buffer];
    this._buffer = [];
    await this._persistBuffer();

    const payload = {
      deliveryId: this._deliveryId,
      partnerId: this._partnerId,
      points: snapshot,
      flushedAt: new Date().toISOString(),
    };

    try {
      // Send batch to REST API → saved in MongoDB
      await API.post('/locations/batch', payload);
      console.log(`[LocationService] Flushed ${snapshot.length} points`);
    } catch (err) {
      console.warn('[LocationService] Flush failed, re-queuing:', err.message);
      // Put points back in the buffer so they're retried next flush
      this._buffer = [...snapshot, ...this._buffer];
      await this._persistBuffer();
    }
  }

  async _persistBuffer() {
    try {
      await AsyncStorage.setItem(BUFFER_KEY, JSON.stringify(this._buffer));
    } catch (_) {}
  }

  async _loadBuffer() {
    try {
      const raw = await AsyncStorage.getItem(BUFFER_KEY);
      if (raw) this._buffer = JSON.parse(raw);
    } catch (_) {}
  }
}

async function _getToken() {
  return (await AsyncStorage.getItem('authToken')) ?? '';
}

export const LocationService = new _LocationService();
