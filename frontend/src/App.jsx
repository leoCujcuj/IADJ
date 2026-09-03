import React from 'react';
import './App.css';
import Header from './components/Header';
import ChatSection from './components/ChatSection';
import PlayerCard from './components/PlayerCard';
import QueueSection from './components/QueueSection';
import SettingsModal from './components/SettingsModal';
import LyricsSidebar from './components/LyricsSidebar';
import TriviaModal from './components/TriviaModal';
import SessionsModal from './components/SessionsModal';
import ConfirmModal from './components/common/ConfirmModal';
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
    chatEndRef,
    frequency,
    setFrequency,
    personality,
    setPersonality,
    crossfade,
    setCrossfade,
    isSettingsOpen,
    setIsSettingsOpen,
    isLyricsOpen,
    setIsLyricsOpen,
    isTriviaOpen,
    setIsTriviaOpen,
    currentTrivia,
    loadingTrivia,
    handleOpenTrivia,
    handleAnotherTrivia,
    handleAskDJMore,
    handleShareTriviaToChat,
    handleExportPlaylist,
    sessionId,
    sessionStatus,
    sessionName,
    handleNewSession,
    isSessionsOpen,
    setIsSessionsOpen,
    sessionsList,
    handleSwitchSession,
    handleCreateSession,
    handleRenameSession,
    handleDeleteSession,
    modalDialog,
    showConfirm,
    showAlert,
    playerRef
  } = useDJRadio();

  return (
    <div className={`app-container ${isLyricsOpen ? 'with-lyrics-open' : ''}`}>
      <Header 
        isConnected={isConnected} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onExportPlaylist={handleExportPlaylist}
        sessionName={sessionName}
        onOpenSessions={() => setIsSessionsOpen(true)}
      />

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
              onOpenLyrics={() => setIsLyricsOpen(prev => !prev)}
              onOpenTrivia={handleOpenTrivia}
              loadingTrivia={loadingTrivia}
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

      <LyricsSidebar
        isOpen={isLyricsOpen}
        onClose={() => setIsLyricsOpen(false)}
        currentSong={currentSong}
        playerRef={playerRef}
      />

      <TriviaModal
        isOpen={isTriviaOpen}
        onClose={() => setIsTriviaOpen(false)}
        currentSong={currentSong}
        trivia={currentTrivia}
        loading={loadingTrivia}
        onAnotherTrivia={handleAnotherTrivia}
        onAskDJMore={handleAskDJMore}
        onShareToChat={handleShareTriviaToChat}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        frequency={frequency}
        setFrequency={setFrequency}
        personality={personality}
        setPersonality={setPersonality}
        crossfade={crossfade}
        setCrossfade={setCrossfade}
        sessionStatus={sessionStatus}
        sessionName={sessionName}
        onNewSession={handleNewSession}
      />

      <SessionsModal
        isOpen={isSessionsOpen}
        onClose={() => setIsSessionsOpen(false)}
        sessions={sessionsList}
        activeSessionId={sessionId}
        onSwitchSession={handleSwitchSession}
        onCreateSession={handleCreateSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        showConfirm={showConfirm}
        showAlert={showAlert}
      />

      {modalDialog && (
        <ConfirmModal
          isOpen={modalDialog.isOpen}
          title={modalDialog.title}
          message={modalDialog.message}
          type={modalDialog.type}
          confirmText={modalDialog.confirmText}
          cancelText={modalDialog.cancelText}
          isAlert={modalDialog.isAlert}
          onConfirm={modalDialog.onConfirm}
          onClose={modalDialog.onClose}
        />
      )}
    </div>
  );
}

export default App;
