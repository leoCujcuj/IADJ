import React, { useState } from 'react';
import { X, Flame, Play, ThumbsUp, MessageSquare, Trophy, Award, Radio } from 'lucide-react';

export default function FavoritesModal({
  isOpen,
  onClose,
  sessionFavorites = [],
  globalFavorites = [],
  favorites = [],
  sessionName = 'Esta Estación',
  onPlaySong,
  loading = false
}) {
  const [activeTab, setActiveTab] = useState('session'); // 'session' | 'general'

  if (!isOpen) return null;

  const currentFavorites = activeTab === 'session' 
    ? (sessionFavorites.length > 0 || globalFavorites.length > 0 ? sessionFavorites : favorites)
    : (globalFavorites.length > 0 ? globalFavorites : favorites);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content favorites-modal" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="favorites-modal-title"
      >
        {/* Encabezado acorde al resto de modales */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-icon-badge flame-badge">
              <Flame size={20} className="flame-icon-pulse" />
            </div>
            <div>
              <h3 id="favorites-modal-title">En Repetición</h3>
              <p className="modal-subtitle">Canciones más solicitadas y con Me gusta</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Pestañas de alcance: Esta Estación vs General */}
        <div className="favorites-scope-tabs">
          <button 
            type="button"
            className={`favorites-scope-tab ${activeTab === 'session' ? 'active' : ''}`}
            onClick={() => setActiveTab('session')}
          >
            <Radio size={15} />
            <span className="tab-label">Esta Estación</span>
            <span className="tab-pill-badge">{sessionFavorites.length}</span>
          </button>
          <button 
            type="button"
            className={`favorites-scope-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Flame size={15} />
            <span className="tab-label">General (Todas)</span>
            <span className="tab-pill-badge">{globalFavorites.length > 0 ? globalFavorites.length : favorites.length}</span>
          </button>
        </div>

        <div className="modal-body favorites-modal-body">
          {loading ? (
            <div className="favorites-empty-state">
              <p>Cargando lista de repeticiones...</p>
            </div>
          ) : currentFavorites.length === 0 ? (
            <div className="favorites-empty-state">
              {activeTab === 'session' ? (
                <>
                  <Radio size={40} className="empty-flame-icon" />
                  <h3>Sin repeticiones en esta estación</h3>
                  <p>
                    Pide canciones al DJ en el chat o márcalas con Me gusta dentro de esta estación para que aparezcan aquí.
                  </p>
                </>
              ) : (
                <>
                  <Flame size={40} className="empty-flame-icon" />
                  <h3>Aún no tienes canciones en repetición</h3>
                  <p>
                    Pide canciones al DJ en el chat o márcalas con Me gusta para que aparezcan en esta sección.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="favorites-list">
              {currentFavorites.map((song, index) => {
                const rank = index + 1;
                const isTop1 = rank === 1;
                const isTop2 = rank === 2;
                const isTop3 = rank === 3;
                const rankClass = isTop1 ? 'rank-gold' : isTop2 ? 'rank-silver' : isTop3 ? 'rank-bronze' : '';

                return (
                  <div key={song.videoId || index} className={`favorite-item ${rankClass}`}>
                    <div className={`favorite-rank-badge ${rankClass}`}>
                      {isTop1 ? (
                        <Trophy size={14} className="rank-icon rank-gold-icon" />
                      ) : (isTop2 || isTop3) ? (
                        <Award size={14} className={`rank-icon ${isTop2 ? 'rank-silver-icon' : 'rank-bronze-icon'}`} />
                      ) : null}
                      <span>{rank}</span>
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
                        title={`Reproducida ${song.totalCount} veces ${activeTab === 'session' ? 'en esta estación' : 'en total'}`}
                      >
                        <Flame size={12} className="inline-flame" />
                        <span>{song.totalCount}x</span>
                      </span>

                      {song.requestCount > 0 && (
                        <span 
                          className="fav-count-pill request-pill" 
                          title={`Pedida al DJ ${song.requestCount} veces`}
                        >
                          <MessageSquare size={11} />
                          <span>{song.requestCount}</span>
                        </span>
                      )}

                      {song.likeCount > 0 && (
                        <span 
                          className="fav-count-pill like-pill" 
                          title={`Marcada con Me gusta ${song.likeCount} veces`}
                        >
                          <ThumbsUp size={11} />
                          <span>{song.likeCount}</span>
                        </span>
                      )}
                    </div>

                    <button 
                      className="favorite-play-btn"
                      onClick={() => {
                        onPlaySong(song);
                        onClose();
                      }}
                      title={`Poner "${song.title}"`}
                      aria-label={`Reproducir ${song.title}`}
                    >
                      <Play size={15} fill="currentColor" />
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
