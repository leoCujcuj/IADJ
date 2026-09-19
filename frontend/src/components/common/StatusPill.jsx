import React from 'react';
import { PlayCircle } from 'lucide-react';

export default function StatusPill({ isConnected }) {
  return (
    <div className={`yt-status-pill ${isConnected ? 'connected' : ''}`}>
      <PlayCircle size={18} fill={isConnected ? "#1ed760" : "#FF0000"} color="#FFF" />
      <span>{isConnected ? 'Activo' : 'Desactivo'}</span>
    </div>
  );
}
