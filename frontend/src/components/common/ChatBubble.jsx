import React from 'react';

export default function ChatBubble({ msg }) {
  return (
    <div className={`chat-bubble-container ${msg.sender}`}>
      <div className={`chat-bubble ${msg.sender}`}>
        <p>{msg.text}</p>
      </div>
    </div>
  );
}
