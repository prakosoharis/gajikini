import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/calc';

export const COLORS = {
  indigo: '#4f46e5',
  violet: '#7c3aed',
  ink: '#0f172a',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  bg: '#f8fafc',
  white: '#ffffff',
  emerald: '#059669',
  rose: '#e11d48',
};

export function Badge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || { bg: '#f1f5f9', fg: '#475569' };
  return (
    <View style={[s.badge, { backgroundColor: c.bg }]}>
      <Text style={[s.badgeText, { color: c.fg }]}>{STATUS_LABELS[status] || status}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = COLORS.indigo }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  track: { height: 8, borderRadius: 999, backgroundColor: COLORS.slate100, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 999 },
});
