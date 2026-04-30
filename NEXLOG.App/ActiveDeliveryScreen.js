/**
 * ActiveDeliveryScreen.js
 * Shows live map, delivery details, and delivery actions.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ScrollView, Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LocationService } from '../services/LocationService';
import { SocketService } from '../services/SocketService';
import { API } from '../services/ApiService';
import { useAuth } from '../context/AuthContext';
import LocationStatusBar from '../components/LocationStatusBar';

const DELIVERY_STATUSES = ['in_transit', 'arrived', 'delivered', 'failed'];

export default function ActiveDeliveryScreen({ navigation, route }) {
  const { delivery } = route.params;
  const { deliveryPartner } = useAuth();

  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [deliveryStatus, setDeliveryStatus] = useState(delivery.status);
  const [bufferCount, setBufferCount] = useState(0);
  const [nextFlushIn, setNextFlushIn] = useState(60);
  const [isOnline, setIsOnline] = useState(false);

  const mapRef = useRef(null);
  const flushCountdown = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Subscribe to location updates
    const unsub = LocationService.subscribe((pt) => {
      setCurrentLocation(pt);
      setRouteCoords((prev) => [
        ...prev,
        { latitude: pt.lat, longitude: pt.lng },
      ]);
      setBufferCount((c) => c + 1);

      // Pan map to current location
      mapRef.current?.animateToRegion({
        latitude: pt.lat,
        longitude: pt.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 800);
    });

    setIsOnline(LocationService.getIsTracking());
    startFlushCountdown();
    startPulse();

    return () => {
      unsub();
      clearInterval(flushCountdown.current);
      pulseAnim.stopAnimation();
    };
  }, []);

  const startFlushCountdown = () => {
    let seconds = 60;
    flushCountdown.current = setInterval(() => {
      seconds -= 1;
      setNextFlushIn(seconds);
      if (seconds <= 0) {
        seconds = 60;
        setBufferCount(0); // reset after flush
        setNextFlushIn(60);
      }
    }, 1000);
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  };

  const updateStatus = async (newStatus) => {
    Alert.alert(
      'Update Status',
      `Mark this delivery as "${newStatus}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await API.patch(`/deliveries/${delivery._id}/status`, {
                status: newStatus,
                location: currentLocation,
                timestamp: new Date().toISOString(),
              });
              setDeliveryStatus(newStatus);

              if (newStatus === 'delivered' || newStatus === 'failed') {
                await LocationService.stopTracking();
                SocketService.leaveDeliveryRoom(delivery._id);
                Alert.alert('Done', 'Delivery completed!', [
                  { text: 'OK', onPress: () => navigation.navigate('Dashboard') },
                ]);
              }
            } catch (err) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  const destinationCoord = {
    latitude: delivery.destination?.lat ?? 28.6139,
    longitude: delivery.destination?.lng ?? 77.2090,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Delivery</Text>
        <Text style={styles.orderId}>#{delivery.orderId}</Text>
      </View>

      <LocationStatusBar locationPoint={currentLocation} isTracking={isOnline} />

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={{
            latitude: destinationCoord.latitude,
            longitude: destinationCoord.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={false}
          showsTraffic
        >
          {/* Live position marker */}
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.lat,
                longitude: currentLocation.lng,
              }}
              title="You are here"
            >
              <View style={styles.liveMarker}>
                <Animated.View
                  style={[
                    styles.liveMarkerPulse,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                />
                <View style={styles.liveMarkerDot} />
              </View>
            </Marker>
          )}

          {/* Destination marker */}
          <Marker coordinate={destinationCoord} title={delivery.customerName}>
            <View style={styles.destMarker}>
              <Text style={styles.destMarkerIcon}>📦</Text>
            </View>
          </Marker>

          {/* Route polyline */}
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#FF6B35"
              strokeWidth={3}
            />
          )}
        </MapView>

        {/* Buffer HUD */}
        <View style={styles.bufferHUD}>
          <Text style={styles.bufferTitle}>📡 Buffer</Text>
          <Text style={styles.bufferPoints}>{bufferCount} pts</Text>
          <Text style={styles.bufferFlush}>Flush in {nextFlushIn}s</Text>
        </View>
      </View>

      {/* Delivery info */}
      <ScrollView style={styles.infoScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Row label="Customer" value={delivery.customerName} />
          <Row label="Phone" value={delivery.customerPhone} />
          <Row label="Address" value={delivery.deliveryAddress} />
          <Row label="Order ID" value={`#${delivery.orderId}`} />
          <Row label="Items" value={`${delivery.itemCount} item(s)`} />
          <Row label="Amount (COD)" value={`₹${delivery.codAmount ?? 0}`} />
        </View>

        {/* Location details */}
        {currentLocation && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionLabel}>📍 Current Location</Text>
            <Row label="Latitude" value={currentLocation.lat.toFixed(6)} />
            <Row label="Longitude" value={currentLocation.lng.toFixed(6)} />
            <Row label="Accuracy" value={`${currentLocation.accuracy?.toFixed(0)} m`} />
            <Row label="Speed" value={`${(currentLocation.speed * 3.6).toFixed(1)} km/h`} />
            <Row label="Provider" value={currentLocation.provider} />
          </View>
        )}

        {/* Status actions */}
        <Text style={styles.actionLabel}>Update Delivery Status</Text>
        <View style={styles.actionRow}>
          {deliveryStatus !== 'in_transit' && (
            <ActionBtn
              label="In Transit"
              color="#48BB78"
              onPress={() => updateStatus('in_transit')}
            />
          )}
          {deliveryStatus === 'in_transit' && (
            <ActionBtn
              label="Arrived"
              color="#4299E1"
              onPress={() => updateStatus('arrived')}
            />
          )}
          {(deliveryStatus === 'arrived' || deliveryStatus === 'in_transit') && (
            <ActionBtn
              label="✓ Delivered"
              color="#38A169"
              onPress={() => updateStatus('delivered')}
            />
          )}
          <ActionBtn
            label="✗ Failed"
            color="#E53E3E"
            onPress={() => updateStatus('failed')}
          />
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, color, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1923' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: '#1A2433',
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  backBtn: { marginRight: 12 },
  backText: { color: '#FF6B35', fontWeight: '600', fontSize: 15 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  orderId: { color: '#FF6B35', fontWeight: '700' },

  mapContainer: { height: 260, position: 'relative' },
  map: { flex: 1 },

  liveMarker: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
  liveMarkerPulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B3540',
  },
  liveMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF6B35',
    borderWidth: 2,
    borderColor: '#fff',
  },
  destMarker: {
    backgroundColor: '#1A2433',
    borderRadius: 8,
    padding: 6,
    borderWidth: 2,
    borderColor: '#4299E1',
  },
  destMarkerIcon: { fontSize: 20 },

  bufferHUD: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#0F1923CC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  bufferTitle: { color: '#FF6B35', fontSize: 10, fontWeight: '700' },
  bufferPoints: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bufferFlush: { color: '#718096', fontSize: 10, marginTop: 2 },

  infoScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  infoCard: {
    backgroundColor: '#1A2433',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  sectionLabel: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2D374855',
  },
  rowLabel: { color: '#718096', fontSize: 13 },
  rowValue: { color: '#E2E8F0', fontSize: 13, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  actionLabel: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
