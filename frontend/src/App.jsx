import React from 'react';
import './App.css';
import Header from './components/Header';
import ChatSection from './components/ChatSection';
import PlayerCard from './components/PlayerCard';
import QueueSection from './components/QueueSection';
import useDJRadio from './hooks/useDJRadio';

function App() {
  const {
    message,
    setMessage,
    chatHistory,
    isMenuOpen,
    setIsMenuOpen,
    currentSong,
    loading,
    isListening,
    isConnected,
    queue,
    history,
    queueSource,
    manualSearch,
    setManualSearch,
    isLiked,
    isDisliked,
    searchType,
    setSearchType,
    sortedModes,
    activeMode,
    toggleListening,
    handleAddManual,
    handleMoveInQueue,
    handleRemoveFromQueue,
    handleSendMessage,
    handleNext,
    handleLike,
    handleDislike,
    chatEndRef
  } = useDJRadio();

  return (
    <div className="app-container">
      <Header isConnected={isConnected} />

      <main className="main-content">
        <ChatSection
          chatHistory={chatHistory}
          loading={loading}
          message={message}
          setMessage={setMessage}
          isListening={isListening}
          toggleListening={toggleListening}
          searchType={searchType}
          setSearchType={setSearchType}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          sortedModes={sortedModes}
          activeMode={activeMode}
          handleSendMessage={handleSendMessage}
          chatEndRef={chatEndRef}
        />
        
        <section className="player-section">
          <div className="player-wrapper">
            <PlayerCard
              currentSong={currentSong}
              isLiked={isLiked}
              isDisliked={isDisliked}
              handleLike={handleLike}
              handleDislike={handleDislike}
              handleNext={handleNext}
            />

            <QueueSection
              queue={queue}
              queueSource={queueSource}
              manualSearch={manualSearch}
              setManualSearch={setManualSearch}
              handleAddManual={handleAddManual}
              handleMoveInQueue={handleMoveInQueue}
              handleRemoveFromQueue={handleRemoveFromQueue}
              history={history}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
