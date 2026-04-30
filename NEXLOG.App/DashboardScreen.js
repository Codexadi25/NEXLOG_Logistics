/**
 * DashboardScreen.js
 * Home screen: shows today's deliveries, partner status, and tracking toggle.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { API } from '../services/ApiService';
import { LocationService } from '../services/LocationService';
import { SocketService } from '../services/SocketService';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import LocationStatusBar from '../components/LocationStatusBar';

const STATUS_COLORS = {
  pending: '#ECC94B',
  in_transit: '#48BB78',
  delivered: '#4299E1',
  failed: '#FC8181',
};

export default function DashboardScreen({ navigation }) {
  const { deliveryPartner, signOut } = useAuth();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [locationPoint, setLocationPoint] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchDeliveries();
    }, [])
  );

  useEffect(() => {
    // Subscribe to live location for status bar
    const unsub = LocationService.subscribe((pt) => setLocationPoint(pt));
    return unsub;
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/deliveries?partnerId=${deliveryPartner._id}&date=today`);
      setDeliveries(res.deliveries || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async (value) => {
    setIsOnline(value);
    if (value) {
      // Go online: start background tracking without a specific delivery
      await LocationService.startTracking('general', deliveryPartner._id);
      SocketService.emit('partner:online', { partnerId: deliveryPartner._id });
    } else {
      await LocationService.stopTracking();
      SocketService.emit('partner:offline', { partnerId: deliveryPartner._id });
    }
  };

  const startDelivery = async (delivery) => {
    // Start delivery-specific tracking session
    await LocationService.startTracking(delivery._id, deliveryPartner._id);
    SocketService.joinDeliveryRoom(delivery._id);
    navigation.navigate('ActiveDelivery', { delivery });
  };

  const renderDelivery = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (item.status === 'pending' || item.status === 'in_transit') {
          startDelivery(item);
        }
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}>#{item.orderId}</Text>
        <StatusBadge status={item.status} />
      </View>

      <Text style={styles.customerName}>{item.customerName}</Text>
      <Text style={styles.address} numberOfLines={2}>{item.deliveryAddress}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.distance}>📍 {item.distanceKm?.toFixed(1)} km</Text>
        <Text style={styles.timeSlot}>🕐 {item.timeSlot}</Text>
        {(item.status === 'pending' || item.status === 'in_transit') && (
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => startDelivery(item)}
          >
            <Text style={styles.startBtnText}>
              {item.status === 'in_transit' ? 'Resume →' : 'Start →'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const pendingCount = deliveries.filter((d) => d.status === 'pending').length;
  const doneCount = deliveries.filter((d) => d.status === 'delivered').length;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Good {getTimeGreeting()},</Text>
          <Text style={styles.partnerName}>{deliveryPartner?.name}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Location status */}
      <LocationStatusBar locationPoint={locationPoint} isTracking={isOnline} />

      {/* Online toggle */}
      <View style={styles.onlineRow}>
        <View>
          <Text style={styles.onlineLabel}>
            {isOnline ? '🟢 You are Online' : '⭕ You are Offline'}
          </Text>
          <Text style={styles.onlineSub}>
            {isOnline ? 'Location is being tracked' : 'Turn on to start receiving deliveries'}
          </Text>
        </View>
        <Switch
          value={isOnline}
          onValueChange={toggleOnline}
          trackColor={{ false: '#2D3748', true: '#48BB7888' }}
          thumbColor={isOnline ? '#48BB78' : '#718096'}
        />
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNum}>{deliveries.length}</Text>
          <Text style={styles.summaryLabel}>Assigned</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNum, { color: '#ECC94B' }]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNum, { color: '#48BB78' }]}>{doneCount}</Text>
          <Text style={styles.summaryLabel}>Done</Text>
        </View>
      </View>

      {/* Deliveries list */}
      <Text style={styles.sectionTitle}>Today's Deliveries</Text>
      <FlatList
        data={deliveries}
        keyExtractor={(item) => item._id}
        renderItem={renderDelivery}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchDeliveries}
            tintColor="#FF6B35"
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No deliveries assigned today.</Text>
        }
      />
    </View>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1923' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: '#1A2433',
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  greeting: { color: '#718096', fontSize: 13 },
  partnerName: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 2 },
  signOutBtn: {
    backgroundColor: '#2D3748',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  signOutText: { color: '#A0AEC0', fontSize: 13, fontWeight: '600' },

  onlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1A2433',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  onlineLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  onlineSub: { color: '#718096', fontSize: 12, marginTop: 2 },

  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#1A2433',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  summaryNum: { color: '#FF6B35', fontSize: 26, fontWeight: '800' },
  summaryLabel: { color: '#718096', fontSize: 12, marginTop: 2 },

  sectionTitle: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 16, paddingBottom: 30 },
  card: {
    backgroundColor: '#1A2433',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: { color: '#FF6B35', fontWeight: '700', fontSize: 14 },
  customerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  address: { color: '#718096', fontSize: 13, lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
    flexWrap: 'wrap',
  },
  distance: { color: '#A0AEC0', fontSize: 13 },
  timeSlot: { color: '#A0AEC0', fontSize: 13 },
  startBtn: {
    marginLeft: 'auto',
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  startBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyText: { color: '#4A5568', textAlign: 'center', marginTop: 50, fontSize: 15 },
});
