/**
 * LocationStatusBar.js
 * Shows GPS status: provider, accuracy, last update time.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LocationStatusBar({ locationPoint, isTracking }) {
  const provider = locationPoint?.provider ?? '—';
  const accuracy = locationPoint?.accuracy
    ? `±${locationPoint.accuracy.toFixed(0)}m`
    : '—';
  const timestamp = locationPoint?.timestamp
    ? new Date(locationPoint.timestamp).toLocaleTimeString()
    : '—';

  const dotColor = !isTracking
    ? '#718096'
    : provider === 'gps'
    ? '#48BB78'
    : '#ECC94B'; // yellow for network fallback

  return (
    <View style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.text}>
        {isTracking
          ? `${provider.toUpperCase()} · ${accuracy} · ${timestamp}`
          : 'Location tracking OFF'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#162032',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  text: { color: '#718096', fontSize: 12, fontFamily: 'monospace' },
});
