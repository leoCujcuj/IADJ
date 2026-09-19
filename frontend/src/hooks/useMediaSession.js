import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook modular para integracion permanente con Windows SMTC (System Media Transport Controls)
 * y ancla de audio silencioso en navegadores basados en Chromium (Chrome, Edge, Opera, Opera GX).
 */
export default function useMediaSession({
  currentSong,
  playerRef,
  isPlaying,
  setIsPlaying,
  handleNextRef,
  handlePreviousRef,
  handleNext,
  handlePrevious
}) {
  const anchorAudioRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Inicializacion de portadora continua Web Audio (fuerza a Opera y Chromium a mantener activo WASAPI SMTC)
  const startAudioCarrier = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(25, ctx.currentTime);
          gain.gain.setValueAtTime(0.001, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          audioCtxRef.current = ctx;
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch (e) {}
  }, []);

  // Gestor del elemento de audio para mantener foco de Windows SMTC en Chromium / Opera
  const ensureMediaAnchor = useCallback(() => {
    try {
      startAudioCarrier();

      if (!anchorAudioRef.current) {
        let el = document.getElementById('media-session-anchor');
        if (!el) {
          el = document.createElement('audio');
          el.id = 'media-session-anchor';
          el.src = '/silence.wav';
          el.loop = true;
          el.preload = 'auto';
          document.body.appendChild(el);
        }
        el.volume = 1.0;
        anchorAudioRef.current = el;
      }

      if (anchorAudioRef.current && anchorAudioRef.current.paused) {
        const p = anchorAudioRef.current.play();
        if (p !== undefined) {
          p.catch(() => {});
        }
      }
    } catch (e) {}
  }, [startAudioCarrier]);

  const pauseMediaAnchor = useCallback(() => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        audioCtxRef.current.suspend().catch(() => {});
      }
      if (anchorAudioRef.current && !anchorAudioRef.current.paused) {
        anchorAudioRef.current.pause();
      }
    } catch (e) {}
  }, []);

  // Desbloqueo de audio anchor ante cualquier interaccion del usuario
  useEffect(() => {
    const handleUserInteraction = () => {
      ensureMediaAnchor();
    };

    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, [ensureMediaAnchor]);

  // Teclas multimedia y atajos de teclado en ventana
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (e.key === 'MediaTrackNext' || (e.ctrlKey && e.key === 'ArrowRight')) {
        if (handleNext) handleNext();
      }
      if (e.key === 'MediaTrackPrevious' || (e.ctrlKey && e.key === 'ArrowLeft')) {
        if (handlePrevious) handlePrevious();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleNext, handlePrevious]);

  // Sincronizacion dinamica de playbackState con el estado de reproduccion real
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {}
  }, [isPlaying]);

  // Configuracion permanente de MediaSession para controles multimedia del sistema (Windows SMTC)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlers = {
      play: () => {
        ensureMediaAnchor();
        if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
        }
        if (setIsPlaying) setIsPlaying(true);
        try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
      },
      pause: () => {
        pauseMediaAnchor();
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
        if (setIsPlaying) setIsPlaying(false);
        try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
      },
      nexttrack: () => {
        console.log("[Windows SMTC]: Siguiente cancion solicitada desde controles del sistema");
        if (handleNextRef && handleNextRef.current) {
          handleNextRef.current();
        }
      },
      previoustrack: () => {
        console.log("[Windows SMTC]: Cancion anterior solicitada desde controles del sistema");
        if (handlePreviousRef && handlePreviousRef.current) {
          handlePreviousRef.current();
        }
      },
      stop: () => {
        pauseMediaAnchor();
        if (playerRef.current && typeof playerRef.current.stopVideo === 'function') {
          playerRef.current.stopVideo();
        }
        if (setIsPlaying) setIsPlaying(false);
        try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
      },
      seekto: (details) => {
        if (details?.seekTime !== undefined && playerRef.current && typeof playerRef.current.seekTo === 'function') {
          playerRef.current.seekTo(details.seekTime, true);
        }
      },
      seekbackward: (details) => {
        const offset = details?.seekOffset || 10;
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const current = playerRef.current.getCurrentTime() || 0;
          playerRef.current.seekTo(Math.max(0, current - offset), true);
        }
      },
      seekforward: (details) => {
        const offset = details?.seekOffset || 10;
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          const current = playerRef.current.getCurrentTime() || 0;
          playerRef.current.seekTo(current + offset, true);
        }
      }
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (e) {}
    }
  }, [ensureMediaAnchor, pauseMediaAnchor, playerRef, setIsPlaying, handleNextRef, handlePreviousRef]);

  // Metadatos para el control multimedia del sistema al cambiar de cancion
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong?.title) return;

    try {
      const artworkUrls = [];
      if (currentSong.videoId) {
        artworkUrls.push(
          { src: `https://img.youtube.com/vi/${currentSong.videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' },
          { src: `https://img.youtube.com/vi/${currentSong.videoId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist || 'Gemini Radio',
        album: 'Gemini Radio',
        artwork: artworkUrls
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      ensureMediaAnchor();
    } catch (err) {
      console.warn("Error configurando MediaMetadata:", err);
    }
  }, [currentSong, isPlaying, ensureMediaAnchor]);

  return {
    ensureMediaAnchor,
    pauseMediaAnchor,
    anchorAudioRef
  };
}
