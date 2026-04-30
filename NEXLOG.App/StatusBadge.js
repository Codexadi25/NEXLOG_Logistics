import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const CONFIG = {
  pending:    { label: 'Pending',    bg: '#2D3748', color: '#ECC94B' },
  in_transit: { label: 'In Transit', bg: '#1C4532', color: '#48BB78' },
  arrived:    { label: 'Arrived',    bg: '#1A365D', color: '#63B3ED' },
  delivered:  { label: 'Delivered',  bg: '#1A365D', color: '#4299E1' },
  failed:     { label: 'Failed',     bg: '#2D1515', color: '#FC8181' },
};

export default function StatusBadge({ status }) {
  const cfg = CONFIG[status] ?? CONFIG.pending;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
