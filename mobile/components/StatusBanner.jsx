import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StatusBanner({ isConnected, isServiceActive, serviceStatus }) {
  return (
    <View style={styles.statusBanner}>
      <View style={[styles.statusPill, isConnected ? styles.connectedPill : styles.disconnectedPill]}>
        <View style={[styles.statusDot, { backgroundColor: isConnected ? '#10B981' : '#EF4444' }]} />
        <Text style={styles.statusText}>{isConnected ? 'YT Music Activo' : 'Invitado'}</Text>
      </View>
      <View style={[styles.statusPill, isServiceActive ? styles.serviceActivePill : styles.serviceInactivePill]}>
        <View style={[styles.statusDot, { backgroundColor: isServiceActive ? '#A78BFA' : '#6B7280' }]} />
        <Text style={styles.statusText}>{`Oído: ${serviceStatus}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBanner: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#0F0F0F',
    justifyContent: 'flex-start',
    gap: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E1E1E'
  },
  connectedPill: {
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
  },
  disconnectedPill: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
  },
  serviceActivePill: {
    borderColor: 'rgba(167, 139, 250, 0.3)',
    borderWidth: 1,
  },
  serviceInactivePill: {
    borderColor: 'rgba(107, 114, 128, 0.2)',
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500'
  },
});
