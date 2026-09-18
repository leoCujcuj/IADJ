import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Radio, 
  Music, 
  Trash2, 
  Edit3, 
  Check, 
  Disc3, 
  Headphones,
  Sparkles,
  Play
} from 'lucide-react';

export default function SessionsModal({
  isOpen,
  onClose,
  sessions = [],
  activeSessionId,
  onSwitchSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  showConfirm,
  showAlert
}) {
  const [newSessionName, setNewSessionName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  if (!isOpen) return null;

  const handleConfirmCreate = (e) => {
    e.preventDefault();
    const trimmed = newSessionName.trim();
    if (!trimmed) return;
    onCreateSession(trimmed);
    setNewSessionName('');
  };

  const handleStartRename = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditingName(session.name);
  };

  const handleConfirmRename = (e, id) => {
    e.stopPropagation();
    const trimmed = editingName.trim();
    if (trimmed) {
      onRenameSession(id, trimmed);
    }
    setEditingId(null);
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      if (showAlert) {
        showAlert({
          title: "Estación Única",
          message: "No puedes eliminar la única estación activa.",
          type: "info"
        });
      }
      return;
    }

    if (showConfirm) {
      const confirmed = await showConfirm({
        title: "Eliminar Emisora",
        message: `¿Seguro que deseas eliminar la estación "${name}"?\nSe borrará su historial de música y chat con el DJ.`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        type: "danger"
      });
      if (confirmed) {
        onDeleteSession(id);
      }
    } else {
      onDeleteSession(id);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Ahora';
      if (diffMins < 60) return `hace ${diffMins}m`;
      if (diffHours < 24) return `hace ${diffHours}h`;
      if (diffDays === 1) return 'Ayer';
      return `hace ${diffDays}d`;
    } catch {
      return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sessions-modal" onClick={(e) => e.stopPropagation()}>
        {/* Encabezado acorde a los otros modales */}
        <div className="modal-header">
          <div className="modal-title-row">
            <Radio size={22} className="accent-icon" />
            <div>
              <h3>Estaciones de Radio</h3>
              <p className="modal-subtitle">
                Crea o cambia de emisora con su propio gusto y chat con el DJ
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} title="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="modal-body sessions-modal-body">
          {/* Creador de nueva estación */}
          <form onSubmit={handleConfirmCreate} className="session-create-box">
            <input
              type="text"
              placeholder="Nueva emisora (ej. Gym, Estudio, Chill, Rock...)"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              className="session-create-input"
              maxLength={40}
            />
            <button 
              type="submit" 
              className="btn-create-session"
              disabled={!newSessionName.trim()}
            >
              <Plus size={16} />
              <span>Crear</span>
            </button>
          </form>

          {/* Lista de Estaciones */}
          <div className="sessions-cards-container">
            {sessions.length === 0 ? (
              <div className="sessions-modal-empty">
                <Radio size={32} className="empty-icon" />
                <p>No tienes estaciones creadas aún.</p>
              </div>
            ) : (
              sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                const isEditing = editingId === sess.id;
                const currentSong = sess.current_song;

                return (
                  <div
                    key={sess.id}
                    className={`session-card-item ${isActive ? 'active' : 'inactive'}`}
                    onClick={() => {
                      if (!isEditing && !isActive) {
                        onSwitchSession(sess.id);
                      }
                    }}
                    title={isActive ? 'Estación activa al aire' : `Haz clic para sintonizar "${sess.name}"`}
                  >
                    <div className="session-card-left">
                      <div className={`session-card-avatar ${isActive ? 'active' : ''}`}>
                        {isActive ? (
                          <Disc3 size={19} className="spin-disc" />
                        ) : (
                          <Radio size={18} />
                        )}
                      </div>

                      <div className="session-card-details">
                        <div className="session-card-header-row">
                          {isEditing ? (
                            <div className="session-rename-wrapper" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleConfirmRename(e, sess.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                                className="session-rename-input"
                                autoFocus
                              />
                              <button
                                type="button"
                                className="btn-rename-check"
                                onClick={(e) => handleConfirmRename(e, sess.id)}
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="session-card-title-group">
                              <h4 className="session-card-title">{sess.name}</h4>
                              {isActive ? (
                                <span className="active-badge">Al Aire</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-tune-station"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSwitchSession(sess.id);
                                  }}
                                  title={`Sintonizar emisora "${sess.name}"`}
                                >
                                  <Play size={11} fill="currentColor" />
                                  <span>Sintonizar</span>
                                </button>
                              )}
                            </div>
                          )}

                          <span className="session-card-time">
                            {formatTimeAgo(sess.updated_at || sess.created_at)}
                          </span>
                        </div>

                        <div className="session-card-footer-row">
                          <p className="session-card-subtitle">
                            {currentSong && currentSong.title ? (
                              <span className="subtitle-song">
                                <Music size={12} />
                                {currentSong.title} — {currentSong.artist}
                              </span>
                            ) : sess.history_count > 0 ? (
                              <span>{sess.history_count} canciones en historial</span>
                            ) : (
                              <span className="subtitle-empty">Estación nueva</span>
                            )}
                          </p>

                          <div className="session-card-actions">
                            <button
                              type="button"
                              className="card-action-btn"
                              title="Renombrar emisora"
                              onClick={(e) => handleStartRename(e, sess)}
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              type="button"
                              className="card-action-btn delete"
                              title="Eliminar emisora"
                              onClick={(e) => handleDelete(e, sess.id, sess.name)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer idéntico a SettingsModal */}
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}
