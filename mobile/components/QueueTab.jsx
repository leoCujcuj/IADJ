import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { RefreshCw, ListMusic } from 'lucide-react-native';

export default function QueueTab({ queue, onRefresh }) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.queueHeader}>
        <Text style={styles.queueTitle}>Cola de Reproducción</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RefreshCw color="#A78BFA" size={18} />
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.queueList} contentContainerStyle={styles.queueScrollContent}>
        {queue.length === 0 ? (
          <View style={styles.emptyQueue}>
            <ListMusic color="#4B5563" size={48} />
            <Text style={styles.emptyQueueText}>La cola está vacía</Text>
            <Text style={styles.emptySubtext}>Los temas recomendados por el DJ aparecerán aquí.</Text>
          </View>
        ) : (
          queue.map((item, index) => (
            <View key={index} style={styles.queueItem}>
              <View style={styles.queueIndexBox}>
                <Text style={styles.queueIndex}>{index + 1}</Text>
              </View>
              <View style={styles.queueItemDetails}>
                <Text style={styles.queueItemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.queueItemArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  refreshBtn: {
    padding: 8,
  },
  queueList: {
    flex: 1,
  },
  queueScrollContent: {
    padding: 20,
  },
  emptyQueue: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyQueueText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptySubtext: {
    color: '#4B5563',
    fontSize: 12,
    textAlign: 'center',
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F1F1F',
  },
  queueIndexBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1F1F1F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  queueIndex: {
    color: '#A78BFA',
    fontWeight: 'bold',
    fontSize: 14,
  },
  queueItemDetails: {
    flex: 1,
  },
  queueItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  queueItemArtist: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
});
