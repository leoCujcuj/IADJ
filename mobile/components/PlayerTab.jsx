import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Play, ThumbsUp, ThumbsDown } from 'lucide-react-native';
import YouTubePlayer from './YouTubePlayer';

export default function PlayerTab({
  currentSong,
  isLiked,
  isDisliked,
  loading,
  onLike,
  onDislike,
  onNext,
  onVideoEnded,
  onPreloadTrigger
}) {
  return (
    <View style={styles.tabContent}>
      <View style={styles.playerWrapper}>
        <YouTubePlayer
          videoId={currentSong?.videoId}
          onVideoEnded={onVideoEnded}
          onPreloadTrigger={onPreloadTrigger}
        />

        <View style={styles.songCard}>
          {currentSong ? (
            <View style={styles.songInfo}>
              <Text style={styles.songTitle} numberOfLines={2}>{currentSong.title}</Text>
              <Text style={styles.songArtist} numberOfLines={1}>{currentSong.artist}</Text>
            </View>
          ) : (
            <View style={styles.songInfo}>
              <Text style={styles.songTitle}>Esperando señal...</Text>
              <Text style={styles.songArtist}>Pídele música al DJ usando tu voz</Text>
            </View>
          )}

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={[styles.controlBtn, isLiked && styles.controlBtnActive]}
              onPress={onLike}
              disabled={!currentSong}
            >
              <ThumbsUp color={isLiked ? '#10B981' : '#9CA3AF'} size={24} />
              <Text style={[styles.controlBtnText, isLiked && styles.controlBtnTextActive]}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlBtn, isDisliked && styles.controlBtnActive]}
              onPress={onDislike}
              disabled={!currentSong}
            >
              <ThumbsDown color={isDisliked ? '#EF4444' : '#9CA3AF'} size={24} />
              <Text style={[styles.controlBtnText, isDisliked && styles.controlBtnTextActive]}>Dislike</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlBtnNext} onPress={onNext} disabled={loading}>
              <Play color="#FFFFFF" size={24} />
              <Text style={styles.controlBtnNextText}>Siguiente</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  playerWrapper: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
  },
  songCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F1F1F',
  },
  songInfo: {
    marginBottom: 24,
    alignItems: 'center',
  },
  songTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  songArtist: {
    color: '#A78BFA',
    fontSize: 16,
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F1F1F',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  controlBtnActive: {
    backgroundColor: '#262626',
    borderColor: '#374151',
    borderWidth: 1,
  },
  controlBtnText: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  controlBtnTextActive: {
    color: '#FFFFFF',
  },
  controlBtnNext: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
  },
  controlBtnNextText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
