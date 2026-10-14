import React, { useEffect, useState, useRef } from 'react';
import { X, Mic2, Loader2, Sparkles, Languages } from 'lucide-react';

export default function LyricsSidebar({ isOpen, onClose, currentSong, playerRef }) {
  const [syncedLines, setSyncedLines] = useState([]);
  const [plainLines, setPlainLines] = useState([]);
  const [source, setSource] = useState(null);
  const [isSynced, setIsSynced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Offset manual de sincronización en segundos (ej: -0.5s, +0.2s)
  const [syncOffset, setSyncOffset] = useState(0);

  // Modo: 'bilingual' (Original + Español), 'original', 'translation' (Solo Español)
  const [displayMode, setDisplayMode] = useState(() => {
    return localStorage.getItem('lyrics_display_mode') || 'bilingual';
  });

  const listRef = useRef(null);
  const activeLineRef = useRef(null);
  const activeIdxRef = useRef(-1);
  const syncOffsetRef = useRef(0);

  useEffect(() => {
    activeIdxRef.current = activeIdx;
  }, [activeIdx]);

  useEffect(() => {
    syncOffsetRef.current = syncOffset;
  }, [syncOffset]);

  // Cargar offset guardado específico para la canción actual
  useEffect(() => {
    if (!currentSong?.videoId) {
      setSyncOffset(0);
      return;
    }
    const saved = localStorage.getItem(`lyrics_offset_${currentSong.videoId}`);
    setSyncOffset(saved ? parseFloat(saved) : 0);
  }, [currentSong?.videoId]);

  const handleAdjustOffset = (delta) => {
    setSyncOffset(prev => {
      const next = Math.round((prev + delta) * 10) / 10;
      if (currentSong?.videoId) {
        if (next === 0) {
          localStorage.removeItem(`lyrics_offset_${currentSong.videoId}`);
        } else {
          localStorage.setItem(`lyrics_offset_${currentSong.videoId}`, next.toString());
        }
      }
      return next;
    });
  };

  const handleResetOffset = () => {
    setSyncOffset(0);
    if (currentSong?.videoId) {
      localStorage.removeItem(`lyrics_offset_${currentSong.videoId}`);
    }
  };

  const triggerTranslation = (songVideoId, linesToTranslate, isKaraoke) => {
    if (!songVideoId || isTranslating || linesToTranslate.length === 0) return;
    setIsTranslating(true);
    fetch(`http://127.0.0.1:3001/api/lyrics/${songVideoId}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: linesToTranslate })
    })
      .then(r => r.json())
      .then(transData => {
        if (!Array.isArray(transData.translations) || transData.translations.length === 0) return;
        if (isKaraoke) {
          setSyncedLines(prev =>
            prev.map((item, idx) => ({
              ...item,
              translation: transData.translations[idx] || item.translation
            }))
          );
        } else {
          let tIdx = 0;
          setPlainLines(prev =>
            prev.map(item => {
              if (!item.text?.trim()) return item;
              const trans = transData.translations[tIdx] || null;
              tIdx++;
              return { ...item, translation: trans || item.translation };
            })
          );
        }
      })
      .catch(err => console.warn('Error en traducción secundaria:', err))
      .finally(() => setIsTranslating(false));
  };

  const handleModeChange = (mode) => {
    setDisplayMode(mode);
    localStorage.setItem('lyrics_display_mode', mode);
    if ((mode === 'bilingual' || mode === 'translation') && !hasTranslations && !isTranslating && currentSong?.videoId) {
      if (isSynced && syncedLines.length > 0) {
        triggerTranslation(currentSong.videoId, syncedLines.map(l => l.text), true);
      } else if (plainLines.length > 0) {
        const nonEmpties = plainLines.filter(l => l.text?.trim()).map(l => l.text);
        triggerTranslation(currentSong.videoId, nonEmpties, false);
      }
    }
  };

  // Carga de letras al abrir o al cambiar de canción con duración precisa
  useEffect(() => {
    if (!isOpen || !currentSong?.videoId) return;

    let isMounted = true;
    setLoading(true);
    setIsTranslating(false);
    setSyncedLines([]);
    setPlainLines([]);
    setIsSynced(false);
    setActiveIdx(-1);

    const fetchLyrics = () => {
      let durationSec = null;
      if (playerRef?.current && typeof playerRef.current.getDuration === 'function') {
        const pDur = playerRef.current.getDuration();
        if (pDur && pDur > 0) durationSec = Math.round(pDur);
      }
      if (!durationSec && currentSong.duration_seconds) {
        durationSec = Math.round(currentSong.duration_seconds);
      }

      const params = new URLSearchParams();
      if (currentSong.title) params.append('title', currentSong.title);
      if (currentSong.artist) params.append('artist', currentSong.artist);
      if (durationSec) params.append('duration', durationSec);

      fetch(`http://127.0.0.1:3001/api/lyrics/${currentSong.videoId}?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
          if (!isMounted) return;
          setLoading(false);

          if (data.isSynced && Array.isArray(data.lines) && data.lines.length > 0) {
            setSyncedLines(data.lines);
            setIsSynced(true);
            setSource(data.source || 'Karaoke Sincronizado');

            if (!data.hasTranslation) {
              triggerTranslation(currentSong.videoId, data.lines.map(l => l.text), true);
            }
          } else if (Array.isArray(data.plainLines) && data.plainLines.length > 0) {
            setPlainLines(data.plainLines);
            setIsSynced(false);
            setSource(data.source || 'YouTube Music');

            if (!data.hasTranslation) {
              const nonEmpties = data.plainLines.filter(l => l.text?.trim()).map(l => l.text);
              if (nonEmpties.length > 0) {
                triggerTranslation(currentSong.videoId, nonEmpties, false);
              }
            }
          } else {
            setSyncedLines([]);
            setPlainLines([]);
          }
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Error cargando letras:', err);
          setLoading(false);
        });
    };

    let timer = null;
    const initialDur = playerRef?.current?.getDuration?.();
    if (!initialDur && playerRef?.current) {
      timer = setTimeout(fetchLyrics, 300);
    } else {
      fetchLyrics();
    }

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, currentSong?.videoId, currentSong?.title, currentSong?.artist]);

  // Ticker de sincronización en tiempo real con YouTube Player (Karaoke) cada 100ms
  useEffect(() => {
    if (!isOpen || !isSynced || syncedLines.length === 0) return;

    const interval = setInterval(() => {
      if (!playerRef?.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      try {
        const currentTime = playerRef.current.getCurrentTime();
        if (typeof currentTime !== 'number' || isNaN(currentTime)) return;

        const effectiveTime = currentTime + syncOffsetRef.current;
        let currentIdx = -1;
        for (let i = 0; i < syncedLines.length; i++) {
          if (effectiveTime >= syncedLines[i].time) {
            currentIdx = i;
          } else {
            break;
          }
        }

        if (currentIdx !== activeIdxRef.current) {
          setActiveIdx(currentIdx);
        }
      } catch (e) {}
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isSynced, syncedLines, playerRef]);

  // Auto-scroll suave de la línea activa al centro de la vista
  useEffect(() => {
    if (activeLineRef.current && isSynced) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIdx, isSynced]);

  // Saltar en el reproductor al hacer clic en un verso compensando el offset
  const handleSeek = (time) => {
    if (playerRef?.current && typeof playerRef.current.seekTo === 'function') {
      const targetTime = Math.max(0, time - syncOffsetRef.current);
      playerRef.current.seekTo(targetTime, true);
    }
  };

  const hasTranslations = syncedLines.some(l => l.translation) || plainLines.some(l => l.translation);

  return (
    <aside className={`lyrics-sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <Mic2 size={20} className="accent-icon" />
          <div className="sidebar-title-info">
            <div className="title-with-badge">
              <h3>Letras</h3>
              {isSynced && (
                <span className="karaoke-badge">
                  <Sparkles size={12} />
                  <span>Karaoke</span>
                </span>
              )}
            </div>
            <p className="sidebar-subtitle" title={currentSong ? `${currentSong.title} — ${currentSong.artist}` : ''}>
              {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'Esperando pista...'}
            </p>
          </div>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} title="Cerrar panel de letras">
          <X size={18} />
        </button>
      </div>

      {/* Selector de idioma / traducción permanente */}
      {(syncedLines.length > 0 || plainLines.length > 0) && (
        <div className="lyrics-lang-bar">
          <div className="lang-bar-label">
            <Languages size={14} />
            <span>{isTranslating ? 'Traduciendo...' : 'Modo:'}</span>
            {isTranslating && <Loader2 size={12} className="spinner" />}
          </div>
          <div className="lang-pill-selector">
            <button
              type="button"
              className={`lang-pill ${displayMode === 'bilingual' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleModeChange('bilingual');
              }}
              title="Mostrar texto original y traducción al español debajo"
            >
              Bilingüe
            </button>
            <button
              type="button"
              className={`lang-pill ${displayMode === 'translation' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleModeChange('translation');
              }}
              title="Mostrar solo la letra en español"
            >
              Español
            </button>
            <button
              type="button"
              className={`lang-pill ${displayMode === 'original' ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleModeChange('original');
              }}
              title="Mostrar solo el idioma original (inglés)"
            >
              Original (Inglés)
            </button>
          </div>
        </div>
      )}

      {/* Barra de calibración de sincronización Karaoke */}
      {isSynced && syncedLines.length > 0 && (
        <div className="lyrics-sync-bar">
          <div className="sync-bar-label">
            <span>Sincronización:</span>
            <span className={`sync-offset-val ${syncOffset !== 0 ? 'modified' : ''}`}>
              {syncOffset > 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
            </span>
          </div>
          <div className="sync-buttons">
            <button
              type="button"
              className="sync-step-btn"
              onClick={() => handleAdjustOffset(-0.5)}
              title="Atrasar letra 0.5s"
            >
              -0.5s
            </button>
            <button
              type="button"
              className="sync-step-btn"
              onClick={() => handleAdjustOffset(-0.2)}
              title="Atrasar letra 0.2s"
            >
              -0.2s
            </button>
            {syncOffset !== 0 && (
              <button
                type="button"
                className="sync-step-btn reset"
                onClick={handleResetOffset}
                title="Restablecer sincronización a 0.0s"
              >
                0.0s
              </button>
            )}
            <button
              type="button"
              className="sync-step-btn"
              onClick={() => handleAdjustOffset(0.2)}
              title="Adelantar letra 0.2s"
            >
              +0.2s
            </button>
            <button
              type="button"
              className="sync-step-btn"
              onClick={() => handleAdjustOffset(0.5)}
              title="Adelantar letra 0.5s"
            >
              +0.5s
            </button>
          </div>
        </div>
      )}

      <div className="sidebar-content" ref={listRef}>
        {loading ? (
          <div className="sidebar-loading">
            <Loader2 size={32} className="spinner" />
            <p>Cargando karaoke...</p>
          </div>
        ) : isSynced && syncedLines.length > 0 ? (
          <div className="karaoke-container">
            {syncedLines.map((line, idx) => {
              const isActive = idx === activeIdx;
              const isPast = idx < activeIdx;
              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : null}
                  className={`karaoke-verse-group ${isActive ? 'active' : isPast ? 'past' : 'upcoming'}`}
                  onClick={() => handleSeek(line.time)}
                  title="Haz clic para saltar a este verso"
                >
                  {(displayMode === 'bilingual' || displayMode === 'original' || !line.translation) && (
                    <p className="karaoke-line-orig">{line.text}</p>
                  )}
                  {(displayMode === 'bilingual' || displayMode === 'translation') && line.translation && (
                    <p className="karaoke-line-trans">{line.translation}</p>
                  )}
                </div>
              );
            })}
            {source && <div className="sidebar-source">Fuente: {source}</div>}
          </div>
        ) : plainLines.length > 0 ? (
          <div className="plain-lyrics-container">
            {plainLines.map((line, idx) => {
              if (!line.text?.trim() && !line.translation?.trim()) {
                return <div key={idx} className="lyrics-spacer" />;
              }
              return (
                <div key={idx} className="plain-verse-group">
                  {(displayMode === 'bilingual' || displayMode === 'original' || !line.translation) && (
                    <p className="plain-line-orig">{line.text}</p>
                  )}
                  {(displayMode === 'bilingual' || displayMode === 'translation') && line.translation && (
                    <p className="plain-line-trans">{line.translation}</p>
                  )}
                </div>
              );
            })}
            {source && <div className="sidebar-source">Fuente: {source}</div>}
          </div>
        ) : (
          <div className="sidebar-empty">
            <Mic2 size={38} className="text-dim" />
            <p>No se encontraron letras para esta canción.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
