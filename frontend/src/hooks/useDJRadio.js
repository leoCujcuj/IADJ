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

  const playerRef = useRef(null);
  const chatEndRef = useRef(null);   
  const audioPlayerRef = useRef(new Audio());
  const recognitionRef = useRef(null);

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
      speakBrowser(text); 
      return; 
    }
    if (playerRef.current && playerRef.current.setVolume) {
      playerRef.current.setVolume(20);
    }
    audioPlayerRef.current.src = `http://127.0.0.1:3001${audioUrl}`;
    audioPlayerRef.current.play().catch(() => speakBrowser(text));
    audioPlayerRef.current.onended = () => {
      if (playerRef.current && playerRef.current.setVolume) {
        playerRef.current.setVolume(100);
      }
    };
  }, [speakBrowser]);

  // --- Actions ---
  const handleSendMessage = useCallback(async (e, directText = null) => {
    if (e) e.preventDefault();
    const textToSend = directText || message.trim();
    if (!textToSend) return;
    
    setMessage(''); 
    setLoading(true);
    setChatHistory(prev => [...prev, { sender: 'user', text: textToSend }]);
    
    try {
      const response = await fetch('http://127.0.0.1:3001/api/chat', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, currentSong, searchType })
      });
      const data = await response.json();
      if (data.dj_comment) {
        setChatHistory(prev => [...prev, { sender: 'dj', text: data.dj_comment }]);
        playDJVoice(data.audioUrl, data.dj_comment);
      }
      if (data.nextSong?.videoId) {
        setCurrentSong(data.nextSong);
        syncStatus();
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  }, [message, currentSong, searchType, playDJVoice, syncStatus]);

  const handleNext = useCallback(() => {
    handleSendMessage(null, "Siguiente canción DJ.");
  }, [handleSendMessage]);

  const handlePrevious = useCallback(() => {
    handleSendMessage(null, "DJ, pon la canción anterior.");
  }, [handleSendMessage]);

  const handleAddManual = useCallback(async (e) => {
    if (e) e.preventDefault();
    const trimmed = manualSearch.trim();
    if (!trimmed) return;
    
    const isYoutubeLink = trimmed.includes('youtube.com') || trimmed.includes('youtu.be');
    if (!isYoutubeLink) {
      alert("Solo se permiten links directos de YouTube.");
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
    try {
      await fetch(`http://127.0.0.1:8000/queue/move/${videoId}?to_index=${toIndex}`, { method: 'POST' });
      syncStatus();
    } catch (e) { 
      console.error(e); 
    }
  }, [syncStatus]);

  const handleRemoveFromQueue = useCallback(async (videoId) => {
    try {
      await fetch(`http://127.0.0.1:8000/queue/remove/${videoId}`, { method: 'POST' });
      syncStatus();
    } catch (e) { 
      console.error(e); 
    }
  }, [syncStatus]);

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
    try {
      await fetch(`http://127.0.0.1:8000/dislike/${currentSong.videoId}?artist=${encodeURIComponent(currentSong.artist)}`, { 
        method: 'POST' 
      });
      if (newStreak >= 3) {
        handleSendMessage(null, "He dado dislike a varias canciones seguidas. DJ, cambia totalmente de estilo y pregúntame qué quiero escuchar ahora mismo.");
        setDislikeStreak(0);
      } else {
        setTimeout(() => handleSendMessage(null, "He dado dislike. Ponme algo de mi historial o favoritos ahora mismo."), 300);
      }
    } catch (e) { 
      setIsDisliked(false); 
      console.error(e); 
    }
  }, [currentSong, isDisliked, dislikeStreak, handleSendMessage]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // --- Effects ---

  // Periódico de sincronización de estado
  useEffect(() => {
    syncStatus();
    const interval = setInterval(syncStatus, 5000);
    return () => clearInterval(interval);
  }, [syncStatus]);

  // Inicialización de reconocimiento de voz
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setMessage(prev => (prev ? prev + ' ' : '') + finalTranscript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error("Error de reconocimiento:", event.error);
        if (event.error === 'not-allowed') {
          alert("Permiso de micrófono denegado. Por favor, actívalo en tu navegador.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        if (recognitionRef.current && isListening) {
           setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isListening]);

  // Inyección de YouTube Iframe API Script
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  }, []);

  // Inicialización del Reproductor de YouTube
  useEffect(() => {
    if (!currentSong?.videoId) return;
    setIsLiked(false);
    setIsDisliked(false);
    
    const initPlayer = () => {
      if (!playerRef.current) {
        playerRef.current = new window.YT.Player('youtube-player', {
          height: '100%', 
          width: '100%', 
          videoId: currentSong.videoId,
          playerVars: { 'autoplay': 1, 'origin': window.location.origin },
          events: { 'onStateChange': (e) => e.data === 0 && handleNext() }
        });
      } else { 
        playerRef.current.loadVideoById(currentSong.videoId); 
      }
    };
    
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else { 
      setTimeout(initPlayer, 1000); 
    }
  }, [currentSong?.videoId, handleNext]);

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
    chatEndRef
  };
}
