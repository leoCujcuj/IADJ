import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
  Platform,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import {
  MessageSquare,
  Music,
  ListMusic,
  Mic,
  MicOff
} from 'lucide-react-native';

// Import subcomponents
import Header from './components/Header';
import StatusBanner from './components/StatusBanner';
import ChatTab from './components/ChatTab';
import PlayerTab from './components/PlayerTab';
import QueueTab from './components/QueueTab';
import SettingsModal from './components/SettingsModal';

const { BackgroundVoiceModule } = NativeModules;
const voiceEmitter = new NativeEventEmitter(BackgroundVoiceModule);

export default function App() {
  const [serverIp, setServerIp] = useState('10.0.2.2:3001'); // Default emulator IP
  const [fullServerUrl, setFullServerUrl] = useState('http://10.0.2.2:3001');
  const [activeTab, setActiveTab] = useState('player');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempIp, setTempIp] = useState('');
  
  // Status states
  const [isServiceActive, setIsServiceActive] = useState(false);
  const [serviceStatus, setServiceStatus] = useState('Inactivo');
  const [isConnected, setIsConnected] = useState(false);
  
  // Chat & Player states
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'dj', text: '¡Qué onda mucha! Soy tu DJ de Gemini Radio. ¿Qué te pongo hoy?' }
  ]);
  const [currentSong, setCurrentSong] = useState(null);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState([]);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);

  const chatScrollRef = useRef();

  // Load configured IP on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedIp = await AsyncStorage.getItem('@server_ip');
        if (savedIp) {
          setServerIp(savedIp);
          const url = savedIp.startsWith('http') ? savedIp : `http://${savedIp}`;
          setFullServerUrl(url);
          setTempIp(savedIp);
        } else {
          setTempIp('10.0.2.2:3001');
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadSettings();

    // Check if background service is already running
    if (BackgroundVoiceModule) {
      BackgroundVoiceModule.isServiceRunning()
        .then((running) => {
          setIsServiceActive(running);
          if (running) {
            setServiceStatus('Escuchando...');
          }
        })
        .catch(console.error);
    }
  }, []);

  // Listen to native voice service events
  useEffect(() => {
    if (!BackgroundVoiceModule) return;

    const subscription = voiceEmitter.addListener('onSpeechEvent', (event) => {
      console.log('Native Speech Event:', event);
      if (event.type === 'recognized_text') {
        setMessage(event.text);
        setChatHistory(prev => [...prev, { sender: 'user', text: event.text }]);
      } else if (event.type === 'dj_response') {
        setChatHistory(prev => [...prev, { sender: 'dj', text: event.comment }]);
        if (event.nextSongVideoId) {
          setCurrentSong({
            videoId: event.nextSongVideoId,
            title: event.nextSongTitle,
            artist: event.nextSongArtist
          });
          setIsLiked(false);
          setIsDisliked(false);
        }
      } else if (event.type === 'status') {
        setServiceStatus(event.status);
      } else if (event.type === 'error') {
        setServiceStatus(event.error);
        Alert.alert('Error de servicio', event.error);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Sync status with backend
  const syncStatus = async () => {
    try {
      const response = await fetch(`${fullServerUrl.replace('3001', '8000')}/status`);
      const data = await response.json();
      setIsConnected(data.status === 'logeado');
      setQueue(data.queue || []);
    } catch (e) {
      console.warn('Sync failed:', e.message);
    }
  };

  useEffect(() => {
    syncStatus();
    const interval = setInterval(syncStatus, 5000);
    return () => clearInterval(interval);
  }, [fullServerUrl]);

  // Request Android runtime permissions
  const requestServicePermissions = async () => {
    if (Platform.OS !== 'android') return true;

    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      ];
      
      if (Platform.Version >= 33) {
        permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);
      const recordGranted = granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      
      if (!recordGranted) {
        Alert.alert(
          'Permiso denegado',
          'Se necesita permiso de micrófono para escuchar tus comandos de voz.'
        );
        return false;
      }
      return true;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  // Start / Stop Background Listening Service
  const toggleBackgroundService = async () => {
    if (!BackgroundVoiceModule) {
      Alert.alert('Error', 'Módulo nativo no disponible.');
      return;
    }

    if (isServiceActive) {
      try {
        await BackgroundVoiceModule.stopService();
        setIsServiceActive(false);
        setServiceStatus('Inactivo');
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'No se pudo detener el servicio');
      }
    } else {
      const hasPermission = await requestServicePermissions();
      if (!hasPermission) return;

      try {
        await BackgroundVoiceModule.startService(fullServerUrl);
        setIsServiceActive(true);
        setServiceStatus('Escuchando...');
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'No se pudo iniciar el servicio');
      }
    }
  };

  // Save Settings (Backend IP)
  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('@server_ip', tempIp);
      setServerIp(tempIp);
      const url = tempIp.startsWith('http') ? tempIp : `http://${tempIp}`;
      setFullServerUrl(url);
      setIsSettingsOpen(false);
      Alert.alert('Guardado', 'Configuración de servidor actualizada.');
      
      if (isServiceActive && BackgroundVoiceModule) {
        await BackgroundVoiceModule.stopService();
        await BackgroundVoiceModule.startService(url);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo guardar la configuración.');
    }
  };

  // Send Message Manually
  const handleSendMessage = async () => {
    const textToSend = message.trim();
    if (!textToSend) return;

    setMessage('');
    setLoading(true);
    setChatHistory(prev => [...prev, { sender: 'user', text: textToSend }]);

    try {
      const response = await fetch(`${fullServerUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, currentSong, searchType: 'song' })
      });
      const data = await response.json();
      if (data.dj_comment) {
        setChatHistory(prev => [...prev, { sender: 'dj', text: data.dj_comment }]);
        if (BackgroundVoiceModule && data.audioUrl) {
          const fullAudio = data.audioUrl.startsWith('http') ? data.audioUrl : `${fullServerUrl}${data.audioUrl}`;
          BackgroundVoiceModule.playAudio(fullAudio);
        }
      }
      if (data.nextSong?.videoId) {
        setCurrentSong(data.nextSong);
        setIsLiked(false);
        setIsDisliked(false);
        syncStatus();
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const preloadedNextRef = useRef(null);

  const handlePreload = async () => {
    if (!currentSong) return;
    try {
      const res = await fetch(`${fullServerUrl}/api/preload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSong })
      });
      const data = await res.json();
      if (data.nextSong) {
        preloadedNextRef.current = data;
      }
    } catch (e) {
      console.warn('Mobile preload error:', e.message);
    }
  };

  // Player Actions
  const handleNext = async () => {
    if (preloadedNextRef.current && preloadedNextRef.current.nextSong) {
      const { nextSong, dj_comment, audioUrl } = preloadedNextRef.current;
      preloadedNextRef.current = null;
      
      fetch(`${fullServerUrl.replace('3001', '8000')}/queue/pop`, { method: 'POST' }).catch(() => {});
      
      if (dj_comment) {
        setChatHistory(prev => [...prev, { sender: 'dj', text: dj_comment }]);
        if (BackgroundVoiceModule && audioUrl) {
          const fullAudio = audioUrl.startsWith('http') ? audioUrl : `${fullServerUrl}${audioUrl}`;
          BackgroundVoiceModule.playAudio(fullAudio);
        }
      }
      setCurrentSong(nextSong);
      setIsLiked(false);
      setIsDisliked(false);
      syncStatus();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${fullServerUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Siguiente canción DJ.', currentSong, searchType: 'song' })
      });
      const data = await response.json();
      if (data.dj_comment) {
        setChatHistory(prev => [...prev, { sender: 'dj', text: data.dj_comment }]);
        if (BackgroundVoiceModule && data.audioUrl) {
          const fullAudio = data.audioUrl.startsWith('http') ? data.audioUrl : `${fullServerUrl}${data.audioUrl}`;
          BackgroundVoiceModule.playAudio(fullAudio);
        }
      }
      if (data.nextSong?.videoId) {
        setCurrentSong(data.nextSong);
        setIsLiked(false);
        setIsDisliked(false);
        syncStatus();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentSong || isLiked) return;
    setIsLiked(true);
    setIsDisliked(false);
    try {
      await fetch(`${fullServerUrl.replace('3001', '8000')}/like/${currentSong.videoId}?artist=${encodeURIComponent(currentSong.artist)}&current_title=${encodeURIComponent(currentSong.title)}`, {
        method: 'POST'
      });
      syncStatus();
    } catch (e) {
      setIsLiked(false);
      console.error(e);
    }
  };

  const handleDislike = async () => {
    if (!currentSong || isDisliked) return;
    setIsDisliked(true);
    setIsLiked(false);
    try {
      await fetch(`${fullServerUrl.replace('3001', '8000')}/dislike/${currentSong.videoId}?artist=${encodeURIComponent(currentSong.artist)}`, {
        method: 'POST'
      });
      handleNext();
    } catch (e) {
      setIsDisliked(false);
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      {/* Header */}
      <Header onSettingsPress={() => setIsSettingsOpen(true)} />

      {/* Status Banner */}
      <StatusBanner
        isConnected={isConnected}
        isServiceActive={isServiceActive}
        serviceStatus={serviceStatus}
      />

      {/* Main View Area */}
      <View style={styles.mainContainer}>
        {activeTab === 'chat' && (
          <ChatTab
            chatHistory={chatHistory}
            loading={loading}
            message={message}
            setMessage={setMessage}
            onSendMessage={handleSendMessage}
            chatScrollRef={chatScrollRef}
          />
        )}

        {activeTab === 'player' && (
          <PlayerTab
            currentSong={currentSong}
            isLiked={isLiked}
            isDisliked={isDisliked}
            loading={loading}
            onLike={handleLike}
            onDislike={handleDislike}
            onNext={handleNext}
            onVideoEnded={handleNext}
            onPreloadTrigger={handlePreload}
          />
        )}

        {activeTab === 'queue' && (
          <QueueTab
            queue={queue}
            onRefresh={syncStatus}
          />
        )}
      </View>

      {/* Floating Microphone Action Button */}
      <View style={styles.floatingButtonContainer}>
        <TouchableOpacity
          style={[styles.micFloatingButton, isServiceActive ? styles.micActive : styles.micInactive]}
          onPress={toggleBackgroundService}
        >
          {isServiceActive ? <Mic color="#FFFFFF" size={32} /> : <MicOff color="#FFFFFF" size={32} />}
        </TouchableOpacity>
        <Text style={styles.micHelperText}>
          {isServiceActive ? 'Oído de Fondo Activo' : 'Activar Escucha de Fondo'}
        </Text>
      </View>

      {/* Bottom Tabs */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chat' && styles.tabButtonActive]}
          onPress={() => setActiveTab('chat')}
        >
          <MessageSquare color={activeTab === 'chat' ? '#A78BFA' : '#9CA3AF'} size={24} />
          <Text style={[styles.tabButtonText, activeTab === 'chat' && styles.tabButtonTextActive]}>Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'player' && styles.tabButtonActive]}
          onPress={() => setActiveTab('player')}
        >
          <Music color={activeTab === 'player' ? '#A78BFA' : '#9CA3AF'} size={24} />
          <Text style={[styles.tabButtonText, activeTab === 'player' && styles.tabButtonTextActive]}>Reproductor</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'queue' && styles.tabButtonActive]}
          onPress={() => setActiveTab('queue')}
        >
          <ListMusic color={activeTab === 'queue' ? '#A78BFA' : '#9CA3AF'} size={24} />
          <Text style={[styles.tabButtonText, activeTab === 'queue' && styles.tabButtonTextActive]}>Cola</Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal */}
      <SettingsModal
        visible={isSettingsOpen}
        tempIp={tempIp}
        setTempIp={setTempIp}
        onClose={() => setIsSettingsOpen(false)}
        onSave={saveSettings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  mainContainer: {
    flex: 1,
  },
  // Floating Microphone Toggler
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  micFloatingButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  micActive: {
    backgroundColor: '#7C3AED',
  },
  micInactive: {
    backgroundColor: '#EF4444',
  },
  micHelperText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
    backgroundColor: 'rgba(10, 10, 10, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  // Bottom Navigation Tabs
  bottomTabs: {
    height: 64,
    flexDirection: 'row',
    backgroundColor: '#0F0F0F',
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#121212',
  },
  tabButtonText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  tabButtonTextActive: {
    color: '#A78BFA',
    fontWeight: 'bold',
  },
});
