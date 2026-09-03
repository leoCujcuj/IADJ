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

  // Modo: 'bilingual' (Original + Español), 'original', 'translation' (Solo Español)
  const [displayMode, setDisplayMode] = useState(() => {
    return localStorage.getItem('lyrics_display_mode') || 'bilingual';
  });

  const listRef = useRef(null);
  const activeLineRef = useRef(null);

  const handleModeChange = (mode) => {
    setDisplayMode(mode);
    localStorage.setItem('lyrics_display_mode', mode);
  };

  // Carga ultra-rápida (<200ms) de letras al abrir o al cambiar de canción
  useEffect(() => {
    if (!isOpen || !currentSong?.videoId) return;

    let isMounted = true;
    setLoading(true);
    setIsTranslating(false);
    setSyncedLines([]);
    setPlainLines([]);
    setIsSynced(false);
    setActiveIdx(-1);

    const params = new URLSearchParams();
    if (currentSong.title) params.append('title', currentSong.title);
    if (currentSong.artist) params.append('artist', currentSong.artist);

    fetch(`http://127.0.0.1:3001/api/lyrics/${currentSong.videoId}?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        setLoading(false);

        if (data.isSynced && Array.isArray(data.lines) && data.lines.length > 0) {
          setSyncedLines(data.lines);
          setIsSynced(true);
          setSource(data.source || 'Karaoke Sincronizado');

          // Si no tiene traducción aún, pedirla en segundo plano sin bloquear el karaoke
          if (!data.hasTranslation) {
            setIsTranslating(true);
            fetch(`http://127.0.0.1:3001/api/lyrics/${currentSong.videoId}/translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lines: data.lines.map(l => l.text) })
            })
              .then(r => r.json())
              .then(transData => {
                if (!isMounted || !Array.isArray(transData.translations)) return;
                setSyncedLines(prev =>
                  prev.map((item, idx) => ({
                    ...item,
                    translation: transData.translations[idx] || item.translation
                  }))
                );
              })
              .catch(err => console.warn('Error en traducción secundaria:', err))
              .finally(() => {
                if (isMounted) setIsTranslating(false);
              });
          }
        } else if (Array.isArray(data.plainLines) && data.plainLines.length > 0) {
          setPlainLines(data.plainLines);
          setIsSynced(false);
          setSource(data.source || 'YouTube Music');

          if (!data.hasTranslation) {
            const nonEmpties = data.plainLines.filter(l => l.text?.trim()).map(l => l.text);
            if (nonEmpties.length > 0) {
              setIsTranslating(true);
              fetch(`http://127.0.0.1:3001/api/lyrics/${currentSong.videoId}/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lines: nonEmpties })
              })
                .then(r => r.json())
                .then(transData => {
                  if (!isMounted || !Array.isArray(transData.translations)) return;
                  let tIdx = 0;
                  setPlainLines(prev =>
                    prev.map(item => {
                      if (!item.text?.trim()) return item;
                      const trans = transData.translations[tIdx] || null;
                      tIdx++;
                      return { ...item, translation: trans };
                    })
                  );
                })
                .catch(err => console.warn('Error en traducción secundaria:', err))
                .finally(() => {
                  if (isMounted) setIsTranslating(false);
                });
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

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentSong?.videoId, currentSong?.title, currentSong?.artist]);

  // Ticker de sincronización en tiempo real con YouTube Player (Karaoke)
  useEffect(() => {
    if (!isOpen || !isSynced || syncedLines.length === 0) return;

    const interval = setInterval(() => {
      if (!playerRef?.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      try {
        const currentTime = playerRef.current.getCurrentTime();
        let currentIdx = -1;
        for (let i = 0; i < syncedLines.length; i++) {
          if (currentTime >= syncedLines[i].time - 0.2) {
            currentIdx = i;
          } else {
            break;
          }
        }

        if (currentIdx !== -1 && currentIdx !== activeIdx) {
          setActiveIdx(currentIdx);
        }
      } catch (e) {}
    }, 200);

    return () => clearInterval(interval);
  }, [isOpen, isSynced, syncedLines, activeIdx, playerRef]);

  // Auto-scroll suave de la línea activa al centro de la vista
  useEffect(() => {
    if (activeLineRef.current && isSynced) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIdx, isSynced]);

  // Saltar en el reproductor al hacer clic en un verso
  const handleSeek = (time) => {
    if (playerRef?.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(time, true);
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

      {/* Selector de idioma / traducción */}
      {(hasTranslations || isTranslating) && !loading && (
        <div className="lyrics-lang-bar">
          <div className="lang-bar-label">
            <Languages size={14} />
            <span>{isTranslating ? 'Traduciendo al español...' : 'Traducción:'}</span>
            {isTranslating && <Loader2 size={12} className="spinner" />}
          </div>
          <div className="lang-pill-selector">
            <button
              className={`lang-pill ${displayMode === 'bilingual' ? 'active' : ''}`}
              onClick={() => handleModeChange('bilingual')}
              title="Mostrar texto original y traducción al español debajo"
            >
              Bilingüe
            </button>
            <button
              className={`lang-pill ${displayMode === 'translation' ? 'active' : ''}`}
              onClick={() => handleModeChange('translation')}
              title="Mostrar solo la letra en español"
            >
              Español
            </button>
            <button
              className={`lang-pill ${displayMode === 'original' ? 'active' : ''}`}
              onClick={() => handleModeChange('original')}
              title="Mostrar solo el idioma original"
            >
              Original
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
