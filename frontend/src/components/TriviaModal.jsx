import React from 'react';
import { X, Sparkles, Loader2, MessageSquarePlus, Lightbulb, RefreshCw } from 'lucide-react';

export default function TriviaModal({
  isOpen,
  onClose,
  currentSong,
  trivia,
  loading,
  onAnotherTrivia,
  onAskDJMore,
  onShareToChat
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content trivia-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Sparkles size={22} className="accent-icon trivia-icon" />
            <div>
              <h3>Curiosidades</h3>
              <p className="modal-subtitle">
                {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'Sin canción activa'}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} title="Cerrar"><X size={20} /></button>
        </div>

        <div className="modal-body trivia-body">
          {loading ? (
            <div className="trivia-loading">
              <Loader2 size={30} className="spinner" />
              <p>Consultando curiosidades con el DJ...</p>
            </div>
          ) : trivia ? (
            <div className="trivia-card">
              <div className="trivia-card-badge">
                <Lightbulb size={16} />
                <span>¿Sabías que...?</span>
              </div>
              <p className="trivia-text">{trivia}</p>
            </div>
          ) : (
            <div className="trivia-empty">
              <p>No se encontraron datos curiosos para este tema.</p>
            </div>
          )}
        </div>

        <div className="modal-footer trivia-footer">
          {onAnotherTrivia && (
            <button 
              type="button" 
              className="trivia-action-btn secondary"
              onClick={onAnotherTrivia}
              disabled={loading}
              title="Obtener otra curiosidad diferente sobre esta canción o artista"
            >
              <RefreshCw size={15} className={loading ? "spinner" : ""} />
              <span>Otra curiosidad</span>
            </button>
          )}
          {trivia && !loading && (
            <>
              {onShareToChat && (
                <button 
                  type="button" 
                  className="trivia-action-btn secondary"
                  onClick={onShareToChat}
                  title="Copiar curiosidad al chat del DJ"
                >
                  <MessageSquarePlus size={15} />
                  <span>Ver en Chat</span>
                </button>
              )}
              {onAskDJMore && (
                <button 
                  type="button" 
                  className="trivia-action-btn primary"
                  onClick={onAskDJMore}
                  title="Preguntarle al DJ más detalles sobre este artista"
                >
                  <Sparkles size={15} />
                  <span>Preguntar al DJ</span>
                </button>
              )}
            </>
          )}
          <button type="button" className="pill-btn close-modal-btn" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
