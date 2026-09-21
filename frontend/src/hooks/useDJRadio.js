import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Music, Disc, ListMusic, User } from 'lucide-react';

import useDialog from './useDialog';
import useAudioSettings from './useAudioSettings';
import useTasteProfile from './useTasteProfile';
import useVoiceRecognition from './useVoiceRecognition';
import useSongTrivia from './useSongTrivia';
import useFavorites from './useFavorites';
import useRadioSessions from './useRadioSessions';
import useMediaSession from './useMediaSession';

/**
 * Hook orquestador principal de Gemini Radio.
 * Ensambla los sub-hooks especializados manteniendo una API limpia y desacoplada.
 */
export default function useDJRadio() {
  // 1. Mensajeria y Chat
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'dj', text: '¡Qué onda mucha! Soy tu DJ de Gemini Radio. ¿Qué te pongo hoy?' }
  ]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // 2. Estado de reproduccion y cola
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [queueSource, setQueueSource] = useState(null);
  const [manualSearch, setManualSearch] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchType, setSearchType] = useState('song');
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);

  // Modos de busqueda para el input del chat
  const modes = [
    { id: 'song', icon: Music, title: 'Modo Canción', placeholder: 'canción' },
    { id: 'album', icon: Disc, title: 'Modo Álbum', placeholder: 'álbum' },
    { id: 'playlist', icon: ListMusic, title: 'Modo Playlist', placeholder: 'playlist' },
    { id: 'artist', icon: User, title: 'Modo Artista', placeholder: 'artista' }
  ];
  const sortedModes = [...modes].sort((a, b) => a.id === searchType ? -1 : b.id === searchType ? 1 : 0);
  const activeMode = modes.find(m => m.id === searchType);

  // 3. Sub-hooks modulares
  const { modalDialog, setModalDialog, showConfirm, showAlert } = useDialog();

  const {
    frequency,
    setFrequency,
    personality,
    setPersonality,
    crossfade,
    setCrossfade,
    autoPauseOnTabChange,
    setAutoPauseOnTabChange,
    duckingVolume,
    setDuckingVolume,
    isSettingsOpen,
    setIsSettingsOpen,
    selectedVoice,
    setSelectedVoice,
    playingPreviewVoiceId,
    handlePlayVoicePreview,
    frequencyRef,
    personalityRef,
    crossfadeRef,
    autoPauseOnTabChangeRef,
    duckingVolumeRef,
    selectedVoiceRef,
    wasPlayingBeforeAutoPauseRef,
    wasDJSpeakingBeforeAutoPauseRef,
    wasSpeechSpeakingBeforeAutoPauseRef,
    tabIdRef,
    broadcastChannelRef
  } = useAudioSettings();

  const {
    tasteProfile,
    isTasteModalOpen,
    setIsTasteModalOpen,
    loadingTasteProfile,
    fetchTasteProfile,
    saveTasteProfile,
    tasteProfileRef
  } = useTasteProfile();

  const { isListening, toggleListening } = useVoiceRecognition({
    message,
    setMessage,
    showAlert
  });

  const {
    isTriviaOpen,
    setIsTriviaOpen,
    currentTrivia,
    loadingTrivia,
    handleOpenTrivia,
    handleAnotherTrivia,
    handleAskDJMore,
    handleShareTriviaToChat
  } = useSongTrivia({
    currentSong,
    setMessage,
    setChatHistory
  });

  // Refs de reproduccion y control interno
  const playerRef = useRef(null);
  const currentSongRef = useRef(null);
  const preloadedDataRef = useRef(null);
  const preloadTriggeredRef = useRef(null);
  const isPreloadingRef = useRef(false);
  const preloadAbortControllerRef = useRef(null);
  const preloadedAudioRef = useRef(null);
  const removedVideoIdsRef = useRef(new Set());
  const rewoundVideoIdsRef = useRef(new Set());
  const executeTransitionRef = useRef(null);
  const blockedVideoIdsRef = useRef(new Set());
  const fallbackAttemptsRef = useRef(new Map());
  const skipToNextImmediatelyRef = useRef(null);

  const chatEndRef = useRef(null);
  const audioPlayerRef = useRef(new Audio());
  const handleNextRef = useRef(null);
  const handlePreviousRef = useRef(null);

  const queueRef = useRef([]);
  const historyRef = useRef([]);
  const playedHistoryRef = useRef([]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Limpieza de precargas
  const clearPreload = useCallback(() => {
    preloadedDataRef.current = null;
    preloadTriggeredRef.current = null;
    if (preloadedAudioRef.current) {
      try {
        preloadedAudioRef.current.pause();
        preloadedAudioRef.current.src = '';
      } catch (e) {}
      preloadedAudioRef.current = null;
    }
  }, []);

  // 4. Sub-hook de Sesiones
  const {
    sessionId,
    sessionName,
    sessionStatus,
    isSessionsOpen,
    setIsSessionsOpen,
    sessionsList,
    fetchSessions,
    handleNewSession,
    handleSwitchSession,
    handleCreateSession,
    handleRenameSession,
    handleDeleteSession
  } = useRadioSessions({
    showConfirm,
    currentSong,
    setCurrentSong,
    currentSongRef,
    queue,
    setQueue,
    history,
    setHistory,
    playedHistoryRef,
    chatHistory,
    setChatHistory,
    settings: useMemo(() => ({ frequency, personality, crossfade, autoPauseOnTabChange, duckingVolume }), [frequency, personality, crossfade, autoPauseOnTabChange, duckingVolume]),
    settingsSetters: useMemo(() => ({ setFrequency, setPersonality, setCrossfade, setAutoPauseOnTabChange, setDuckingVolume }), [setFrequency, setPersonality, setCrossfade, setAutoPauseOnTabChange, setDuckingVolume])
  });

  // 5. Sub-hook de Favoritos y Repeticiones
  const {
    repeatCount,
    setRepeatCount,
    globalRepeatCount,
    setGlobalRepeatCount,
    isFavoritesOpen,
    setIsFavoritesOpen,
    favoritesList,
    sessionFavoritesList,
    globalFavoritesList,
    loadingFavorites,
    fetchFavorites,
    isLiked,
    setIsLiked,
    isDisliked,
    setIsDisliked,
    handleLike,
    handleDislike
  } = useFavorites({
    currentSong,
    sessionId,
    syncStatus: () => syncStatus(),
    handleSendMessage: (e, text) => handleSendMessage(e, text),
    onClearPreload: clearPreload
  });

  // Comparador de lista de canciones para evitar re-renders innecesarios
  const isSameTrackList = (listA, listB) => {
    if (!listA && !listB) return true;
    if (!listA || !listB) return false;
    if (listA.length !== listB.length) return false;
    for (let i = 0; i < listA.length; i++) {
      if ((listA[i]?.videoId || listA[i]?.id) !== (listB[i]?.videoId || listB[i]?.id)) {
        return false;
      }
    }
    return true;
  };

  const syncStatus = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/status');
      const data = await res.json();
      const newStatus = data.status === 'logeado';
      setIsConnected(prev => prev !== newStatus ? newStatus : prev);
      setQueue(prev => isSameTrackList(prev, data.queue) ? prev : (data.queue || []));
      setQueueSource(prev => prev !== data.source ? data.source : prev);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // 6. Sub-hook de MediaSession (Windows SMTC)
  const { ensureMediaAnchor, pauseMediaAnchor } = useMediaSession({
    currentSong,
    playerRef,
    isPlaying,
    setIsPlaying,
    handleNextRef,
    handlePreviousRef,
    handleNext: () => handleNextRef.current && handleNextRef.current(),
    handlePrevious: () => handlePreviousRef.current && handlePreviousRef.current()
  });

  // Manejo de Play/Pausa
  const handleTogglePlay = useCallback(() => {
    ensureMediaAnchor();
    if (!playerRef.current) return;
    try {
      const state = typeof playerRef.current.getPlayerState === 'function' ? playerRef.current.getPlayerState() : -1;
      if (state === 1) {
        playerRef.current.pauseVideo();
        pauseMediaAnchor();
        setIsPlaying(false);
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
        }
      } else {
        playerRef.current.playVideo();
        ensureMediaAnchor();
        setIsPlaying(true);
        if ('mediaSession' in navigator) {
          try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
        }
      }
    } catch (err) {
      console.error("Error al pausar/reanudar:", err);
    }
  }, [ensureMediaAnchor, pauseMediaAnchor]);

  // Sintesis de voz del navegador (fallback)
  const speakBrowser = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.95;

      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(v => v.lang.startsWith('es') && (v.name.includes('Natural') || v.name.includes('Neural') || v.name.includes('Google') || v.localService)) ||
                           voices.find(v => v.lang.startsWith('es'));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }

      const duckVol = typeof duckingVolumeRef.current === 'number' ? duckingVolumeRef.current : 20;
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(duckVol);
      }

      const restoreVolume = () => {
        if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
          playerRef.current.setVolume(100);
        }
      };

      utterance.onend = restoreVolume;
      utterance.onerror = restoreVolume;

      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Error en síntesis nativa del navegador:", e);
    }
  }, [duckingVolumeRef]);

  // Reproduccion de voz generada del DJ
  const playDJVoice = useCallback((audioUrl, text) => {
    if (!audioUrl) {
      if (text) speakBrowser(text);
      return;
    }
    const duckVol = typeof duckingVolumeRef.current === 'number' ? duckingVolumeRef.current : 20;
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(duckVol);
    }
    audioPlayerRef.current.src = `http://127.0.0.1:3001${audioUrl}`;
    audioPlayerRef.current.play().catch(() => {
      if (text) speakBrowser(text);
    });
    audioPlayerRef.current.onended = () => {
      if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(100);
      }
    };
  }, [speakBrowser, duckingVolumeRef]);

  // Precargar siguiente pista con anticipacion
  const preloadNextTrack = useCallback(async () => {
    if (isPreloadingRef.current || preloadedDataRef.current) return;
    isPreloadingRef.current = true;

    if (preloadAbortControllerRef.current) {
      try { preloadAbortControllerRef.current.abort(); } catch (e) {}
    }
    const controller = new AbortController();
    preloadAbortControllerRef.current = controller;

    try {
      console.log('DJ Radio: Faltan <= 50s. Precargando siguiente tema con anticipación...');
      const res = await fetch('http://127.0.0.1:3001/api/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          currentSong: currentSongRef.current,
          personality: personalityRef.current,
          frequency: frequencyRef.current,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          session_id: sessionId,
          taste_profile: tasteProfileRef.current || tasteProfile,
          voice_id: selectedVoiceRef.current || selectedVoice
        })
      });
      const data = await res.json();
      
      if (controller.signal.aborted) return;

      if (data.nextSong && data.nextSong.videoId) {
        if (removedVideoIdsRef.current.has(data.nextSong.videoId)) {
          console.log(`DJ Radio: El tema "${data.nextSong.title}" (${data.nextSong.videoId}) fue eliminado con X. Descartando precarga.`);
          preloadedDataRef.current = null;
          preloadTriggeredRef.current = null;
          return;
        }

        preloadedDataRef.current = data;

        if (data.audioUrl) {
          const preAudio = new Audio();
          preAudio.src = `http://127.0.0.1:3001${data.audioUrl}`;
          preAudio.preload = 'auto';
          preloadedAudioRef.current = preAudio;
          console.log(`DJ Radio: Audio del DJ precargado: ${data.nextSong.title}`);
        } else {
          console.log(`DJ Radio: Siguiente tema precargado (modo sesión silenciosa, $0 ElevenLabs): ${data.nextSong.title}`);
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('DJ Radio: Error en preloadNextTrack:', e);
      }
    } finally {
      isPreloadingRef.current = false;
      if (preloadAbortControllerRef.current === controller) {
        preloadAbortControllerRef.current = null;
      }
    }
  }, [sessionId, tasteProfile, selectedVoice, frequencyRef, personalityRef, selectedVoiceRef, tasteProfileRef]);

  // Mensajeria de usuario al DJ
  const handleSendMessage = useCallback(async (e, directText = null) => {
    if (e) e.preventDefault();
    const textToSend = directText || message.trim();
    if (!textToSend) return;

    setMessage('');
    const trimmed = textToSend.trim();
    const isPreviousRequest = /^(?:(?:ir\s+a\s+la\s+|pon(?:me)?\s+(?:la\s+)?)?(?:canci[oó]n\s+)?(?:anterior|previa)|regresa(?:r)?|vuelve(?:\s+a\s+la\s+anterior)?|atr[aá]s)$/i.test(trimmed);

    if (isPreviousRequest) {
      if (playedHistoryRef.current.length > 0 || historyRef.current.length > 0) {
        setChatHistory(prev => [...prev, { sender: 'user', text: textToSend }, { sender: 'dj', text: 'Regresando a la cancion anterior...' }]);
        if (handlePreviousRef.current) {
          handlePreviousRef.current();
        }
        return;
      } else {
        setChatHistory(prev => [...prev, { sender: 'user', text: textToSend }, { sender: 'dj', text: 'No hay canciones previas en el historial de esta sesion.' }]);
        return;
      }
    }

    setLoading(true);
    setChatHistory(prev => [...prev, { sender: 'user', text: textToSend }]);
    
    try {
      const response = await fetch('http://127.0.0.1:3001/api/chat', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: textToSend, 
          currentSong: currentSongRef.current, 
          searchType,
          personality: personalityRef.current,
          frequency: frequencyRef.current,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          session_id: sessionId,
          taste_profile: tasteProfileRef.current || tasteProfile,
          voice_id: selectedVoiceRef.current || selectedVoice
        })
      });
      const data = await response.json();

      if (data.action === 'previous') {
        if (handlePreviousRef.current) {
          handlePreviousRef.current();
        }
        return;
      }

      if (data.dj_comment) {
        setChatHistory(prev => [...prev, { sender: 'dj', text: data.dj_comment }]);
      }
      if (data.audioUrl) {
        playDJVoice(data.audioUrl, data.dj_comment);
      }
      if (data.nextSong?.videoId) {
        preloadedDataRef.current = null;
        preloadTriggeredRef.current = null;
        removedVideoIdsRef.current.clear();
        if (data.nextSong.repeatCount !== undefined) {
          setRepeatCount(data.nextSong.repeatCount);
        }
        if (data.nextSong.globalRepeatCount !== undefined) {
          setGlobalRepeatCount(data.nextSong.globalRepeatCount);
        }

        if (currentSongRef.current && currentSongRef.current.videoId !== data.nextSong.videoId) {
          const old = currentSongRef.current;
          const last = playedHistoryRef.current[playedHistoryRef.current.length - 1];
          if (!last || last.videoId !== old.videoId) {
            playedHistoryRef.current.push(old);
            setHistory([...playedHistoryRef.current].reverse());
          }
        }

        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(data.nextSong.videoId);
        }

        setCurrentSong(data.nextSong);
        currentSongRef.current = data.nextSong;
        syncStatus();
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  }, [message, searchType, playDJVoice, syncStatus, sessionId, tasteProfile, selectedVoice, frequencyRef, personalityRef, selectedVoiceRef, tasteProfileRef, setRepeatCount, setGlobalRepeatCount]);

  // Reproductor centralizado de pistas con historial
  const playTrack = useCallback((newSong, { isBackTrack = false, isReplay = false, djVoice = null } = {}) => {
    if (!newSong || !newSong.videoId) return;

    if (!isBackTrack && currentSongRef.current && currentSongRef.current.videoId !== newSong.videoId) {
      const old = currentSongRef.current;
      const last = playedHistoryRef.current[playedHistoryRef.current.length - 1];
      if (!last || last.videoId !== old.videoId) {
        playedHistoryRef.current.push(old);
        setHistory([...playedHistoryRef.current].reverse());
      }
    }

    const switchNow = () => {
      if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
        playerRef.current.loadVideoById(newSong.videoId);
      }
      removedVideoIdsRef.current.clear();
      setCurrentSong(newSong);
      currentSongRef.current = newSong;
      setIsPlaying(true);
      ensureMediaAnchor();

      if (djVoice && (djVoice.audioUrl || djVoice.comment)) {
        playDJVoice(djVoice.audioUrl, djVoice.comment);
      }

      if (crossfadeRef.current && playerRef.current && typeof playerRef.current.setVolume === 'function') {
        playerRef.current.setVolume(0);
        let upVol = 0;
        const targetVol = (djVoice?.audioUrl || djVoice?.comment)
          ? (typeof duckingVolumeRef.current === 'number' ? duckingVolumeRef.current : 20)
          : 100;
        const fadeUp = setInterval(() => {
          upVol = Math.min(targetVol, upVol + 25);
          try { playerRef.current.setVolume(upVol); } catch (e) {}
          if (upVol >= targetVol) clearInterval(fadeUp);
        }, 120);
      }

      fetch('http://127.0.0.1:3001/api/session/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song: newSong,
          spoke: !!djVoice?.audioUrl || !!djVoice?.comment,
          frequency: frequencyRef.current,
          isBackTrack,
          isReplay
        })
      }).catch(() => {});

      syncStatus();
    };

    if (crossfadeRef.current && !isBackTrack && playerRef.current && typeof playerRef.current.setVolume === 'function') {
      let vol = 100;
      try { vol = playerRef.current.getVolume() || 100; } catch (e) {}
      const fadeDown = setInterval(() => {
        vol = Math.max(0, vol - 25);
        try { playerRef.current.setVolume(vol); } catch (e) {}
        if (vol <= 0) {
          clearInterval(fadeDown);
          switchNow();
        }
      }, 60);
    } else {
      switchNow();
    }
  }, [ensureMediaAnchor, playDJVoice, syncStatus, crossfadeRef, duckingVolumeRef, frequencyRef]);

  // Transicion hacia la siguiente pista
  const handleNext = useCallback(async () => {
    ensureMediaAnchor();

    const playNextWithReplayCheck = (candidateSong) => {
      const isRewound = rewoundVideoIdsRef.current.has(candidateSong.videoId);
      if (isRewound) {
        rewoundVideoIdsRef.current.delete(candidateSong.videoId);
      }
      const isReplay = isRewound || (historyRef.current && historyRef.current.some(s => s.videoId === candidateSong.videoId));
      playTrack(candidateSong, { isBackTrack: false, isReplay, djVoice: null });
    };

    if (queueRef.current && queueRef.current.length > 0) {
      const nextSong = queueRef.current[0];
      if (nextSong && nextSong.videoId && !blockedVideoIdsRef.current.has(nextSong.videoId)) {
        setQueue(prev => prev.slice(1));
        fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' }).catch(() => {});
        playNextWithReplayCheck(nextSong);
        return;
      }
    }

    if (preloadedDataRef.current && preloadedDataRef.current.nextSong) {
      const { nextSong } = preloadedDataRef.current;
      preloadedDataRef.current = null;
      preloadTriggeredRef.current = null;
      if (nextSong && nextSong.videoId && !blockedVideoIdsRef.current.has(nextSong.videoId)) {
        fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' }).catch(() => {});
        playNextWithReplayCheck(nextSong);
        return;
      }
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' });
      const nextSong = await res.json();
      if (nextSong && nextSong.videoId && !nextSong.error && !blockedVideoIdsRef.current.has(nextSong.videoId)) {
        playNextWithReplayCheck(nextSong);
        return;
      }
    } catch (err) {
      console.warn("Error en salto a siguiente canción:", err);
    }

    try {
      await fetch('http://127.0.0.1:8000/queue/refill', { method: 'POST' });
      const res2 = await fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' });
      const nextSong2 = await res2.json();
      if (nextSong2 && nextSong2.videoId && !nextSong2.error) {
        playNextWithReplayCheck(nextSong2);
        return;
      }
    } catch (err) {}
  }, [ensureMediaAnchor, playTrack]);

  // Cancion anterior en orden estricto
  const handlePrevious = useCallback(async () => {
    ensureMediaAnchor();

    // Limpiar precargas pendientes al retroceder
    preloadedDataRef.current = null;
    preloadTriggeredRef.current = null;
    if (preloadAbortControllerRef.current) {
      try { preloadAbortControllerRef.current.abort(); } catch (e) {}
      preloadAbortControllerRef.current = null;
    }
    if (preloadedAudioRef.current) {
      try {
        preloadedAudioRef.current.pause();
        preloadedAudioRef.current.src = '';
      } catch (e) {}
      preloadedAudioRef.current = null;
    }

    if (playedHistoryRef.current.length === 0 && historyRef.current.length > 0) {
      const candidates = historyRef.current.filter(s => s.videoId !== currentSongRef.current?.videoId);
      if (candidates.length > 0) {
        playedHistoryRef.current = [...candidates].reverse();
      }
    }

    if (playedHistoryRef.current.length > 0) {
      const prevSong = playedHistoryRef.current.pop();
      const curr = currentSongRef.current;

      setHistory([...playedHistoryRef.current].reverse());

      if (curr && curr.videoId) {
        // Marcamos la cancion saliente como rebobinada para que no incremente el contador si se vuelve a ella
        rewoundVideoIdsRef.current.add(curr.videoId);
        setQueue(prev => [curr, ...prev.filter(s => s.videoId !== curr.videoId)]);
      }

      // Notificar a Python para sincronizar queue y history en el backend inmediatamente
      try {
        await fetch('http://127.0.0.1:8000/queue/step_back', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_song: curr,
            target_song: prevSong
          })
        });
      } catch (err) {
        console.error("Error sincronizando step_back en backend:", err);
      }

      playTrack(prevSong, { isBackTrack: true, isReplay: false, djVoice: null });
      return;
    }

    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(0, true);
      if (typeof playerRef.current.playVideo === 'function') {
        playerRef.current.playVideo();
      }
      setIsPlaying(true);
    }
  }, [ensureMediaAnchor, playTrack]);

  // Transicion ejecutada cuando una cancion termina
  const executeTransition = useCallback(() => {
    if (preloadedDataRef.current && preloadedDataRef.current.nextSong) {
      const { nextSong, dj_comment, audioUrl } = preloadedDataRef.current;
      preloadedDataRef.current = null;
      preloadTriggeredRef.current = null;

      if (removedVideoIdsRef.current.has(nextSong.videoId) || 
          (currentSongRef.current && nextSong.videoId === currentSongRef.current.videoId)) {
        fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' }).catch(() => {});
        handleNext();
        return;
      }

      fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' }).catch(() => {});

      if (dj_comment) {
        setChatHistory(prev => [...prev, { sender: 'dj', text: dj_comment }]);
      }

      playTrack(nextSong, {
        isBackTrack: false,
        djVoice: (audioUrl || dj_comment) ? { audioUrl, comment: dj_comment } : null
      });
      return;
    }

    handleNext();
  }, [handleNext, playTrack]);

  // Salto de emergencia para videos bloqueados
  const skipToNextImmediately = useCallback(async () => {
    try {
      console.log("[YouTube Error Handler]: Saltando de inmediato a la siguiente pista de la cola...");
      const res = await fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' });
      const nextSong = await res.json();
      if (nextSong && nextSong.videoId && !blockedVideoIdsRef.current.has(nextSong.videoId)) {
        playTrack(nextSong, { isBackTrack: false, djVoice: null });
        return;
      }
    } catch (err) {
      console.error("Error en salto rápido de canción bloqueada:", err);
    }
    handleNext();
  }, [handleNext, playTrack]);

  useEffect(() => {
    skipToNextImmediatelyRef.current = skipToNextImmediately;
  }, [skipToNextImmediately]);

  // Exportar playlist a YouTube oficial
  const handleExportPlaylist = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/playlist/export', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
        setChatHistory(prev => [
          ...prev, 
          { 
            sender: 'dj', 
            text: `¡Listo! He guardado tu sesión con ${data.count} canciones. La playlist se abrió en una nueva pestaña.` 
          }
        ]);
      } else if (data.error) {
        showAlert({
          title: "Exportar Playlist",
          message: data.error,
          type: "warning"
        });
      }
    } catch (e) {
      console.error("Error exportando playlist:", e);
      showAlert({
        title: "Exportar Playlist",
        message: "No se pudo exportar la playlist. Verifica que el servidor esté en línea.",
        type: "danger"
      });
    }
  }, [showAlert]);

  // Anadir cancion manual
  const handleAddManual = useCallback(async (e) => {
    if (e) e.preventDefault();
    const trimmed = manualSearch.trim();
    if (!trimmed) return;
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/queue/add?q=${encodeURIComponent(trimmed)}`, { method: 'POST' });
      const data = await res.json();
      if (data && data.error) {
        showAlert({
          title: "No se pudo añadir",
          message: data.error,
          type: "warning"
        });
      } else {
        setManualSearch('');
        syncStatus();
      }
    } catch (err) { 
      console.error(err); 
      showAlert({
        title: "Error de Conexión",
        message: "No se pudo conectar con el servidor para añadir la canción.",
        type: "danger"
      });
    }
  }, [manualSearch, syncStatus, showAlert]);

  // Reordenar en cola con actualizacion optimista instantanea
  const handleMoveInQueue = useCallback(async (videoId, toIndex) => {
    preloadedDataRef.current = null;
    preloadTriggeredRef.current = null;
    if (preloadAbortControllerRef.current) {
      try { preloadAbortControllerRef.current.abort(); } catch (e) {}
      preloadAbortControllerRef.current = null;
    }

    // Actualizacion optimista inmediata en la UI (0ms)
    setQueue(prevQueue => {
      const idx = prevQueue.findIndex(s => (s.videoId || s.id) === videoId);
      if (idx === -1) return prevQueue;
      const targetSong = prevQueue[idx];
      const nextList = prevQueue.filter(s => (s.videoId || s.id) !== videoId);
      const boundedIndex = Math.max(0, Math.min(toIndex, nextList.length));
      nextList.splice(boundedIndex, 0, targetSong);
      return nextList;
    });

    try {
      await fetch(`http://127.0.0.1:8000/queue/move/${videoId}?to_index=${toIndex}`, { method: 'POST' });
      await syncStatus();

      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
        try {
          const state = playerRef.current.getPlayerState();
          if (state === 1) {
            const duration = playerRef.current.getDuration();
            const current = playerRef.current.getCurrentTime();
            if (duration > 35 && (duration - current) <= 30 && currentSongRef.current?.videoId) {
              preloadTriggeredRef.current = currentSongRef.current.videoId;
              preloadNextTrack();
            }
          }
        } catch (err) {}
      }
    } catch (e) { 
      console.error("Error moviendo cancion en cola:", e); 
      await syncStatus();
    }
  }, [syncStatus, preloadNextTrack]);

  // Eliminar de cola
  const handleRemoveFromQueue = useCallback(async (videoId) => {
    removedVideoIdsRef.current.add(videoId);

    if (preloadedDataRef.current?.nextSong?.videoId === videoId) {
      console.log(`DJ Radio: Canción eliminada con X (${videoId}) era la precargada. Cancelando precarga.`);
      preloadedDataRef.current = null;
      preloadTriggeredRef.current = null;
      if (preloadedAudioRef.current) {
        try {
          preloadedAudioRef.current.pause();
          preloadedAudioRef.current.src = '';
        } catch (e) {}
        preloadedAudioRef.current = null;
      }
    }

    if (preloadAbortControllerRef.current) {
      try { preloadAbortControllerRef.current.abort(); } catch (e) {}
      preloadAbortControllerRef.current = null;
    }

    try {
      await fetch(`http://127.0.0.1:8000/queue/remove/${videoId}`, { method: 'POST' });
      await syncStatus();

      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
        try {
          const state = playerRef.current.getPlayerState();
          if (state === 1) {
            const duration = playerRef.current.getDuration();
            const current = playerRef.current.getCurrentTime();
            if (duration > 35 && (duration - current) <= 30 && currentSongRef.current?.videoId) {
              preloadTriggeredRef.current = currentSongRef.current.videoId;
              preloadNextTrack();
            }
          }
        } catch (err) {}
      }
    } catch (e) { 
      console.error(e); 
    }
  }, [syncStatus, preloadNextTrack]);

  // Polling de sincronizacion de estado
  useEffect(() => {
    syncStatus();
    const interval = setInterval(syncStatus, 5000);
    return () => clearInterval(interval);
  }, [syncStatus]);

  // Inyeccion de YouTube Iframe API Script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // Sincronizar referencias para MediaSession y callbacks asincronos
  useEffect(() => {
    handleNextRef.current = handleNext;
    executeTransitionRef.current = executeTransition;
    handlePreviousRef.current = handlePrevious;
  }, [handleNext, executeTransition, handlePrevious]);

  // Inicializacion del reproductor unico de YouTube
  useEffect(() => {
    let checkInterval = null;

    const createPlayer = () => {
      if (!window.YT || !window.YT.Player) return false;

      if (!playerRef.current) {
        playerRef.current = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          playerVars: { autoplay: 1, origin: window.location.origin, playsinline: 1 },
          events: {
            onStateChange: (e) => {
              if (e.data === 0) {
                setIsPlaying(false);
                if (executeTransitionRef.current) {
                  executeTransitionRef.current();
                }
              }
              if (e.data === 1) {
                setIsPlaying(true);
                ensureMediaAnchor();
                if ('mediaSession' in navigator) {
                  try { navigator.mediaSession.playbackState = 'playing'; } catch (err) {}
                }
                if (currentSongRef.current?.title) {
                  const cleanT = (currentSongRef.current.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                  fallbackAttemptsRef.current.delete(cleanT);
                }
                if (broadcastChannelRef.current) {
                  try {
                    broadcastChannelRef.current.postMessage({
                      type: 'PLAYING_ANOTHER_TAB',
                      tabId: tabIdRef.current
                    });
                  } catch (err) {}
                }
              }
              if (e.data === 2) {
                setIsPlaying(false);
                pauseMediaAnchor();
                if ('mediaSession' in navigator) {
                  try { navigator.mediaSession.playbackState = 'paused'; } catch (err) {}
                }
                if (!document.hidden) {
                  wasPlayingBeforeAutoPauseRef.current = false;
                }
              }
            },
            onError: async (e) => {
              const errorCode = e.data;
              const failedId = currentSongRef.current?.videoId;
              const songTitle = currentSongRef.current?.title || '';
              const songArtist = currentSongRef.current?.artist || '';
              const cleanT = (songTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');

              console.warn(`[YouTube Player Error]: Código ${errorCode} en video "${songTitle}" (${failedId})`);

              if (failedId) {
                blockedVideoIdsRef.current.add(failedId);
              }

              const attempts = fallbackAttemptsRef.current.get(cleanT) || 0;

              if (failedId && attempts === 0 && songTitle) {
                fallbackAttemptsRef.current.set(cleanT, 1);
                try {
                  console.log(`[YouTube Fallback]: Buscando versión alternativa reproducible para "${songTitle}"...`);
                  const excluded = Array.from(blockedVideoIdsRef.current).join(',');
                  const res = await fetch(`http://127.0.0.1:3001/api/video/fallback?title=${encodeURIComponent(songTitle)}&artist=${encodeURIComponent(songArtist)}&exclude_id=${encodeURIComponent(excluded)}`);
                  const data = await res.json();
                  if (data.videoId && !blockedVideoIdsRef.current.has(data.videoId)) {
                    console.log(`[YouTube Fallback]: Cambiando a versión alternativa: ${data.videoId} (${data.title})`);
                    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
                      playerRef.current.loadVideoById(data.videoId);
                    }
                    setCurrentSong(prev => prev ? { ...prev, videoId: data.videoId, title: data.title || prev.title } : null);
                    return;
                  }
                } catch (err) {
                  console.error("[YouTube Fallback Error]:", err);
                }
              }

              console.warn(`[YouTube Error]: Video bloqueado por derechos o no reproducible (${errorCode}). Saltando inmediatamente a la siguiente pista de la cola.`);
              if (skipToNextImmediatelyRef.current) {
                await skipToNextImmediatelyRef.current();
              } else if (executeTransitionRef.current) {
                executeTransitionRef.current();
              }
            }
          }
        });
      }

      return true;
    };

    if (!createPlayer()) {
      checkInterval = setInterval(() => {
        if (createPlayer()) {
          clearInterval(checkInterval);
        }
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [ensureMediaAnchor, pauseMediaAnchor, broadcastChannelRef, tabIdRef, wasPlayingBeforeAutoPauseRef]);

  // Auto-pausa al cambiar de pestaña
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!autoPauseOnTabChangeRef.current) return;

      if (document.hidden) {
        try {
          if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
            const state = playerRef.current.getPlayerState();
            if (state === 1 || state === 3) {
              wasPlayingBeforeAutoPauseRef.current = true;
              playerRef.current.pauseVideo();
            }
          }
        } catch (e) {
          console.warn('Error al pausar video en segundo plano:', e);
        }

        try {
          if (
            audioPlayerRef.current &&
            !audioPlayerRef.current.paused &&
            !audioPlayerRef.current.ended &&
            audioPlayerRef.current.currentTime > 0
          ) {
            wasDJSpeakingBeforeAutoPauseRef.current = true;
            audioPlayerRef.current.pause();
          }
        } catch (e) {
          console.warn('Error al pausar audio DJ en segundo plano:', e);
        }

        try {
          if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
            wasSpeechSpeakingBeforeAutoPauseRef.current = true;
            window.speechSynthesis.pause();
          }
        } catch (e) {}
      } else {
        if (wasPlayingBeforeAutoPauseRef.current) {
          wasPlayingBeforeAutoPauseRef.current = false;
          try {
            if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
              playerRef.current.playVideo();
            }
          } catch (e) {
            console.warn('Error al reanudar video tras volver a pestaña:', e);
          }
        }

        if (wasDJSpeakingBeforeAutoPauseRef.current) {
          wasDJSpeakingBeforeAutoPauseRef.current = false;
          try {
            if (audioPlayerRef.current && audioPlayerRef.current.paused) {
              audioPlayerRef.current.play().catch(() => {});
            }
          } catch (e) {}
        }

        if (wasSpeechSpeakingBeforeAutoPauseRef.current) {
          wasSpeechSpeakingBeforeAutoPauseRef.current = false;
          try {
            if ('speechSynthesis' in window && window.speechSynthesis.paused) {
              window.speechSynthesis.resume();
            }
          } catch (e) {}
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoPauseOnTabChangeRef, wasPlayingBeforeAutoPauseRef, wasDJSpeakingBeforeAutoPauseRef, wasSpeechSpeakingBeforeAutoPauseRef]);

  // BroadcastChannel entre pestanas
  useEffect(() => {
    try {
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('gemini_radio_tabs');
        broadcastChannelRef.current = channel;

        channel.onmessage = (event) => {
          if (!event?.data) return;
          const { type, tabId } = event.data;
          if (type === 'PLAYING_ANOTHER_TAB' && tabId !== tabIdRef.current) {
            if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
              try {
                const state = playerRef.current.getPlayerState();
                if (state === 1) {
                  playerRef.current.pauseVideo();
                  pauseMediaAnchor();
                  setIsPlaying(false);
                }
              } catch (e) {}
            }
          }
        };

        return () => {
          try { channel.close(); } catch (e) {}
          broadcastChannelRef.current = null;
        };
      }
    } catch (e) {}
  }, [pauseMediaAnchor, broadcastChannelRef, tabIdRef]);

  // Sincronizacion de reproduccion al cambiar cancion actual
  useEffect(() => {
    if (!currentSong?.videoId) {
      if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
        playerRef.current.stopVideo();
      }
      setIsPlaying(false);
      return;
    }
    currentSongRef.current = currentSong;
    setIsLiked(false);
    setIsDisliked(false);
    preloadTriggeredRef.current = null;
    preloadedDataRef.current = null;

    fetch(`http://127.0.0.1:8000/history/record/${currentSong.videoId}`, { method: 'POST' }).catch(() => {});

    fetch(`http://127.0.0.1:3001/api/favorites/count/${currentSong.videoId}?session_id=${encodeURIComponent(sessionId)}`)
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.sessionCount !== undefined) {
            setRepeatCount(data.sessionCount);
          } else if (currentSong.repeatCount !== undefined) {
            setRepeatCount(currentSong.repeatCount);
          }
          if (data.totalCount !== undefined) {
            setGlobalRepeatCount(data.totalCount);
          } else if (currentSong.globalRepeatCount !== undefined) {
            setGlobalRepeatCount(currentSong.globalRepeatCount);
          }
        }
      })
      .catch(() => {
        if (currentSong.repeatCount !== undefined) {
          setRepeatCount(currentSong.repeatCount);
        }
        if (currentSong.globalRepeatCount !== undefined) {
          setGlobalRepeatCount(currentSong.globalRepeatCount);
        }
      });

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.loadVideoById(currentSong.videoId);
    } else {
      const retryTimer = setTimeout(() => {
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(currentSong.videoId);
        }
      }, 800);
      return () => clearTimeout(retryTimer);
    }
  }, [currentSong?.videoId, sessionId, setRepeatCount, setGlobalRepeatCount, setIsLiked, setIsDisliked]);

  // Ticker de monitoreo para precargar temas y sincronizar SMTC
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !playerRef.current ||
        typeof playerRef.current.getPlayerState !== 'function' ||
        typeof playerRef.current.getCurrentTime !== 'function'
      ) {
        return;
      }

      try {
        const state = playerRef.current.getPlayerState();
        if (state === 1) {
          ensureMediaAnchor();
          const duration = playerRef.current.getDuration();
          const current = playerRef.current.getCurrentTime();

          if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
            try {
              navigator.mediaSession.setPositionState({
                duration: Math.max(duration, 0),
                playbackRate: 1,
                position: Math.min(Math.max(0, current), duration)
              });
            } catch (e) {}
          }

          const remaining = duration - current;
          const preloadThreshold = duration > 65 ? 50 : Math.max(15, Math.floor(duration * 0.4));

          if (
            duration > 20 &&
            remaining <= preloadThreshold &&
            currentSongRef.current?.videoId &&
            preloadTriggeredRef.current !== currentSongRef.current.videoId &&
            !isPreloadingRef.current &&
            !preloadedDataRef.current
          ) {
            preloadTriggeredRef.current = currentSongRef.current.videoId;
            preloadNextTrack();
          }
        }
      } catch (err) {}
    }, 1000);

    return () => clearInterval(timer);
  }, [preloadNextTrack, ensureMediaAnchor]);

  // Auto-scroll del chat
  useEffect(() => { 
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [chatHistory]);

  return {
    message,
    setMessage,
    chatHistory,
    isMenuOpen,
    setIsMenuOpen,
    currentSong,
    loading,
    isListening,
    isConnected,
    queue,
    history,
    queueSource,
    manualSearch,
    setManualSearch,
    isLiked,
    isDisliked,
    searchType,
    setSearchType,
    sortedModes,
    activeMode,
    toggleListening,
    handleAddManual,
    handleMoveInQueue,
    handleRemoveFromQueue,
    handleSendMessage,
    handleNext,
    handlePrevious,
    isPlaying,
    handleTogglePlay,
    handleLike,
    handleDislike,
    chatEndRef,
    frequency,
    setFrequency,
    personality,
    setPersonality,
    crossfade,
    setCrossfade,
    autoPauseOnTabChange,
    setAutoPauseOnTabChange,
    duckingVolume,
    setDuckingVolume,
    isSettingsOpen,
    setIsSettingsOpen,
    isLyricsOpen,
    setIsLyricsOpen,
    isTriviaOpen,
    setIsTriviaOpen,
    currentTrivia,
    loadingTrivia,
    handleOpenTrivia,
    handleAnotherTrivia,
    handleAskDJMore,
    handleShareTriviaToChat,
    handleExportPlaylist,
    sessionId,
    sessionStatus,
    sessionName,
    handleNewSession,
    isSessionsOpen,
    setIsSessionsOpen,
    sessionsList,
    handleSwitchSession,
    handleCreateSession,
    handleRenameSession,
    handleDeleteSession,
    fetchSessions,
    modalDialog,
    setModalDialog,
    showConfirm,
    showAlert,
    playerRef,
    repeatCount,
    setRepeatCount,
    globalRepeatCount,
    setGlobalRepeatCount,
    isFavoritesOpen,
    setIsFavoritesOpen,
    favoritesList,
    sessionFavoritesList,
    globalFavoritesList,
    loadingFavorites,
    fetchFavorites,
    tasteProfile,
    isTasteModalOpen,
    setIsTasteModalOpen,
    loadingTasteProfile,
    fetchTasteProfile,
    saveTasteProfile,
    selectedVoice,
    setSelectedVoice,
    playingPreviewVoiceId,
    handlePlayVoicePreview
  };
}
