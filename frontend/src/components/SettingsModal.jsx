import React from 'react';
import { X, Volume2, Sparkles, Clock, Sliders } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  frequency,
  setFrequency,
  personality,
  setPersonality,
  crossfade,
  setCrossfade
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
            <p className="settings-desc">El tono y vibra de sus intervenciones:</p>
            <div className="personality-options">
              {[
                { id: 'chill', name: 'Chill / Nocturno', desc: 'Voz suave, pausada, íntima. Ideal para Neo-Soul, Lo-Fi y R&B.' },
                { id: 'energetic', name: 'Enérgico / Club', desc: 'Ritmo alto, festivo, animado y con mucha chispa.' },
                { id: 'curator', name: 'Melómano / Crítico', desc: 'Detalles de producción, datos curiosos e instrumentos.' }
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
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}
