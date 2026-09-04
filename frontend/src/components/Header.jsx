import React from 'react';
import { Radio, Sliders, ListPlus, Flame } from 'lucide-react';
import StatusPill from './common/StatusPill';

export default function Header({ 
  isConnected, 
  onOpenSettings, 
  onExportPlaylist,
  sessionName = 'Sesión Principal',
  onOpenSessions,
  onOpenFavorites
}) {
  return (
    <header className="header">
      <div className="header-content">
        <Radio className="logo-icon" size={28} />
        <h1>Gemini Radio AI</h1>
      </div>
      
      <div className="header-actions">
        <button 
          className="header-action-btn favorites-header-btn"
          onClick={onOpenFavorites}
          title="Ver canciones favoritas en repetición"
        >
          <Flame size={19} className="flame-header-icon" />
          <span className="btn-label">En Repetición</span>
        </button>

        <button 
          className="header-action-btn session-action-btn"
          onClick={onOpenSessions}
          title="Cambiar o crear estaciones de radio"
        >
          <Radio size={19} className="session-icon-active" />
          <span className="btn-label">{sessionName || 'Emisoras'}</span>
        </button>

        <button 
          className="header-action-btn"
          onClick={onExportPlaylist}
          title="Exportar sesión de hoy como Playlist"
        >
          <ListPlus size={19} />
          <span className="btn-label">Guardar Playlist</span>
        </button>

        <button 
          className="header-action-btn"
          onClick={onOpenSettings}
          title="Ajustes de la Radio"
        >
          <Sliders size={19} />
          <span className="btn-label">Ajustes</span>
        </button>

        <StatusPill isConnected={isConnected} />
      </div>
    </header>
  );
}

