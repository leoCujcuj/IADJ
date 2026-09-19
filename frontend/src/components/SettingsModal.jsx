import React from 'react';
import { X, Volume2, Volume1, Sparkles, Clock, Sliders, Database, RotateCcw, PauseCircle, Mic, Play, Square } from 'lucide-react';

export const AVAILABLE_VOICES = [
  {
    id: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie',
    gender: 'Masculino',
    style: 'Enérgico y seguro',
    sampleText: 'Hola, soy Charlie, tu locutor de radio. ¿Listo para empezar?'
  },
  {
    id: 'bIHbv24MWmeRgasZH58o',
    name: 'Will',
    gender: 'Masculino',
    style: 'Chill y relajado',
    sampleText: 'Qué tal, soy Will. Todo relajado por aquí, ¿listo para empezar?'
  },
  {
    id: 'CwhRBWXzGAHq8TQ4Fs17',
    name: 'Roger',
    gender: 'Masculino',
    style: 'Grave y elegante',
    sampleText: 'Saludos, soy Roger. Buenas vibras en la cabina, ¿listo para empezar?'
  },
  {
    id: 'cjVigY5qzO86Huf0OWal',
    name: 'Eric',
    gender: 'Masculino',
    style: 'Clásico y suave',
    sampleText: 'Hola, soy Eric. La mejor música para ti, ¿listo para empezar?'
  },
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    gender: 'Masculino',
    style: 'Profundo y sobrio',
    sampleText: 'Hola, te habla Brian. Bienvenido a la radio, ¿listo para empezar?'
  },
  {
    id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    gender: 'Femenino',
    style: 'Cálida y alegre',
    sampleText: 'Hola, soy Jessica. Qué gusto acompañarte hoy, ¿listo para empezar?'
  },
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    gender: 'Femenino',
    style: 'Profesional y clara',
    sampleText: 'Hola, soy Sarah. Excelente selección para hoy, ¿listo para empezar?'
  },
  {
    id: 'FGY2WhTYpPnrIDTdsKH5',
    name: 'Laura',
    gender: 'Femenino',
    style: 'Entusiasta y vivaz',
    sampleText: 'Hola, soy Laura. Mucha energía en la música hoy, ¿listo para empezar?'
  }
];

export default function SettingsModal({
  isOpen,
  onClose,
  frequency,
  setFrequency,
  personality,
  setPersonality,
  selectedVoice = 'IKne3meq5aSn9XLyUdCD',
  setSelectedVoice,
  onPlayVoicePreview,
  playingPreviewVoiceId,
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

          {/* Voz del Locutor */}
          <div className="settings-group">
            <label className="settings-label">
              <Mic size={18} />
              <span>Voz del Locutor</span>
            </label>
            <p className="settings-desc">Elige la voz del locutor y escucha una previa antes de seleccionarla:</p>
            <div className="voice-options-grid">
              {AVAILABLE_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                const isPlaying = playingPreviewVoiceId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`voice-card ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedVoice && setSelectedVoice(v.id)}
                  >
                    <div className="voice-card-main">
                      <div className="personality-radio">
                        <span className={`radio-dot ${isSelected ? 'selected' : ''}`} />
                      </div>
                      <div className="voice-info">
                        <div className="voice-header-line">
                          <h4 className="voice-name">{v.name}</h4>
                          <span className={`voice-gender-badge ${v.gender === 'Femenino' ? 'female' : 'male'}`}>
                            {v.gender}
                          </span>
                        </div>
                        <p className="voice-style">{v.style}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`voice-preview-btn ${isPlaying ? 'playing' : ''}`}
                      title={isPlaying ? "Detener muestra" : `Escuchar muestra de ${v.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayVoicePreview) {
                          onPlayVoicePreview(v.id, v.sampleText);
                        }
                      }}
                    >
                      {isPlaying ? (
                        <>
                          <Square size={13} fill="currentColor" />
                          <span>Detener</span>
                        </>
                      ) : (
                        <>
                          <Play size={13} fill="currentColor" />
                          <span>Probar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
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
