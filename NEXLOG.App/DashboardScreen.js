/**
 * NEXLOG Delivery Partner App — DashboardScreen.js
 * Fully functional: shows assigned shipments, sequential status, KYC banner.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, Switch, SafeAreaView, StatusBar,
  ScrollView, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BASE_URL = 'http://192.168.1.100:5000/api'; // Update to your server IP

// ── Status machine ──────────────────────────────────────────────────────────
const STATUS_STEPS = [
  { key: 'scheduled',        label: 'Scheduled',         emoji: '📋' },
  { key: 'accepted',         label: 'Accept',            emoji: '✅', nextLabel: 'Accept Order' },
  { key: 'picked_up',        label: 'Picked Up',         emoji: '📦', nextLabel: 'Mark Picked Up' },
  { key: 'in_transit',       label: 'In Transit',        emoji: '🚴', nextLabel: 'Mark In Transit' },
  { key: 'reached_drop',     label: 'Reached Drop',      emoji: '📍', nextLabel: 'Mark Reached Drop' },
  { key: 'out_for_delivery', label: 'Out for Delivery',  emoji: '🛵', nextLabel: 'Mark Out for Delivery' },
  { key: 'delivered',        label: 'Delivered',         emoji: '🎉' },
  { key: 'failed',           label: 'Failed',            emoji: '❌' },
];

const FAILURE_REASONS = [
  'Customer Not Available', 'Wrong Address', 'Unavailable to Pickup',
  'Requested Return', 'Order not required anymore', 'Requested Replacement',
  'Met with Accident', 'Order Lost/Damaged', 'Store Closed',
];

function getNextStep(currentKey) {
  const idx = STATUS_STEPS.findIndex(s => s.key === currentKey);
  if (idx < 0 || idx >= STATUS_STEPS.length - 2) return null;
  return STATUS_STEPS[idx + 1];
}

function getStepIndex(key) {
  return STATUS_STEPS.findIndex(s => s.key === key);
}

async function apiRequest(method, path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('active');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('authToken');
      const u = await AsyncStorage.getItem('userData');
      setToken(t);
      if (u) setUser(JSON.parse(u));
      if (t) fetchShipments(t);
    })();
  }, []);

  const fetchShipments = useCallback(async (tok) => {
    const t = tok || token;
    if (!t) return;
    setLoading(true);
    try {
      const data = await apiRequest('GET', '/shipments?limit=50', null, t);
      setShipments(data.shipments || []);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally { setLoading(false); }
  }, [token]);

  const signOut = async () => {
    await AsyncStorage.multiRemove(['authToken', 'userData']);
    navigation.replace('Login');
  };

  const isKycPending = user && !user.isOnboarded;
  const active = shipments.filter(s => !['delivered','failed','returned'].includes(s.status));
  const done = shipments.filter(s => ['delivered','failed','returned'].includes(s.status));
  const shown = tab === 'active' ? active : done;

  if (selected) {
    return (
      <ShipmentDetailScreen
        shipment={selected}
        token={token}
        onBack={() => setSelected(null)}
        onRefresh={() => { setSelected(null); fetchShipments(); }}
      />
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1526" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.logo}>NEXLOG</Text>
          <Text style={s.greet}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={s.signOutBtn}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* KYC Banner */}
      {isKycPending && (
        <TouchableOpacity
          style={s.kycBanner}
          onPress={() => navigation.navigate('KYC')}
        >
          <Text style={s.kycIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.kycTitle}>KYC Verification Pending</Text>
            <Text style={s.kycSub}>Submit Aadhaar, DL & Vehicle docs to start deliveries</Text>
          </View>
          <Text style={s.kycArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Stats */}
      <View style={s.statsRow}>
        {[
          { label: 'Assigned', value: shipments.length, color: '#00d4ff' },
          { label: 'Active', value: active.length, color: '#f59e0b' },
          { label: 'Done', value: done.length, color: '#10b981' },
        ].map(st => (
          <View key={st.label} style={s.statCard}>
            <Text style={[s.statNum, { color: st.color }]}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {['active', 'done'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'active' ? `Active (${active.length})` : `Done (${done.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={shown}
        keyExtractor={item => item._id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchShipments()} tintColor="#00d4ff" />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🚚</Text>
            <Text style={s.emptyText}>{tab === 'active' ? 'No active deliveries' : 'No completed deliveries'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const nextStep = getNextStep(item.status);
          const isActive = !['delivered','failed','returned'].includes(item.status);
          return (
            <View style={[s.card, isActive && s.cardActive]}>
              {isActive && <View style={s.cardAccent} />}
              <View style={s.cardHead}>
                <Text style={s.trackNum}>{item.trackingNumber}</Text>
                <View style={[s.badge, { backgroundColor: STATUS_COLORS[item.status] || '#374151' }]}>
                  <Text style={s.badgeText}>{item.status?.replace(/_/g,' ')}</Text>
                </View>
              </View>
              <View style={s.routeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.routeLabel}>FROM</Text>
                  <Text style={s.routeCity}>{item.origin?.city || '—'}</Text>
                </View>
                <Text style={s.routeArrow}>→</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={s.routeLabel}>TO</Text>
                  <Text style={s.routeCity}>{item.destination?.city || '—'}</Text>
                </View>
              </View>
              <Text style={s.orderCount}>{item.orders?.length || 0} order(s) assigned</Text>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.detailBtn} onPress={() => setSelected(item)}>
                  <Text style={s.detailBtnText}>View Details</Text>
                </TouchableOpacity>
                {isActive && nextStep && !isKycPending && (
                  <TouchableOpacity style={s.nextBtn} onPress={() => setSelected(item)}>
                    <Text style={s.nextBtnText}>{nextStep.emoji} {nextStep.nextLabel || nextStep.label}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

// ── Shipment Detail Screen ───────────────────────────────────────────────────
function ShipmentDetailScreen({ shipment: init, token, onBack, onRefresh }) {
  const [s, setS] = useState(init);
  const [updating, setUpdating] = useState(false);
  const [showFail, setShowFail] = useState(false);
  const [failReason, setFailReason] = useState('');

  const nextStep = getNextStep(s.status);
  const stepIdx = getStepIndex(s.status);
  const isTerminal = !nextStep || ['delivered','failed'].includes(s.status);

  const advanceStatus = async (statusKey, note = '') => {
    setUpdating(true);
    try {
      await apiRequest('PATCH', `/shipments/${s._id}`, {
        status: statusKey,
        trackingEvent: { status: statusKey, description: note || `Marked as ${statusKey}` },
      }, token);
      onRefresh();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally { setUpdating(false); }
  };

  const orders = (s.orders || []).filter(o => o && typeof o === 'object');

  return (
    <SafeAreaView style={d.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1526" />

      <View style={d.header}>
        <TouchableOpacity onPress={onBack} style={d.backBtn}>
          <Text style={d.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={d.trackNum}>{s.trackingNumber}</Text>
        <View style={[d.badge, { backgroundColor: STATUS_COLORS[s.status] || '#374151' }]}>
          <Text style={d.badgeText}>{s.status?.replace(/_/g,' ')}</Text>
        </View>
      </View>

      <ScrollView style={d.scroll} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Progress dots */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginVertical: 16 }}>
          {STATUS_STEPS.filter(st => st.key !== 'failed').map((step, i) => {
            const done = i <= stepIdx && s.status !== 'failed';
            return (
              <View key={step.key} style={{ alignItems: 'center', marginRight: 16 }}>
                <View style={[d.dot, done ? d.dotDone : d.dotPending]}>
                  <Text style={{ fontSize: 12 }}>{done ? '✓' : step.emoji}</Text>
                </View>
                <Text style={[d.dotLabel, done && { color: '#00d4ff' }]} numberOfLines={2}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Route card */}
        <View style={d.routeCard}>
          <View style={{ flex: 1 }}>
            <Text style={d.routeLabel}>PICKUP FROM</Text>
            <Text style={d.routeCity}>{s.origin?.city || '—'}</Text>
            <Text style={d.routeAddr}>{s.origin?.address}</Text>
          </View>
          <Text style={d.routeArrow}>⇒</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={d.routeLabel}>DELIVER TO</Text>
            <Text style={d.routeCity}>{s.destination?.city || '—'}</Text>
            <Text style={d.routeAddr}>{s.destination?.address}</Text>
          </View>
        </View>

        {/* Orders */}
        {orders.length > 0 && (
          <View style={d.section}>
            <Text style={d.sectionTitle}>ORDERS ({orders.length})</Text>
            {orders.map((o, i) => (
              <View key={i} style={d.orderCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={d.orderNum}>{o.orderNumber}</Text>
                  <View style={[d.badge, { backgroundColor: STATUS_COLORS[o.status] || '#374151' }]}>
                    <Text style={d.badgeText}>{o.status?.replace(/_/g,' ')}</Text>
                  </View>
                </View>
                <Text style={d.orderAddr}>📦 {o.pickupAddress?.city} → {o.deliveryAddress?.city}</Text>
                {o.items?.slice(0,3).map((item, j) => (
                  <Text key={j} style={d.orderItem}>• {item.name} ×{item.quantity}</Text>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Next Action */}
        {!isTerminal && (
          <View style={d.actionBox}>
            <Text style={d.actionTitle}>NEXT ACTION</Text>
            {!showFail ? (
              <View style={d.actionBtns}>
                <TouchableOpacity
                  style={[d.nextBtn, updating && { opacity: 0.5 }]}
                  onPress={() => advanceStatus(nextStep.key)}
                  disabled={updating}
                >
                  <Text style={d.nextBtnText}>
                    {updating ? 'Updating…' : `${nextStep.emoji} Mark as ${nextStep.label}`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={d.failBtn} onPress={() => setShowFail(true)} disabled={updating}>
                  <Text style={d.failBtnText}>✗ Report Failure</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={d.failTitle}>Select Reason:</Text>
                {FAILURE_REASONS.map(r => (
                  <TouchableOpacity key={r} style={[d.reasonBtn, failReason === r && d.reasonBtnSelected]} onPress={() => setFailReason(r)}>
                    <Text style={[d.reasonText, failReason === r && { color: '#ef4444' }]}>{failReason === r ? '● ' : '○ '}{r}</Text>
                  </TouchableOpacity>
                ))}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity style={[d.failBtn, { flex: 1 }]} onPress={() => setShowFail(false)}>
                    <Text style={d.failBtnText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[d.confirmFailBtn, { flex: 2, opacity: failReason ? 1 : 0.4 }]}
                    disabled={!failReason || updating}
                    onPress={() => advanceStatus('failed', `Failed: ${failReason}`)}
                  >
                    <Text style={d.nextBtnText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {isTerminal && (
          <View style={[d.actionBox, { alignItems: 'center' }]}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>{s.status === 'delivered' ? '🎉' : '❌'}</Text>
            <Text style={{ color: s.status === 'delivered' ? '#10b981' : '#ef4444', fontWeight: '700', fontSize: 16 }}>
              {s.status === 'delivered' ? 'Delivered Successfully!' : 'Delivery Failed'}
            </Text>
          </View>
        )}

        {/* History */}
        {s.trackingEvents?.length > 0 && (
          <View style={d.section}>
            <Text style={d.sectionTitle}>HISTORY</Text>
            {[...s.trackingEvents].reverse().map((ev, i) => (
              <View key={i} style={d.historyItem}>
                <View style={[d.historyDot, i === 0 && d.historyDotActive]} />
                <View style={d.historyContent}>
                  <View style={[d.badge, { backgroundColor: STATUS_COLORS[ev.status] || '#374151', marginBottom: 4 }]}>
                    <Text style={d.badgeText}>{ev.status?.replace(/_/g,' ')}</Text>
                  </View>
                  {ev.description && <Text style={d.historyDesc}>{ev.description}</Text>}
                  <Text style={d.historyTime}>{new Date(ev.timestamp).toLocaleString()}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Colors ───────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  scheduled: '#374151', accepted: '#1d4ed8', picked_up: '#7c3aed',
  in_transit: '#d97706', reached_drop: '#0891b2', out_for_delivery: '#f59e0b',
  delivered: '#059669', failed: '#dc2626', returned: '#6b7280',
};

// ── Dashboard Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1526' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#111D2E', borderBottomWidth: 1, borderBottomColor: '#1E2E45' },
  logo: { color: '#00d4ff', fontSize: 16, fontWeight: '900', letterSpacing: 4 },
  greet: { color: '#94a3b8', fontSize: 13, marginTop: 2 },
  signOutBtn: { backgroundColor: '#1E2E45', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  signOutText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  kycBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.12)', borderBottomWidth: 1, borderBottomColor: 'rgba(239,68,68,0.3)', padding: 14, gap: 10 },
  kycIcon: { fontSize: 22 },
  kycTitle: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  kycSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  kycArrow: { color: '#ef4444', fontSize: 18, fontWeight: '700' },
  statsRow: { flexDirection: 'row', padding: 12, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#111D2E', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#1E2E45' },
  statNum: { fontSize: 26, fontWeight: '900' },
  statLabel: { color: '#94a3b8', fontSize: 11, marginTop: 3 },
  tabRow: { flexDirection: 'row', backgroundColor: '#111D2E', borderBottomWidth: 1, borderBottomColor: '#1E2E45' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#00d4ff' },
  tabText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: '#00d4ff' },
  list: { padding: 14, paddingBottom: 30 },
  card: { backgroundColor: '#111D2E', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E2E45', position: 'relative', overflow: 'hidden' },
  cardActive: { borderColor: 'rgba(0,212,255,0.25)' },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: '#00d4ff', borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  trackNum: { color: '#00d4ff', fontFamily: 'monospace', fontSize: 14, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  routeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D1526', borderRadius: 8, padding: 10, marginBottom: 10 },
  routeArrow: { color: '#00d4ff', fontSize: 18, paddingHorizontal: 8 },
  routeLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  routeCity: { color: '#fff', fontWeight: '700', fontSize: 14, marginTop: 2 },
  orderCount: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  cardActions: { flexDirection: 'row', gap: 10 },
  detailBtn: { flex: 1, backgroundColor: '#1E2E45', borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2D3E55' },
  detailBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  nextBtn: { flex: 2, backgroundColor: '#00d4ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  nextBtnText: { color: '#0D1526', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#4A5568', fontSize: 15 },
});

// ── Detail Styles ────────────────────────────────────────────────────────────
const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D1526' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#111D2E', borderBottomWidth: 1, borderBottomColor: '#1E2E45', flexWrap: 'wrap' },
  backBtn: { backgroundColor: '#1E2E45', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  backText: { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
  trackNum: { color: '#00d4ff', fontWeight: '900', fontSize: 15, fontFamily: 'monospace', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  scroll: { flex: 1 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: '#00d4ff' },
  dotPending: { backgroundColor: '#1E2E45', borderWidth: 2, borderColor: '#2D3E55' },
  dotLabel: { color: '#64748b', fontSize: 9, marginTop: 4, textAlign: 'center', width: 60 },
  routeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111D2E', marginHorizontal: 16, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)', marginBottom: 14 },
  routeLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  routeCity: { color: '#fff', fontWeight: '700', fontSize: 16, marginTop: 2 },
  routeAddr: { color: '#64748b', fontSize: 12, marginTop: 2 },
  routeArrow: { color: '#00d4ff', fontSize: 22, paddingHorizontal: 12 },
  section: { marginHorizontal: 16, marginBottom: 14 },
  sectionTitle: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  orderCard: { backgroundColor: '#111D2E', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1E2E45' },
  orderNum: { color: '#00d4ff', fontWeight: '800', fontFamily: 'monospace', fontSize: 14 },
  orderAddr: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  orderItem: { color: '#64748b', fontSize: 12, marginTop: 2 },
  actionBox: { backgroundColor: '#111D2E', marginHorizontal: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1E2E45', marginBottom: 14 },
  actionTitle: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 },
  actionBtns: { gap: 10 },
  nextBtn: { backgroundColor: '#00d4ff', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  nextBtnText: { color: '#0D1526', fontWeight: '900', fontSize: 15 },
  failBtn: { backgroundColor: '#1E2E45', borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  failBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  failTitle: { color: '#ef4444', fontWeight: '700', marginBottom: 10, fontSize: 14 },
  reasonBtn: { backgroundColor: '#1A2433', borderRadius: 8, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#1E2E45' },
  reasonBtnSelected: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.08)' },
  reasonText: { color: '#94a3b8', fontSize: 13 },
  confirmFailBtn: { backgroundColor: '#ef4444', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  historyItem: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1E2E45', marginTop: 4, flexShrink: 0 },
  historyDotActive: { backgroundColor: '#00d4ff' },
  historyContent: { flex: 1, backgroundColor: '#111D2E', borderRadius: 8, padding: 10 },
  historyDesc: { color: '#94a3b8', fontSize: 12, marginBottom: 2 },
  historyTime: { color: '#64748b', fontSize: 11 },
});
