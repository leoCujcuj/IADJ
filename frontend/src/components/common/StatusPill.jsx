import React from 'react';
import { PlayCircle } from 'lucide-react';

export default function StatusPill({ isConnected }) {
  return (
    <div 
      className={`yt-status-pill ${isConnected ? 'connected' : ''}`}
      title={isConnected ? 'Conexión activa con YouTube / DJ' : 'DJ Desconectado'}
      aria-label={isConnected ? 'DJ Activo' : 'DJ Desconectado'}
    >
      <PlayCircle size={18} fill={isConnected ? "#1ed760" : "#FF0000"} color="#FFF" />
      <span className="status-pill-text">{isConnected ? 'Activo' : 'Desactivo'}</span>
    </div>
  );
}
