import React from 'react';
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
  return (
    <div className="queue-container">
      <div className="queue-header">
        <h3>Próximas canciones</h3>
        {queueSource && <span className="queue-source">{queueSource}</span>}
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
        {queue.slice(0, 10).map((song, idx) => (
          <QueueItem 
            key={idx}
            song={song}
            index={idx}
            totalItems={queue.length}
            handleMoveInQueue={handleMoveInQueue}
            handleRemoveFromQueue={handleRemoveFromQueue}
          />
        ))}
        {queue.length > 10 && <div className="queue-more">y {queue.length - 10} más...</div>}
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
                key={idx}
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
