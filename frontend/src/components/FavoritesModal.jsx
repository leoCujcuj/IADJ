import React from 'react';
import { X, Flame, Play, ThumbsUp, MessageSquare, Music } from 'lucide-react';

export default function FavoritesModal({
  isOpen,
  onClose,
  favorites = [],
  onPlaySong,
  loading = false
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-content favorites-modal" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="favorites-modal-title"
      >
        <div className="modal-header">
          <div className="modal-header-title-group">
            <div className="modal-icon-badge flame-badge">
              <Flame size={20} className="flame-icon-pulse" />
            </div>
            <div>
              <h2 id="favorites-modal-title">En Repetición</h2>
              <p className="modal-subtitle">Tus canciones más pedidas y con 'Me gusta'</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body favorites-modal-body">
          {loading ? (
            <div className="favorites-empty-state">
              <p>Cargando tus temas favoritos...</p>
            </div>
          ) : favorites.length === 0 ? (
            <div className="favorites-empty-state">
              <Flame size={42} className="empty-flame-icon" />
              <h3>Aún no tienes canciones en repetición</h3>
              <p>
                Pídele canciones directamente a tu DJ en el chat o dales <strong>Like (👍)</strong> para que aparezcan en tu ranking de favoritas.
              </p>
            </div>
          ) : (
            <div className="favorites-list">
              {favorites.map((song, index) => {
                const rank = index + 1;
                return (
                  <div key={song.videoId || index} className="favorite-item">
                    <div className="favorite-rank">
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                    </div>

                    <div className="favorite-info">
                      <h4 className="favorite-title" title={song.title}>
                        {song.title}
                      </h4>
                      <p className="favorite-artist">{song.artist}</p>
                    </div>

                    <div className="favorite-badges">
                      <span 
                        className="fav-count-pill total-pill" 
                        title={`Reproducida ${song.totalCount} veces en total`}
                      >
                        <Flame size={13} className="inline-flame" />
                        {song.totalCount}x
                      </span>

                      {song.requestCount > 0 && (
                        <span 
                          className="fav-count-pill request-pill" 
                          title={`Pedida al DJ ${song.requestCount} veces`}
                        >
                          <MessageSquare size={11} />
                          {song.requestCount}
                        </span>
                      )}

                      {song.likeCount > 0 && (
                        <span 
                          className="fav-count-pill like-pill" 
                          title={`Marcada con Like ${song.likeCount} veces`}
                        >
                          <ThumbsUp size={11} />
                          {song.likeCount}
                        </span>
                      )}
                    </div>

                    <button 
                      className="favorite-play-btn"
                      onClick={() => {
                        onPlaySong(song);
                        onClose();
                      }}
                      title={`Poner "${song.title}" ahora`}
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
