import React from 'react';
import { Music, ThumbsUp, ThumbsDown, SkipForward } from 'lucide-react';

export default function PlayerCard({
  currentSong,
  isLiked,
  isDisliked,
  handleLike,
  handleDislike,
  handleNext
}) {
  return (
    <>
      <div className="video-container">
        <div id="youtube-player"></div>
        {!currentSong && (
          <div className="no-video">
            <Music size={48} className="placeholder-icon" />
            <p>Sintonizando...</p>
          </div>
        )}
      </div>
      <div className="player-info-card">
        {currentSong ? (
          <div className="song-details">
            <div className="song-main">
              <h2>{currentSong.title}</h2>
              <p>{currentSong.artist}</p>
            </div>
          </div>
        ) : (
          <div className="song-details empty">
            <h2>Esperando señal...</h2>
            <p>Pide algo al DJ</p>
          </div>
        )}
        <div className="player-controls">
          <button 
            className={`control-btn like ${isLiked ? 'active' : ''}`} 
            onClick={handleLike}
            title="Actualizará la lista en base a esta canción para ponerte más temas similares"
          >
            <ThumbsUp size={20} fill={isLiked ? "currentColor" : "none"} />
            <span>{isLiked ? 'Liked!' : 'Like'}</span>
          </button>
          <button 
            className={`control-btn dislike ${isDisliked ? 'active' : ''}`} 
            onClick={handleDislike}
            title="Se cambiará de canción a una diferente y el DJ evitará este estilo en la sesión"
          >
            <ThumbsDown size={20} fill={isDisliked ? "currentColor" : "none"} />
            <span>Dislike</span>
          </button>
          <button className="control-btn next" onClick={handleNext}>
            <span>Siguiente</span>
            <SkipForward size={20} />
          </button>
        </div>
      </div>
    </>
  );
}
