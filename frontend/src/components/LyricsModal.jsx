import React, { useEffect, useState } from 'react';
import { X, Mic2, Loader2 } from 'lucide-react';

export default function LyricsModal({ isOpen, onClose, currentSong }) {
  const [lyrics, setLyrics] = useState(null);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentSong?.videoId) return;

    let isMounted = true;
    setLoading(true);
    setLyrics(null);
    setSource(null);

    fetch(`http://127.0.0.1:3001/api/lyrics/${currentSong.videoId}`)
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        setLyrics(data.lyrics || null);
        setSource(data.source || 'YouTube Music');
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Error al cargar letras:', err);
        setLyrics(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentSong?.videoId]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content lyrics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Mic2 size={22} className="accent-icon" />
            <div>
              <h3>Letras</h3>
              <p className="modal-subtitle">
                {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'Sin canción activa'}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body lyrics-body">
          {loading ? (
            <div className="lyrics-loading">
              <Loader2 size={32} className="spinner" />
              <p>Sincronizando letras de YouTube Music...</p>
            </div>
          ) : lyrics ? (
            <div className="lyrics-text">
              {lyrics.split('\n').map((line, idx) => (
                <p key={idx} className={line.trim() === '' ? 'lyrics-spacer' : 'lyrics-line'}>
                  {line || ' '}
                </p>
              ))}
              {source && <span className="lyrics-source">Fuente: {source}</span>}
            </div>
          ) : (
            <div className="lyrics-empty">
              <Mic2 size={40} className="text-dim" />
              <p>No se encontraron letras disponibles para esta pista en YouTube Music.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
