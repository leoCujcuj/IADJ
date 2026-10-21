import React, { useState } from 'react';
import QueueItem from './common/QueueItem';

export default function QueueSection({
  queue,
  queueSource,
  manualSearch,
  setManualSearch,
  handleAddManual,
  handleMoveInQueue,
  handleRemoveFromQueue,
  history
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const displayedQueue = isExpanded ? queue : queue.slice(0, 10);
  const remainingCount = queue.length > 10 ? queue.length - 10 : 0;

  return (
    <div className="queue-container">
      <div className="queue-header">
        <div className="queue-header-left">
          <h3>Próximas canciones</h3>
          {queue.length > 0 && <span className="queue-counter">({queue.length})</span>}
        </div>
        <div className="queue-header-right">
          {queue.length > 10 && isExpanded && (
            <button 
              type="button" 
              className="queue-collapse-btn"
              onClick={() => setIsExpanded(false)}
              title="Mostrar solo las primeras 10 canciones"
            >
              Mostrar menos
            </button>
          )}
          {queueSource && <span className="queue-source">{queueSource}</span>}
        </div>
      </div>
      
      <form className="manual-add-form" onSubmit={handleAddManual}>
        <input 
          type="text" 
          value={manualSearch} 
          onChange={e => setManualSearch(e.target.value)} 
          placeholder="Añadir link de canción, playlist o nombre..." 
        />
        <button type="submit">Añadir</button>
      </form>

      <div className="queue-list">
        {displayedQueue.map((song, idx) => (
          <QueueItem 
            key={song.videoId || song.id ? `${song.videoId || song.id}-${idx}` : idx}
            song={song}
            index={idx}
            totalItems={queue.length}
            handleMoveInQueue={handleMoveInQueue}
            handleRemoveFromQueue={handleRemoveFromQueue}
          />
        ))}

        {queue.length > 10 && !isExpanded && (
          <button 
            type="button"
            className="queue-more-btn"
            onClick={() => setIsExpanded(true)}
            title="Ver todas las canciones en cola"
          >
            <span className="queue-more-text">y {remainingCount} más...</span>
            <span className="queue-more-action">Ver todas</span>
          </button>
        )}

        {queue.length > 10 && isExpanded && (
          <button 
            type="button"
            className="queue-more-btn expanded"
            onClick={() => setIsExpanded(false)}
            title="Mostrar solo las primeras 10 canciones"
          >
            <span className="queue-more-text">Cola completa ({queue.length} canciones)</span>
            <span className="queue-more-action">Mostrar menos</span>
          </button>
        )}

        {queue.length === 0 && <p className="empty-msg">No hay más canciones en cola</p>}
      </div>

      {history.length > 0 && (
        <div className="history-section">
          <div className="queue-header">
            <h3>Ya escuchadas</h3>
          </div>
          <div className="queue-list history">
            {history.slice(0, 5).map((song, idx) => (
              <QueueItem 
                key={song.videoId || song.id ? `history-${song.videoId || song.id}-${idx}` : `history-${idx}`}
                song={song}
                isPlayed={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
