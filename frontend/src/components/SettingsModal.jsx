import React from 'react';
import { X, Volume2, Volume1, Sparkles, Clock, Sliders, Database, RotateCcw, PauseCircle } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  frequency,
  setFrequency,
  personality,
  setPersonality,
  crossfade,
  setCrossfade,
  autoPauseOnTabChange,
  setAutoPauseOnTabChange,
  duckingVolume = 20,
  setDuckingVolume,
  sessionStatus = 'idle',
  sessionName = 'Sesión Principal',
  onNewSession
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <Sliders size={22} className="accent-icon" />
            <h3>Ajustes de la Radio</h3>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {/* Frecuencia de intervención */}
          <div className="settings-group">
            <label className="settings-label">
              <Clock size={18} />
              <span>Frecuencia del DJ (Ahorro de API)</span>
            </label>
            <p className="settings-desc">Cada cuántas canciones hablará el locutor:</p>
            <div className="pill-grid">
              {[
                { val: 3, label: 'Cada 3 temas' },
                { val: 5, label: 'Cada 5 temas (Recomendado)' },
                { val: 10, label: 'Cada 10 temas' },
                { val: 0, label: 'Solo al chatear' }
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`pill-btn ${frequency === opt.val ? 'active' : ''}`}
                  onClick={() => setFrequency(opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Personalidad del DJ */}
          <div className="settings-group">
            <label className="settings-label">
              <Sparkles size={18} />
              <span>Personalidad del Locutor</span>
            </label>
            <p className="settings-desc">El tono y estilo al hablar (no altera tu música ni tus géneros):</p>
            <div className="personality-options">
              {[
                { id: 'chill', name: 'Chill / Relajado', desc: 'Voz suave, pausada y cercana al presentar las canciones.' },
                { id: 'energetic', name: 'Enérgico / Festivo', desc: 'Locución con ritmo alto, animada y con mucha chispa.' },
                { id: 'curator', name: 'Melómano / Curador', desc: 'Comentarios con datos curiosos, producción y anécdotas.' }
              ].map((p) => (
                <div
                  key={p.id}
                  className={`personality-card ${personality === p.id ? 'active' : ''}`}
                  onClick={() => setPersonality(p.id)}
                >
                  <div className="personality-radio">
                    <span className={`radio-dot ${personality === p.id ? 'selected' : ''}`} />
                  </div>
                  <div className="personality-text">
                    <h4>{p.name}</h4>
                    <p>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Atenuación de volumen cuando habla el DJ */}
          <div className="settings-group">
            <div className="range-header">
              <label className="settings-label">
                <Volume1 size={18} />
                <span>Volumen de la música al hablar el DJ</span>
              </label>
              <span className="volume-badge">{duckingVolume}%</span>
            </div>
            <p className="settings-desc">
              Define cuánto debe bajar la canción durante las locuciones (0% = silenciar música por completo, mayor % = fondo más fuerte):
            </p>
            <div className="slider-wrapper">
              <input
                type="range"
                min="0"
                max="60"
                step="5"
                value={duckingVolume}
                onChange={(e) => setDuckingVolume(Number(e.target.value))}
                className="custom-range-slider"
              />
            </div>
            <div className="pill-grid">
              {[
                { val: 0, label: '0% (Silenciar música)' },
                { val: 15, label: '15% (DJ muy claro)' },
                { val: 25, label: '25% (Equilibrado)' },
                { val: 40, label: '40% (Música presente)' }
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  className={`pill-btn ${duckingVolume === opt.val ? 'active' : ''}`}
                  onClick={() => setDuckingVolume(opt.val)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Crossfade de audio */}
          <div className="settings-group toggle-group">
            <div className="toggle-info">
              <label className="settings-label">
                <Volume2 size={18} />
                <span>Crossfade suave</span>
              </label>
              <p className="settings-desc">
                Baja el volumen suavemente al terminar la canción y lo sube al iniciar la siguiente.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={crossfade}
                onChange={(e) => setCrossfade(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* Pausa al cambiar de pestaña o ventana */}
          <div className="settings-group toggle-group">
            <div className="toggle-info">
              <label className="settings-label">
                <PauseCircle size={18} />
                <span>Pausar al cambiar de pestaña o ventana</span>
              </label>
              <p className="settings-desc">
                Pausa la música y la locución automáticamente al salir de la pestaña del navegador y la reanuda al volver.
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoPauseOnTabChange}
                onChange={(e) => setAutoPauseOnTabChange(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* Persistencia de Sesión (PostgreSQL) */}
          <div className="settings-group session-settings-group">
            <label className="settings-label">
              <Database size={18} />
              <span>Persistencia de Sesión (PostgreSQL)</span>
            </label>
            <p className="settings-desc">
              Tu cola de reproducción, historial y conversación con el DJ se guardan automáticamente para no perderlos si sales o recargas.
            </p>

            <div className="session-status-card">
              <div className="session-status-left">
                <span className={`status-indicator-dot ${sessionStatus}`} />
                <div className="session-status-info">
                  <span className="session-name-title">{sessionName || 'Sesión Principal'}</span>
                  <span className="session-status-text">
                    {sessionStatus === 'saving' && 'Guardando cambios en Base de Datos...'}
                    {sessionStatus === 'saved' && 'Sincronizada con PostgreSQL'}
                    {sessionStatus === 'restored' && 'Sesión restaurada desde Base de Datos'}
                    {sessionStatus === 'error' && 'Guardado localmente (sin conexión a BD)'}
                    {sessionStatus === 'idle' && 'Sesión activa'}
                  </span>
                </div>
              </div>

              {onNewSession && (
                <button 
                  type="button" 
                  className="btn-new-session" 
                  onClick={onNewSession}
                  title="Archivar la sesión actual e iniciar una nueva desde cero"
                >
                  <RotateCcw size={15} />
                  <span>Nueva Sesión</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}
