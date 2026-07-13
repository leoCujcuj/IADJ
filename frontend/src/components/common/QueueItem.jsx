import React from 'react';

export default function QueueItem({
  song,
  index,
  totalItems,
  handleMoveInQueue,
  handleRemoveFromQueue,
  isPlayed = false
}) {
  if (isPlayed) {
    return (
      <div className="queue-item played">
        <div className="queue-item-info">
          <span className="queue-title">{song.title}</span>
          <span className="queue-artist">{song.artist}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="queue-item">
      <span className="queue-index">{index + 1}</span>
      <div className="queue-item-info">
        <span className="queue-title">{song.title}</span>
        <span className="queue-artist">{song.artist}</span>
      </div>
      <div className="queue-actions">
        <button 
          className="action-btn" 
          onClick={() => handleMoveInQueue(song.videoId, 0)} 
          title="Poner primero"
        >
          ↑↑
        </button>
        <button 
          className="action-btn" 
          onClick={() => handleMoveInQueue(song.videoId, Math.max(0, index - 1))} 
          title="Subir"
        >
          ↑
        </button>
        <button 
          className="action-btn" 
          onClick={() => handleMoveInQueue(song.videoId, Math.min(totalItems - 1, index + 1))} 
          title="Bajar"
        >
          ↓
        </button>
        <button 
          className="remove-item" 
          onClick={() => handleRemoveFromQueue(song.videoId)}
          title="Eliminar de la cola"
        >
          ×
        </button>
      </div>
    </div>
  );
}
