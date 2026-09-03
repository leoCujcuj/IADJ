import { useState, useRef, useEffect, useCallback } from 'react';
import { Music, Disc, ListMusic, User } from 'lucide-react';

export default function useDJRadio() {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { sender: 'dj', text: '¡Qué onda mucha! Soy tu DJ de Gemini Radio. ¿Qué te pongo hoy?' }
  ]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [queueSource, setQueueSource] = useState(null);
  const [manualSearch, setManualSearch] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [dislikeStreak, setDislikeStreak] = useState(0);
  const [searchType, setSearchType] = useState('song');

  const modes = [
    { id: 'song', icon: Music, title: 'Modo Canción', placeholder: 'canción' },
    { id: 'album', icon: Disc, title: 'Modo Álbum', placeholder: 'álbum' },
    { id: 'playlist', icon: ListMusic, title: 'Modo Playlist', placeholder: 'playlist' },
    { id: 'artist', icon: User, title: 'Modo Artista', placeholder: 'artista' }
  ];
  
  const sortedModes = [...modes].sort((a, b) => a.id === searchType ? -1 : b.id === searchType ? 1 : 0);
  const activeMode = modes.find(m => m.id === searchType);  

  const [frequency, setFrequencyState] = useState(() => {
    const saved = localStorage.getItem('dj_frequency');
    return saved !== null ? Number(saved) : 5;
  });
  const [personality, setPersonalityState] = useState(() => {
    return localStorage.getItem('dj_personality') || 'chill';
  });
  const [crossfade, setCrossfadeState] = useState(() => {
    return localStorage.getItem('dj_crossfade') !== 'false';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isTriviaOpen, setIsTriviaOpen] = useState(false);
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [loadingTrivia, setLoadingTrivia] = useState(false);
  const triviaCacheRef = useRef(new Map());

  const frequencyRef = useRef(frequency);
  const personalityRef = useRef(personality);
  const crossfadeRef = useRef(crossfade);

  const setFrequency = (val) => {
    setFrequencyState(val);
    frequencyRef.current = val;
    localStorage.setItem('dj_frequency', val);
  };
  const setPersonality = (val) => {
    setPersonalityState(val);
    personalityRef.current = val;
    localStorage.setItem('dj_personality', val);
  };
  const setCrossfade = (val) => {
    setCrossfadeState(val);
    crossfadeRef.current = val;
    localStorage.setItem('dj_crossfade', val);
  };

  // --- Estados de Persistencia de Sesión (PostgreSQL + LocalStorage) ---
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('dj_session_id') || 'session_default';
  });
  const [sessionName, setSessionName] = useState('Sesión Principal');
  const [sessionStatus, setSessionStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'restored' | 'error'
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const isRestoringSessionRef = useRef(true);
  const saveTimeoutRef = useRef(null);

  // --- Sistema Profesional de Confirmaciones y Alertas (Reemplazo de alert/confirm) ---
  const [modalDialog, setModalDialog] = useState(null);

  const showConfirm = useCallback(({ title, message, type = 'warning', confirmText = 'Aceptar', cancelText = 'Cancelar' }) => {
    return new Promise((resolve) => {
      setModalDialog({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        cancelText,
        isAlert: false,
        onConfirm: () => {
          setModalDialog(null);
          resolve(true);
        },
        onClose: () => {
          setModalDialog(null);
          resolve(false);
        }
      });
    });
  }, []);

  const showAlert = useCallback(({ title, message, type = 'info', confirmText = 'Entendido' }) => {
    return new Promise((resolve) => {
      setModalDialog({
        isOpen: true,
        title,
        message,
        type,
        confirmText,
        isAlert: true,
        onConfirm: () => {
          setModalDialog(null);
          resolve(true);
        },
        onClose: () => {
          setModalDialog(null);
          resolve(true);
        }
      });
    });
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:3001/api/sessions');
      const data = await res.json();
      if (data && Array.isArray(data.sessions)) {
        setSessionsList(data.sessions);
      }
    } catch (e) {
      console.warn("Error cargando lista de sesiones:", e);
    }
  }, []);

  const playerRef = useRef(null);
  const currentSongRef = useRef(null);
  const preloadedDataRef = useRef(null);
  const preloadTriggeredRef = useRef(null);
  const isPreloadingRef = useRef(false);
  const preloadAbortControllerRef = useRef(null);
  const preloadedAudioRef = useRef(null);
  const removedVideoIdsRef = useRef(new Set());
  const executeTransitionRef = useRef(null);

  const chatEndRef = useRef(null);   
  const audioPlayerRef = useRef(new Audio());
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const handleNextRef = useRef(null);
  const messageRef = useRef(message);
  const initialTextRef = useRef('');

  useEffect(() => {
    messageRef.current = message;
  }, [message]);

  // --- API / State Synchronizers ---
  const syncStatus = useCallback(async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/status');
      const data = await res.json();
      setIsConnected(data.status === 'logeado');
      setQueue(data.queue || []);
      setHistory(data.history || []);
      setQueueSource(data.source);
    } catch (e) { 
      console.error(e); 
    }
  }, []);

  // --- Audio / Voice Utilities ---
  const speakBrowser = useCallback((text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }, []);

  const playDJVoice = useCallback((audioUrl, text) => {
    if (!audioUrl) { 
      if (text) speakBrowser(text); 
      return; 
    }
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(20);
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
  }, [speakBrowser]);

  // Precargar siguiente canción a los últimos 30 segundos
  const preloadNextTrack = useCallback(async () => {
    if (isPreloadingRef.current || preloadedDataRef.current) return;
    isPreloadingRef.current = true;

    if (preloadAbortControllerRef.current) {
      try { preloadAbortControllerRef.current.abort(); } catch (e) {}
    }
    const controller = new AbortController();
    preloadAbortControllerRef.current = controller;

    try {
      console.log('DJ Radio: Faltan <= 30s. Precargando siguiente tema...');
      const res = await fetch('http://127.0.0.1:3001/api/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ 
          currentSong: currentSongRef.current,
          personality: personalityRef.current,
          frequency: frequencyRef.current,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      const data = await res.json();
      
      if (controller.signal.aborted) return;

      if (data.nextSong && data.nextSong.videoId) {
        // Si el usuario eliminó esta canción con 'X' mientras cargaba la precarga, descartarla de inmediato
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
  }, []);

  // --- Actions ---
  const handleSendMessage = useCallback(async (e, directText = null) => {
    if (e) e.preventDefault();
    const textToSend = directText || message.trim();
    if (!textToSend) return;
    
    if (isListeningRef.current) {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (err) {}
      }
      setIsListening(false);
    }

    setMessage(''); 
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
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
      const data = await response.json();
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
        setCurrentSong(data.nextSong);
        currentSongRef.current = data.nextSong;
        syncStatus();
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  }, [message, searchType, playDJVoice, syncStatus]);

  const executeTransition = useCallback(() => {
    // Si la canción ya fue precargada con anticipación a los 30s
    if (preloadedDataRef.current && preloadedDataRef.current.nextSong) {
      const { nextSong, dj_comment, audioUrl } = preloadedDataRef.current;
      preloadedDataRef.current = null;
      preloadTriggeredRef.current = null;

      // Salvaguarda: si la canción precargada fue eliminada por el usuario con X, NUNCA reproducirla
      if (removedVideoIdsRef.current.has(nextSong.videoId)) {
        console.warn(`DJ Radio: La canción precargada "${nextSong.title}" (${nextSong.videoId}) fue eliminada con X. Descartando y solicitando siguiente válida.`);
        if (preloadedAudioRef.current) {
          try {
            preloadedAudioRef.current.pause();
            preloadedAudioRef.current.src = '';
          } catch (e) {}
          preloadedAudioRef.current = null;
        }
        handleSendMessage(null, "Siguiente canción DJ.");
        return;
      }

      fetch('http://127.0.0.1:8000/queue/pop', { method: 'POST' }).catch(() => {});
      fetch('http://127.0.0.1:3001/api/session/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song: nextSong,
          spoke: !!audioUrl,
          frequency: frequencyRef.current
        })
      }).catch(() => {});

      if (dj_comment) {
        setChatHistory(prev => [...prev, { sender: 'dj', text: dj_comment }]);
      }

      const switchVideo = () => {
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(nextSong.videoId);
        }
        removedVideoIdsRef.current.clear();
        setCurrentSong(nextSong);
        currentSongRef.current = nextSong;

        if (audioUrl) {
          playDJVoice(audioUrl, dj_comment);
        }

        // Fade up si crossfade está activo
        if (crossfadeRef.current && playerRef.current && typeof playerRef.current.setVolume === 'function') {
          playerRef.current.setVolume(0);
          let upVol = 0;
          const fadeUp = setInterval(() => {
            upVol = Math.min(100, upVol + 25);
            try { playerRef.current.setVolume(upVol); } catch (e) {}
            if (upVol >= 100) clearInterval(fadeUp);
          }, 120);
        }

        syncStatus();
      };

      // Si crossfade está activo, fade down antes de cambiar
      if (crossfadeRef.current && playerRef.current && typeof playerRef.current.setVolume === 'function') {
        let vol = 100;
        try { vol = playerRef.current.getVolume() || 100; } catch (e) {}
        const fadeDown = setInterval(() => {
          vol = Math.max(0, vol - 25);
          try { playerRef.current.setVolume(vol); } catch (e) {}
          if (vol <= 0) {
            clearInterval(fadeDown);
            switchVideo();
          }
        }, 60);
      } else {
        switchVideo();
      }
      return;
    }

    // Si no había precarga lista (ej: salto manual inmediato)
    handleSendMessage(null, "Siguiente canción DJ.");
  }, [handleSendMessage, playDJVoice, syncStatus]);

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

  const handleNext = useCallback(() => {
    executeTransition();
  }, [executeTransition]);

  const handlePrevious = useCallback(() => {
    handleSendMessage(null, "DJ, pon la canción anterior.");
  }, [handleSendMessage]);

  const handleAddManual = useCallback(async (e) => {
    if (e) e.preventDefault();
    const trimmed = manualSearch.trim();
    if (!trimmed) return;
    
    const isYoutubeLink = trimmed.includes('youtube.com') || trimmed.includes('youtu.be');
    if (!isYoutubeLink) {
      showAlert({
        title: "Enlace no válido",
        message: "Solo se permiten enlaces directos de canciones o videos de YouTube.",
        type: "warning"
      });
      setManualSearch('');
      return;
    }
    
    try {
      await fetch(`http://127.0.0.1:8000/queue/add?q=${encodeURIComponent(trimmed)}`, { method: 'POST' });
      setManualSearch('');
      syncStatus();
    } catch (e) { 
      console.error(e); 
    }
  }, [manualSearch, syncStatus]);

  const handleMoveInQueue = useCallback(async (videoId, toIndex) => {
    // Si se reordena la cola, la canción siguiente precargada puede ya no ser la primera
    preloadedDataRef.current = null;
    preloadTriggeredRef.current = null;
    if (preloadAbortControllerRef.current) {
      try { preloadAbortControllerRef.current.abort(); } catch (e) {}
      preloadAbortControllerRef.current = null;
    }

    try {
      await fetch(`http://127.0.0.1:8000/queue/move/${videoId}?to_index=${toIndex}`, { method: 'POST' });
      await syncStatus();

      // Si sigue sonando y faltan <= 30s, volver a precargar el nuevo tema que quedó de primero
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

  const handleRemoveFromQueue = useCallback(async (videoId) => {
    // 1. Guardar en el set de eliminados para que ninguna precarga antigua la reproduzca
    removedVideoIdsRef.current.add(videoId);

    // 2. Si la canción eliminada coincide con la que estaba precargada, destruirla de inmediato
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

    // 3. Abortar cualquier petición de precarga en vuelo que pudiera estar procesando esta canción
    if (preloadAbortControllerRef.current) {
      try { preloadAbortControllerRef.current.abort(); } catch (e) {}
      preloadAbortControllerRef.current = null;
    }

    try {
      await fetch(`http://127.0.0.1:8000/queue/remove/${videoId}`, { method: 'POST' });
      await syncStatus();

      // 4. Si la canción actual sigue sonando y faltan <= 30s, precargar de inmediato la nueva siguiente canción
      if (playerRef.current && typeof playerRef.current.getPlayerState === 'function') {
        try {
          const state = playerRef.current.getPlayerState();
          if (state === 1) { // 1 = PLAYING
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

  const handleLike = useCallback(async () => {
    if (!currentSong || isLiked) return;
    setIsLiked(true);
    setDislikeStreak(0);
    try {
      await fetch(`http://127.0.0.1:8000/like/${currentSong.videoId}?artist=${encodeURIComponent(currentSong.artist)}&current_title=${encodeURIComponent(currentSong.title)}`, { 
        method: 'POST' 
      });
      syncStatus();
    } catch (e) { 
      setIsLiked(false); 
      console.error(e); 
    }
  }, [currentSong, isLiked, syncStatus]);

  const handleDislike = useCallback(async () => {
    if (!currentSong || isDisliked) return;
    setIsDisliked(true);
    const newStreak = dislikeStreak + 1;
    setDislikeStreak(newStreak);

    // 1. Limpiar precargas previas de la canción descartada
    preloadedDataRef.current = null;
    preloadTriggeredRef.current = null;
    if (preloadedAudioRef.current) {
      try {
        preloadedAudioRef.current.pause();
        preloadedAudioRef.current.src = '';
      } catch (e) {}
      preloadedAudioRef.current = null;
    }

    try {
      // 2. Registrar el dislike en el servicio de música (YT Music rate_song DISLIKE y cola renovada)
      await fetch(`http://127.0.0.1:8000/dislike/${currentSong.videoId}?artist=${encodeURIComponent(currentSong.artist)}`, { 
        method: 'POST' 
      });

      // 3. Saltar de inmediato a la siguiente canción sin demoras
      if (newStreak >= 3) {
        handleSendMessage(null, "He dado dislike a varias canciones seguidas. DJ, cambia totalmente de estilo y recomiéndame algo diferente.");
        setDislikeStreak(0);
      } else {
        handleSendMessage(null, "He dado dislike. Siguiente canción DJ.");
      }
    } catch (e) { 
      setIsDisliked(false); 
      console.error(e); 
    }
  }, [currentSong, isDisliked, dislikeStreak, handleSendMessage]);

  const toggleListening = useCallback(() => {
    // Opera y Opera GX no tienen servidores de backend para Web Speech API
    const isOpera = (!!window.opr && !!window.opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
    if (isOpera) {
      showAlert({
        title: "Navegador no compatible",
        message: "Opera y Opera GX no cuentan con servidores para transcribir voz a texto (Web Speech API).\n\nPor favor, abre la aplicación en Google Chrome o Microsoft Edge para usar el micrófono.",
        type: "warning"
      });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showAlert({
        title: "Reconocimiento no disponible",
        message: "Tu navegador no soporta reconocimiento de voz nativo. Por favor usa Google Chrome o Microsoft Edge.",
        type: "warning"
      });
      return;
    }

    // Si ya está escuchando, detener limpiamente
    if (isListeningRef.current) {
      isListeningRef.current = false;
      setIsListening(false);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          try { recognitionRef.current.abort(); } catch (e) {}
        }
        recognitionRef.current = null;
      }
      return;
    }

    // Limpiar cualquier instancia huérfana previa
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

    // Guardar texto existente para añadir la voz sin borrar lo que ya escribió el usuario
    initialTextRef.current = messageRef.current ? messageRef.current.trim() : '';

    // Activar estado de escucha
    isListeningRef.current = true;
    setIsListening(true);

    // Determinar idioma con máxima compatibilidad
    let speechLang = 'es-ES';
    const navLang = navigator.language || '';
    if (navLang) {
      speechLang = navLang.toLowerCase() === 'es' ? 'es-ES' : navLang;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = speechLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("[Mic]: Escuchando activamente en:", speechLang);
    };

    // Actualizar en tiempo real el input del chat a medida que habla el usuario
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (item && item[0] && item[0].transcript) {
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }
      }

      const spokenText = (finalTranscript + interimTranscript).trim();
      console.log("[Mic LIVE]:", spokenText);
      if (spokenText) {
        const prefix = initialTextRef.current ? `${initialTextRef.current} ` : '';
        setMessage(prefix + spokenText);
      }
    };

    recognition.onerror = (event) => {
      console.warn("[Mic Error]:", event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        showAlert({
          title: "Permiso Denegado",
          message: "Permiso de micrófono denegado. Permítelo en el icono de candado o permisos junto a la URL en tu navegador.",
          type: "warning"
        });
      } else if (event.error === 'network') {
        showAlert({
          title: "Error de Conexión de Voz",
          message: "Error de conexión con el servicio de voz. Si usas Brave o un bloqueador de anuncios, habilita los servicios de voz de Google en Configuración o prueba en Google Chrome / Microsoft Edge.",
          type: "warning"
        });
      } else if (event.error === 'audio-capture') {
        showAlert({
          title: "Micrófono no Detectado",
          message: "No se detectó audio del micrófono. Comprueba tu micrófono en la configuración de sonido del sistema.",
          type: "warning"
        });
      }
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      console.log("[Mic]: Fin de sesión de micrófono");
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error("[Mic Start Error]:", err);
      isListeningRef.current = false;
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [showAlert]);

  // Cleanup de reconocimiento de voz al desmontar
  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  // Periódico de sincronización de estado
  useEffect(() => {
    syncStatus();
    const interval = setInterval(syncStatus, 5000);
    return () => clearInterval(interval);
  }, [syncStatus]);

  // Restauración de sesión desde PostgreSQL (o localStorage como respaldo)
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3001/api/session/current');
        const data = await res.json();

        if (!isMounted) return;

        if (data && data.exists && data.session) {
          const s = data.session;
          if (s.id) {
            setSessionId(s.id);
            localStorage.setItem('dj_session_id', s.id);
          }
          if (s.name) setSessionName(s.name);
          if (s.current_song && s.current_song.videoId) {
            setCurrentSong(s.current_song);
            currentSongRef.current = s.current_song;
          }
          if (Array.isArray(s.queue) && s.queue.length > 0) {
            setQueue(s.queue);
          }
          if (Array.isArray(s.history) && s.history.length > 0) {
            setHistory(s.history);
          }
          if (Array.isArray(s.chat_history) && s.chat_history.length > 0) {
            setChatHistory(s.chat_history);
          }
          if (s.settings) {
            if (s.settings.frequency !== undefined) setFrequency(s.settings.frequency);
            if (s.settings.personality) setPersonality(s.settings.personality);
            if (s.settings.crossfade !== undefined) setCrossfade(s.settings.crossfade);
          }
          setSessionStatus('restored');
          console.log('[SESIÓN] Sesión restaurada con éxito desde la Base de Datos.');
        } else {
          // Fallback a localStorage si la BD aún no tiene sesión guardada
          const backup = localStorage.getItem('dj_session_backup');
          if (backup) {
            try {
              const parsed = JSON.parse(backup);
              if (parsed.currentSong) setCurrentSong(parsed.currentSong);
              if (parsed.queue) setQueue(parsed.queue);
              if (parsed.history) setHistory(parsed.history);
              if (parsed.chatHistory) setChatHistory(parsed.chatHistory);
              console.log('[SESIÓN] Sesión restaurada desde copia local de respaldo.');
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('No se pudo conectar con el servidor para restaurar sesión, recurriendo a caché local:', err);
        const backup = localStorage.getItem('dj_session_backup');
        if (backup) {
          try {
            const parsed = JSON.parse(backup);
            if (parsed.currentSong) setCurrentSong(parsed.currentSong);
            if (parsed.queue) setQueue(parsed.queue);
            if (parsed.history) setHistory(parsed.history);
            if (parsed.chatHistory) setChatHistory(parsed.chatHistory);
          } catch (e) {}
        }
      } finally {
        setTimeout(() => {
          isRestoringSessionRef.current = false;
        }, 1200);
        fetchSessions();
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [fetchSessions]);

  // Recargar sesiones al abrir el panel lateral
  useEffect(() => {
    if (isSessionsOpen) {
      fetchSessions();
    }
  }, [isSessionsOpen, fetchSessions]);

  // Autoguardado con debounce (1.5 segundos) hacia PostgreSQL y localStorage
  useEffect(() => {
    if (isRestoringSessionRef.current) return;
    if (!currentSong && queue.length === 0 && history.length === 0 && chatHistory.length <= 1) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    setSessionStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      const payload = {
        id: sessionId,
        name: sessionName,
        current_song: currentSong,
        queue,
        history,
        chat_history: chatHistory,
        settings: {
          frequency,
          personality,
          crossfade
        }
      };

      // Respaldo inmediato en localStorage
      try {
        localStorage.setItem('dj_session_backup', JSON.stringify({
          currentSong,
          queue,
          history,
          chatHistory
        }));
      } catch (e) {}

      // Guardado en PostgreSQL
      try {
        const res = await fetch('http://127.0.0.1:3001/api/session/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data && data.success) {
          setSessionStatus('saved');
        } else {
          setSessionStatus('error');
        }
      } catch (err) {
        console.warn('Error en autoguardado de sesión en BD:', err);
        setSessionStatus('error');
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [currentSong, queue, history, chatHistory, frequency, personality, crossfade, sessionId, sessionName]);

  // Inyección de YouTube Iframe API Script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // Sincronizar la ref de handleNext y executeTransition
  useEffect(() => {
    handleNextRef.current = executeTransition;
    executeTransitionRef.current = executeTransition;
  }, [executeTransition]);

  // Inicialización del reproductor único de YouTube
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
              // e.data === 0 significa fin natural de la canción
              if (e.data === 0 && executeTransitionRef.current) {
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
  }, []);

  // Cargar video en el reproductor cuando cambia currentSong
  useEffect(() => {
    if (!currentSong?.videoId) return;
    currentSongRef.current = currentSong;
    setIsLiked(false);
    setIsDisliked(false);
    preloadTriggeredRef.current = null;
    preloadedDataRef.current = null;

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
  }, [currentSong?.videoId]);

  // Ticker de monitoreo para precargar a los últimos 30 segundos
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
        if (state === 1) { // 1 = PLAYING
          const duration = playerRef.current.getDuration();
          const current = playerRef.current.getCurrentTime();
          const remaining = duration - current;

          // Cuando falten 30 segundos o menos para terminar la canción
          if (
            duration > 35 &&
            remaining <= 30 &&
            currentSongRef.current?.videoId &&
            preloadTriggeredRef.current !== currentSongRef.current.videoId &&
            !isPreloadingRef.current &&
            !preloadedDataRef.current
          ) {
            preloadTriggeredRef.current = currentSongRef.current.videoId;
            preloadNextTrack();
          }
        }
      } catch (err) {
        // Ignorar si el reproductor aún está cargando
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [preloadNextTrack]);

  // Teclas multimedia y shortcuts de teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Siguiente
      if (e.key === 'MediaTrackNext' || (e.ctrlKey && e.key === 'ArrowRight')) {
        handleNext();
      }
      // Anterior
      if (e.key === 'MediaTrackPrevious' || (e.ctrlKey && e.key === 'ArrowLeft')) {
        handlePrevious();
      }
    };

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('nexttrack', handleNext);
      navigator.mediaSession.setActionHandler('previoustrack', handlePrevious);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
      }
    };
  }, [handleNext, handlePrevious]);

  // Auto-scroll del chat
  useEffect(() => { 
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [chatHistory]);

  // Curiosidades de la canción y el artista
  const handleOpenTrivia = useCallback(async (isRefresh = false) => {
    if (!currentSong?.videoId) return;

    setIsTriviaOpen(true);

    if (!isRefresh && triviaCacheRef.current.has(currentSong.videoId)) {
      setCurrentTrivia(triviaCacheRef.current.get(currentSong.videoId));
      return;
    }

    setLoadingTrivia(true);

    try {
      const params = new URLSearchParams();
      if (currentSong.title) params.append('title', currentSong.title);
      if (currentSong.artist) params.append('artist', currentSong.artist);
      if (isRefresh) params.append('refresh', 'true');

      const res = await fetch(`http://127.0.0.1:3001/api/trivia/${currentSong.videoId}?${params.toString()}`);
      const data = await res.json();
      if (data && data.trivia) {
        triviaCacheRef.current.set(currentSong.videoId, data.trivia);
        setCurrentTrivia(data.trivia);
      } else {
        setCurrentTrivia('No se encontró información curiosa para este tema.');
      }
    } catch (err) {
      console.error('Error cargando curiosidades:', err);
      setCurrentTrivia('No se pudo cargar la curiosidad en este momento.');
    } finally {
      setLoadingTrivia(false);
    }
  }, [currentSong]);

  const handleAnotherTrivia = useCallback(() => {
    handleOpenTrivia(true);
  }, [handleOpenTrivia]);

  const handleAskDJMore = useCallback(() => {
    if (!currentSong) return;
    setIsTriviaOpen(false);
    const askText = `Cuéntame más curiosidades sobre ${currentSong.title} de ${currentSong.artist}.`;
    setMessage(askText);
  }, [currentSong]);

  const handleShareTriviaToChat = useCallback(() => {
    if (!currentTrivia || !currentSong) return;
    setIsTriviaOpen(false);
    setChatHistory(prev => [
      ...prev,
      { 
        sender: 'dj', 
        text: `✨ Curiosidad sobre "${currentSong.title}" (${currentSong.artist}):\n${currentTrivia}` 
      }
    ]);
  }, [currentTrivia, currentSong]);

  const handleNewSession = useCallback(async () => {
    const confirmed = await showConfirm({
      title: "Comenzar Nueva Sesión",
      message: "¿Deseas comenzar una nueva sesión de radio?\nLa sesión actual quedará guardada de forma segura en la base de datos.",
      confirmText: "Comenzar nueva",
      cancelText: "Cancelar",
      type: "warning"
    });
    if (!confirmed) return;

    try {
      const nowStr = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      const res = await fetch('http://127.0.0.1:3001/api/session/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Sesión de Radio (${nowStr})` })
      });
      const data = await res.json();
      if (data && data.new_session_id) {
        setSessionId(data.new_session_id);
        localStorage.setItem('dj_session_id', data.new_session_id);
        if (data.name) setSessionName(data.name);
      }
    } catch (e) {
      const localNewId = `session_${Date.now()}`;
      setSessionId(localNewId);
      localStorage.setItem('dj_session_id', localNewId);
    }

    setCurrentSong(null);
    currentSongRef.current = null;
    setQueue([]);
    setHistory([]);
    setChatHistory([
      { sender: 'dj', text: '¡Qué onda mucha! Comenzamos una nueva sesión en Gemini Radio. ¿Qué te pongo hoy?' }
    ]);
    localStorage.removeItem('dj_session_backup');
    if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
      playerRef.current.stopVideo();
    }
    setSessionStatus('saved');
    fetchSessions();
  }, [fetchSessions]);

  const handleSwitchSession = useCallback(async (targetId) => {
    if (!targetId || targetId === sessionId) return;

    // Guardar sesión actual antes de cambiar si tiene contenido
    if (currentSong || queue.length > 0 || history.length > 0 || chatHistory.length > 1) {
      try {
        await fetch('http://127.0.0.1:3001/api/session/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sessionId,
            name: sessionName,
            current_song: currentSong,
            queue,
            history,
            chat_history: chatHistory,
            settings: { frequency, personality, crossfade }
          })
        });
      } catch (e) {
        console.warn("Error guardando sesión previa al cambiar:", e);
      }
    }

    try {
      setSessionStatus('saving');
      const res = await fetch('http://127.0.0.1:3001/api/session/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetId })
      });
      const data = await res.json();

      if (data && data.success && data.session) {
        const s = data.session;
        setSessionId(s.id);
        localStorage.setItem('dj_session_id', s.id);
        setSessionName(s.name || 'Sesión de Radio');
        
        setCurrentSong(s.current_song || null);
        currentSongRef.current = s.current_song || null;
        setQueue(Array.isArray(s.queue) ? s.queue : []);
        setHistory(Array.isArray(s.history) ? s.history : []);
        setChatHistory(Array.isArray(s.chat_history) && s.chat_history.length > 0 ? s.chat_history : [
          { sender: 'dj', text: `¡Qué onda! Sintonizando "${s.name}". ¿Qué rolita te gustaría escuchar aquí?` }
        ]);

        if (s.settings) {
          if (s.settings.frequency !== undefined) setFrequency(s.settings.frequency);
          if (s.settings.personality) setPersonality(s.settings.personality);
          if (s.settings.crossfade !== undefined) setCrossfade(s.settings.crossfade);
        }

        setSessionStatus('restored');
        setIsSessionsOpen(false);
        fetchSessions();
      }
    } catch (err) {
      console.error("Error al conmutar sesión:", err);
      setSessionStatus('error');
    }
  }, [sessionId, sessionName, currentSong, queue, history, chatHistory, frequency, personality, crossfade, fetchSessions]);

  const handleCreateSession = useCallback(async (customName) => {
    const name = (customName || '').trim() || 'Nueva Estación';

    // Guardar sesión actual antes de crear
    if (currentSong || queue.length > 0 || history.length > 0) {
      try {
        await fetch('http://127.0.0.1:3001/api/session/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sessionId,
            name: sessionName,
            current_song: currentSong,
            queue,
            history,
            chat_history: chatHistory,
            settings: { frequency, personality, crossfade }
          })
        });
      } catch (e) {}
    }

    try {
      setSessionStatus('saving');
      const res = await fetch('http://127.0.0.1:3001/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();

      if (data && data.success && data.session) {
        const s = data.session;
        setSessionId(s.id);
        localStorage.setItem('dj_session_id', s.id);
        setSessionName(s.name);
        setCurrentSong(null);
        currentSongRef.current = null;
        setQueue([]);
        setHistory([]);
        setChatHistory(s.chat_history || [
          { sender: 'dj', text: `¡Qué onda! Esta es tu estación '${s.name}'. ¿Qué rola ponemos para estrenarla?` }
        ]);
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
          playerRef.current.stopVideo();
        }
        setSessionStatus('saved');
        setIsSessionsOpen(false);
        fetchSessions();
      }
    } catch (err) {
      console.error("Error creando nueva sesión:", err);
      setSessionStatus('error');
    }
  }, [sessionId, sessionName, currentSong, queue, history, chatHistory, frequency, personality, crossfade, fetchSessions]);

  const handleRenameSession = useCallback(async (id, newName) => {
    if (!id || !newName.trim()) return;
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/session/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      const data = await res.json();
      if (data && data.success) {
        if (id === sessionId) {
          setSessionName(newName.trim());
        }
        fetchSessions();
      }
    } catch (err) {
      console.error("Error renombrando sesión:", err);
    }
  }, [sessionId, fetchSessions]);

  const handleDeleteSession = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/session/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data && data.success) {
        if (data.was_active && data.active_session) {
          const s = data.active_session;
          setSessionId(s.id);
          localStorage.setItem('dj_session_id', s.id);
          setSessionName(s.name);
          setCurrentSong(s.current_song || null);
          currentSongRef.current = s.current_song || null;
          setQueue(s.queue || []);
          setHistory(s.history || []);
          setChatHistory(s.chat_history || []);
        }
        fetchSessions();
      }
    } catch (err) {
      console.error("Error eliminando sesión:", err);
    }
  }, [fetchSessions]);

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
    handleLike,
    handleDislike,
    chatEndRef,
    frequency,
    setFrequency,
    personality,
    setPersonality,
    crossfade,
    setCrossfade,
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
    sessionName,
    sessionStatus,
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
    playerRef
  };
}
