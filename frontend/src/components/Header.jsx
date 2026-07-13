import React from 'react';
import { Radio } from 'lucide-react';
import StatusPill from './common/StatusPill';

export default function Header({ isConnected }) {
  return (
    <header className="header">
      <div className="header-content">
        <Radio className="logo-icon" size={28} />
        <h1>Gemini Radio AI</h1>
      </div>
      <StatusPill isConnected={isConnected} />
    </header>
  );
}
