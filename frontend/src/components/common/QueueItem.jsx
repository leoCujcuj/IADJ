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

  const songId = song.videoId || song.id;
  const isFirst = index === 0;
  const isLast = index >= totalItems - 1;

  return (
    <div className="queue-item">
      <span className="queue-index">{index + 1}</span>
      <div className="queue-item-info">
        <span className="queue-title">{song.title}</span>
        <span className="queue-artist">{song.artist}</span>
      </div>
      <div className="queue-actions">
        <button 
          type="button"
          className="action-btn" 
          onClick={() => handleMoveInQueue(songId, 0)} 
          disabled={isFirst}
          title="Poner primero"
          aria-label="Poner primero en la cola"
        >
          ↑↑
        </button>
        <button 
          type="button"
          className="action-btn" 
          onClick={() => handleMoveInQueue(songId, Math.max(0, index - 1))} 
          disabled={isFirst}
          title="Subir un lugar"
          aria-label="Subir cancion un lugar"
        >
          ↑
        </button>
        <button 
          type="button"
          className="action-btn" 
          onClick={() => handleMoveInQueue(songId, Math.min(totalItems - 1, index + 1))} 
          disabled={isLast}
          title="Bajar un lugar"
          aria-label="Bajar cancion un lugar"
        >
          ↓
        </button>
        <button 
          type="button"
          className="remove-item" 
          onClick={() => handleRemoveFromQueue(songId)}
          title="Eliminar de la cola"
          aria-label="Eliminar cancion de la cola"
        >
          ×
        </button>
      </div>
    </div>
  );
}
