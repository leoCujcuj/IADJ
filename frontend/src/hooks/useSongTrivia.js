import { useState, useRef, useCallback } from 'react';

/**
 * Hook modular para consulta y comparticion de curiosidades y trivias musicales.
 * Mantiene cache en memoria para evitar llamadas redundantes a la IA.
 */
export default function useSongTrivia({ currentSong, setMessage, setChatHistory }) {
  const [isTriviaOpen, setIsTriviaOpen] = useState(false);
  const [currentTrivia, setCurrentTrivia] = useState(null);
  const [loadingTrivia, setLoadingTrivia] = useState(false);
  const triviaCacheRef = useRef(new Map());

  const handleOpenTrivia = useCallback(async (isRefresh = false) => {
    if (!currentSong?.videoId) return;

    setIsTriviaOpen(true);

    if (!isRefresh && triviaCacheRef.current.has(currentSong.videoId)) {
      setCurrentTrivia(triviaCacheRef.current.get(currentSong.videoId));
      return;
    }

    setLoadingTrivia(true);

    try {
      const params = new URLSearchParams();
      if (currentSong.title) params.append('title', currentSong.title);
      if (currentSong.artist) params.append('artist', currentSong.artist);
      if (isRefresh) params.append('refresh', 'true');

      const res = await fetch(`http://127.0.0.1:3001/api/trivia/${currentSong.videoId}?${params.toString()}`);
      const data = await res.json();
      if (data && data.trivia) {
        triviaCacheRef.current.set(currentSong.videoId, data.trivia);
        setCurrentTrivia(data.trivia);
      } else {
        setCurrentTrivia('No se encontró información curiosa para este tema.');
      }
    } catch (err) {
      console.error('Error cargando curiosidades:', err);
      setCurrentTrivia('No se pudo cargar la curiosidad en este momento.');
    } finally {
      setLoadingTrivia(false);
    }
  }, [currentSong]);

  const handleAnotherTrivia = useCallback(() => {
    handleOpenTrivia(true);
  }, [handleOpenTrivia]);

  const handleAskDJMore = useCallback(() => {
    if (!currentSong) return;
    setIsTriviaOpen(false);
    const askText = `Cuéntame más curiosidades sobre ${currentSong.title} de ${currentSong.artist}.`;
    if (setMessage) {
      setMessage(askText);
    }
  }, [currentSong, setMessage]);

  const handleShareTriviaToChat = useCallback(() => {
    if (!currentTrivia || !currentSong) return;
    setIsTriviaOpen(false);
    if (setChatHistory) {
      setChatHistory(prev => [
        ...prev,
        { 
          sender: 'dj', 
          text: `Curiosidad sobre "${currentSong.title}" (${currentSong.artist}):\n${currentTrivia}` 
        }
      ]);
    }
  }, [currentTrivia, currentSong, setChatHistory]);

  return {
    isTriviaOpen,
    setIsTriviaOpen,
    currentTrivia,
    loadingTrivia,
    handleOpenTrivia,
    handleAnotherTrivia,
    handleAskDJMore,
    handleShareTriviaToChat
  };
}
