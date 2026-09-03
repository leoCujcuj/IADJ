import React from 'react';
import { Headphones, Loader2, Mic, MicOff, Send } from 'lucide-react';
import ChatBubble from './common/ChatBubble';

export default function ChatSection({
  chatHistory,
  loading,
  message,
  setMessage,
  isListening,
  toggleListening,
  searchType,
  setSearchType,
  isMenuOpen,
  setIsMenuOpen,
  sortedModes,
  activeMode,
  handleSendMessage,
  chatEndRef
}) {
  return (
    <section className="chat-section">
      <div className="chat-header">
        <Headphones size={18} />
        <span>DJ Booth</span>
      </div>
      <div className="chat-window">
        {chatHistory.map((msg, idx) => (
          <ChatBubble key={idx} msg={msg} />
        ))}
        {loading && (
          <div className="loading-indicator dj">
            <Loader2 className="spinner" size={16} />
            <span>DJ pensando...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <div 
          className={`mode-selector ${isMenuOpen ? 'expanded' : 'collapsed'}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {sortedModes.map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                className={`mode-btn ${searchType === mode.id ? 'active' : ''}`}
                onClick={(e) => {
                  if (isMenuOpen) {
                    e.stopPropagation();
                    setSearchType(mode.id);
                    setIsMenuOpen(false);
                  }
                }}
                title={mode.title}
              >
                <Icon size={18} />
              </button>
            );
          })}
        </div>
        
        <button 
          type="button" 
          className={`mic-btn ${isListening ? 'listening' : ''}`} 
          onClick={toggleListening}
          title={isListening ? "Detener micrófono" : "Hablar"}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <input 
          type="text" 
          value={message} 
          onChange={e => {
            if (isListening) {
              toggleListening();
            }
            setMessage(e.target.value);
          }} 
          placeholder={isListening ? "🎤 Escuchando... habla ahora..." : `Pedir ${activeMode?.placeholder || 'canción'}...`} 
        />
        <button type="submit" className="send-btn" disabled={loading}>
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
