import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook modular para gestion de sesiones persistentes de radio (PostgreSQL + LocalStorage).
 * Soporta creacion, cambio en caliente, renombrado, reseteo, borrado y autoguardado de estaciones.
 */
export default function useRadioSessions({
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
  playerRef,
  settings,
  settingsSetters
}) {
  const [sessionId, setSessionId] = useState(() => {
    return localStorage.getItem('dj_session_id') || 'session_default';
  });
  const [sessionName, setSessionName] = useState(() => {
    return localStorage.getItem('dj_session_name') || 'Sesión Principal';
  });
  const [sessionStatus, setSessionStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'restored' | 'error'
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const isRestoringSessionRef = useRef(true);
  const hasRestoredSuccessfullyRef = useRef(false);
  const saveTimeoutRef = useRef(null);

  const settingsSettersRef = useRef(settingsSetters);
  settingsSettersRef.current = settingsSetters;

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

  // Restauracion inicial de sesion desde PostgreSQL (o localStorage como respaldo). Corre estrictamente una sola vez al montar.
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
          if (s.name) {
            setSessionName(s.name);
            localStorage.setItem('dj_session_name', s.name);
          }
          if (s.current_song && s.current_song.videoId) {
            if (setCurrentSong) setCurrentSong(s.current_song);
            if (currentSongRef) currentSongRef.current = s.current_song;
          }
          if (Array.isArray(s.queue) && s.queue.length > 0 && setQueue) {
            setQueue(s.queue);
          }
          if (Array.isArray(s.history) && setHistory) {
            setHistory(s.history);
            if (playedHistoryRef) playedHistoryRef.current = [...s.history].reverse();
          }
          if (Array.isArray(s.chat_history) && s.chat_history.length > 0 && setChatHistory) {
            setChatHistory(s.chat_history);
          }
          const currentSetters = settingsSettersRef.current;
          if (s.settings && currentSetters) {
            if (s.settings.frequency !== undefined && currentSetters.setFrequency) currentSetters.setFrequency(s.settings.frequency);
            if (s.settings.personality && currentSetters.setPersonality) currentSetters.setPersonality(s.settings.personality);
            if (s.settings.crossfade !== undefined && currentSetters.setCrossfade) currentSetters.setCrossfade(s.settings.crossfade);
            if (s.settings.autoPauseOnTabChange !== undefined && currentSetters.setAutoPauseOnTabChange) currentSetters.setAutoPauseOnTabChange(s.settings.autoPauseOnTabChange);
            if (s.settings.duckingVolume !== undefined && currentSetters.setDuckingVolume) currentSetters.setDuckingVolume(s.settings.duckingVolume);
          }
          hasRestoredSuccessfullyRef.current = true;
          setSessionStatus('restored');
          console.log('[SESION] Sesion inicial restaurada con exito desde la Base de Datos.');
        } else {
          const backup = localStorage.getItem('dj_session_backup');
          if (backup) {
            try {
              const parsed = JSON.parse(backup);
              if (parsed.sessionName) {
                setSessionName(parsed.sessionName);
                localStorage.setItem('dj_session_name', parsed.sessionName);
              }
              if (parsed.sessionId) {
                setSessionId(parsed.sessionId);
                localStorage.setItem('dj_session_id', parsed.sessionId);
              }
              if (parsed.currentSong && setCurrentSong) setCurrentSong(parsed.currentSong);
              if (parsed.queue && setQueue) setQueue(parsed.queue);
              if (Array.isArray(parsed.history) && setHistory) {
                setHistory(parsed.history);
                if (playedHistoryRef) playedHistoryRef.current = [...parsed.history].reverse();
              }
              if (parsed.chatHistory && setChatHistory) setChatHistory(parsed.chatHistory);
              hasRestoredSuccessfullyRef.current = true;
              console.log('[SESION] Sesion restaurada desde copia local de respaldo.');
            } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('No se pudo conectar con el servidor para restaurar sesion, recurriendo a cache local:', err);
        const backup = localStorage.getItem('dj_session_backup');
        if (backup) {
          try {
            const parsed = JSON.parse(backup);
            if (parsed.sessionName) {
              setSessionName(parsed.sessionName);
              localStorage.setItem('dj_session_name', parsed.sessionName);
            }
            if (parsed.sessionId) {
              setSessionId(parsed.sessionId);
              localStorage.setItem('dj_session_id', parsed.sessionId);
            }
            if (parsed.currentSong && setCurrentSong) setCurrentSong(parsed.currentSong);
            if (parsed.queue && setQueue) setQueue(parsed.queue);
            if (Array.isArray(parsed.history) && setHistory) {
              setHistory(parsed.history);
              if (playedHistoryRef) playedHistoryRef.current = [...parsed.history].reverse();
            }
            if (parsed.chatHistory && setChatHistory) setChatHistory(parsed.chatHistory);
            hasRestoredSuccessfullyRef.current = true;
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
  }, []);

  // Recargar sesiones al abrir el panel lateral
  useEffect(() => {
    if (isSessionsOpen) {
      fetchSessions();
    }
  }, [isSessionsOpen, fetchSessions]);

  // Autoguardado con debounce (1.5 segundos) hacia PostgreSQL y localStorage
  useEffect(() => {
    if (isRestoringSessionRef.current || !hasRestoredSuccessfullyRef.current) return;
    if (!currentSong && (!queue || queue.length === 0) && (!history || history.length === 0) && (!chatHistory || chatHistory.length <= 1)) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    setSessionStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      const payload = {
        id: sessionId,
        name: sessionName,
        current_song: currentSong,
        queue: queue || [],
        history: history || [],
        chat_history: chatHistory || [],
        settings: settings || {}
      };

      try {
        localStorage.setItem('dj_session_name', sessionName);
        localStorage.setItem('dj_session_backup', JSON.stringify({
          sessionId,
          sessionName,
          currentSong,
          queue,
          history,
          chatHistory
        }));
      } catch (e) {}

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
        console.warn('Error en autoguardado de sesion en BD:', err);
        setSessionStatus('error');
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [currentSong, queue, history, chatHistory, settings, sessionId, sessionName]);

  const handleNewSession = useCallback(async () => {
    if (showConfirm) {
      const confirmed = await showConfirm({
        title: "Comenzar Nueva Sesión",
        message: "¿Deseas comenzar una nueva sesión de radio?\nLa sesión actual quedará guardada de forma segura en la base de datos.",
        confirmText: "Comenzar nueva",
        cancelText: "Cancelar",
        type: "warning"
      });
      if (!confirmed) return;
    }

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
        if (data.name) {
          setSessionName(data.name);
          localStorage.setItem('dj_session_name', data.name);
        }
      }
    } catch (e) {
      const localNewId = `session_${Date.now()}`;
      setSessionId(localNewId);
      localStorage.setItem('dj_session_id', localNewId);
    }

    if (setCurrentSong) setCurrentSong(null);
    if (currentSongRef) currentSongRef.current = null;
    if (setQueue) setQueue([]);
    if (setHistory) setHistory([]);
    if (playedHistoryRef) playedHistoryRef.current = [];
    if (setChatHistory) {
      setChatHistory([
        { sender: 'dj', text: '¡Qué onda mucha! Comenzamos una nueva sesión en Gemini Radio. ¿Qué te pongo hoy?' }
      ]);
    }
    localStorage.removeItem('dj_session_backup');
    if (playerRef?.current && typeof playerRef.current.stopVideo === 'function') {
      playerRef.current.stopVideo();
    }
    setSessionStatus('saved');
    fetchSessions();
  }, [showConfirm, setCurrentSong, currentSongRef, setQueue, setHistory, playedHistoryRef, setChatHistory, playerRef, fetchSessions]);

  const handleSwitchSession = useCallback(async (targetId) => {
    if (!targetId || targetId === sessionId) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    isRestoringSessionRef.current = true;

    if (currentSong || (queue && queue.length > 0) || (history && history.length > 0) || (chatHistory && chatHistory.length > 1)) {
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
            settings
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
        const loadedName = s.name || 'Sesión de Radio';
        setSessionName(loadedName);
        localStorage.setItem('dj_session_name', loadedName);
        
        if (setCurrentSong) setCurrentSong(s.current_song || null);
        if (currentSongRef) currentSongRef.current = s.current_song || null;
        if (s.current_song?.videoId && playerRef?.current && typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.loadVideoById(s.current_song.videoId);
        } else if (!s.current_song?.videoId && playerRef?.current && typeof playerRef.current.stopVideo === 'function') {
          playerRef.current.stopVideo();
        }
        if (setQueue) setQueue(Array.isArray(s.queue) ? s.queue : []);
        if (setHistory) setHistory(Array.isArray(s.history) ? s.history : []);
        if (playedHistoryRef) playedHistoryRef.current = Array.isArray(s.history) ? [...s.history].reverse() : [];
        if (setChatHistory) {
          setChatHistory(Array.isArray(s.chat_history) && s.chat_history.length > 0 ? s.chat_history : [
            { sender: 'dj', text: `¡Qué onda! Sintonizando "${loadedName}". ¿Qué rolita te gustaría escuchar aquí?` }
          ]);
        }

        if (s.settings && settingsSetters) {
          if (s.settings.frequency !== undefined && settingsSetters.setFrequency) settingsSetters.setFrequency(s.settings.frequency);
          if (s.settings.personality && settingsSetters.setPersonality) settingsSetters.setPersonality(s.settings.personality);
          if (s.settings.crossfade !== undefined && settingsSetters.setCrossfade) settingsSetters.setCrossfade(s.settings.crossfade);
          if (s.settings.autoPauseOnTabChange !== undefined && settingsSetters.setAutoPauseOnTabChange) settingsSetters.setAutoPauseOnTabChange(s.settings.autoPauseOnTabChange);
          if (s.settings.duckingVolume !== undefined && settingsSetters.setDuckingVolume) settingsSetters.setDuckingVolume(s.settings.duckingVolume);
        }

        setSessionStatus('restored');
        setIsSessionsOpen(false);
        fetchSessions();
      }
    } catch (err) {
      console.error("Error al conmutar sesión:", err);
      setSessionStatus('error');
    } finally {
      setTimeout(() => {
        isRestoringSessionRef.current = false;
      }, 1200);
    }
  }, [sessionId, sessionName, currentSong, queue, history, chatHistory, settings, settingsSetters, playerRef, setCurrentSong, currentSongRef, setQueue, setHistory, playedHistoryRef, setChatHistory, fetchSessions]);

  const handleCreateSession = useCallback(async (customName) => {
    const name = (customName || '').trim() || 'Nueva Estación';

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    isRestoringSessionRef.current = true;

    if (currentSong || (queue && queue.length > 0) || (history && history.length > 0)) {
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
            settings
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
        localStorage.setItem('dj_session_name', s.name);
        if (setCurrentSong) setCurrentSong(null);
        if (currentSongRef) currentSongRef.current = null;
        if (setQueue) setQueue([]);
        if (setHistory) setHistory([]);
        if (setChatHistory) {
          setChatHistory(s.chat_history || [
            { sender: 'dj', text: `¡Qué onda! Esta es tu estación '${s.name}'. ¿Qué rola ponemos para estrenarla?` }
          ]);
        }
        if (playerRef?.current && typeof playerRef.current.stopVideo === 'function') {
          playerRef.current.stopVideo();
        }
        setSessionStatus('saved');
        setIsSessionsOpen(false);
        fetchSessions();
      }
    } catch (err) {
      console.error("Error creando nueva sesión:", err);
      setSessionStatus('error');
    } finally {
      setTimeout(() => {
        isRestoringSessionRef.current = false;
      }, 1200);
    }
  }, [sessionId, sessionName, currentSong, queue, history, chatHistory, settings, playerRef, setCurrentSong, currentSongRef, setQueue, setHistory, setChatHistory, fetchSessions]);

  const handleRenameSession = useCallback(async (id, newName) => {
    const trimmed = (newName || '').trim();
    if (!id || !trimmed) return;
    try {
      const res = await fetch(`http://127.0.0.1:3001/api/session/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (data && data.success) {
        if (id === sessionId) {
          setSessionName(trimmed);
          localStorage.setItem('dj_session_name', trimmed);
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
          localStorage.setItem('dj_session_name', s.name);
          if (setCurrentSong) setCurrentSong(s.current_song || null);
          if (currentSongRef) currentSongRef.current = s.current_song || null;
          if (setQueue) setQueue(s.queue || []);
          if (setHistory) setHistory(s.history || []);
          if (playedHistoryRef) playedHistoryRef.current = Array.isArray(s.history) ? [...s.history].reverse() : [];
          if (setChatHistory) setChatHistory(s.chat_history || []);
        }
        fetchSessions();
      }
    } catch (err) {
      console.error("Error eliminando sesión:", err);
    }
  }, [fetchSessions, setCurrentSong, currentSongRef, setQueue, setHistory, playedHistoryRef, setChatHistory]);

  return {
    sessionId,
    setSessionId,
    sessionName,
    setSessionName,
    sessionStatus,
    setSessionStatus,
    isSessionsOpen,
    setIsSessionsOpen,
    sessionsList,
    setSessionsList,
    isRestoringSessionRef,
    saveTimeoutRef,
    fetchSessions,
    handleNewSession,
    handleSwitchSession,
    handleCreateSession,
    handleRenameSession,
    handleDeleteSession
  };
}
