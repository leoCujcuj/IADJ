import React from 'react';
import { Music, ThumbsUp, ThumbsDown, SkipForward, Mic2, Sparkles, Loader2, Flame } from 'lucide-react';

export default function PlayerCard({
  currentSong,
  repeatCount = 0,
  globalRepeatCount = 0,
  isLiked,
  isDisliked,
  handleLike,
  handleDislike,
  handleNext,
  onOpenLyrics,
  onOpenTrivia,
  loadingTrivia
}) {
  return (
    <>
      {/* 1. Nombre de la canción y estado ARRIBA del video */}
      <div className="song-header-bar">
        <div className="song-header-info">
          {currentSong ? (
            <>
              <div className="song-badge-row">
                <span className="now-playing-badge">
                  <span className="live-dot"></span> Sonando ahora
                </span>
                {repeatCount >= 2 ? (
                  <span 
                    className="repeat-badge" 
                    title={globalRepeatCount > repeatCount 
                      ? `${repeatCount} veces en esta estación (${globalRepeatCount} en total)` 
                      : `Has pedido o dado like a esta canción ${repeatCount} veces en esta estación`}
                  >
                    <Flame size={13} className="repeat-badge-flame" /> En repetición ({repeatCount}x estación{globalRepeatCount > repeatCount ? ` • ${globalRepeatCount}x general` : ''})
                  </span>
                ) : globalRepeatCount >= 2 ? (
                  <span 
                    className="repeat-badge repeat-badge-global" 
                    title={`Has pedido o dado like a esta canción ${globalRepeatCount} veces en general`}
                  >
                    <Flame size={13} className="repeat-badge-flame" /> En repetición ({globalRepeatCount}x general)
                  </span>
                ) : null}
              </div>
              <h2 className="song-header-title" title={currentSong.title}>
                {currentSong.title}
              </h2>
              <p className="song-header-artist">{currentSong.artist}</p>
            </>
          ) : (
            <div className="song-header-empty">
              <span className="now-playing-badge idle">
                <Music size={13} /> Gemini Radio
              </span>
              <h2 className="song-header-title">Esperando señal...</h2>
              <p className="song-header-artist">Pide algo al DJ en el chat</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. Video de YouTube */}
      <div className="video-container">
        <div id="youtube-player"></div>
        {!currentSong && (
          <div className="no-video">
            <Music size={48} className="placeholder-icon" />
            <p>Sintonizando...</p>
          </div>
        )}
      </div>

      {/* 3. Controles ordenados ABAJO del video */}
      <div className="player-controls-bar">
        <div className="controls-group discovery-group">
          <button 
            className="control-btn lyrics" 
            onClick={onOpenLyrics}
            disabled={!currentSong}
            title="Ver letra sincronizada"
          >
            <Mic2 size={17} />
            <span>Letras</span>
          </button>
          <button 
            className="control-btn trivia" 
            onClick={onOpenTrivia}
            disabled={!currentSong || loadingTrivia}
            title="Ver curiosidades del tema o músico"
          >
            {loadingTrivia ? <Loader2 size={17} className="spinner" /> : <Sparkles size={17} />}
            <span>Curiosidades</span>
          </button>
        </div>

        <div className="controls-divider"></div>

        <div className="controls-group playback-group">
          <button 
            className={`control-btn like ${isLiked ? 'active' : ''}`} 
            onClick={handleLike}
            disabled={!currentSong}
            title="Actualizará la lista en base a esta canción para ponerte más temas similares"
          >
            <ThumbsUp size={18} fill={isLiked ? "currentColor" : "none"} />
            <span>{isLiked ? 'Liked!' : 'Like'}</span>
          </button>
          <button 
            className={`control-btn dislike ${isDisliked ? 'active' : ''}`} 
            onClick={handleDislike}
            disabled={!currentSong}
            title="Se cambiará de canción a una diferente y el DJ evitará este estilo en la sesión"
          >
            <ThumbsDown size={18} fill={isDisliked ? "currentColor" : "none"} />
            <span>Dislike</span>
          </button>
          <button 
            className="control-btn next" 
            onClick={handleNext}
            title="Saltar a la siguiente canción"
          >
            <span>Siguiente</span>
            <SkipForward size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
