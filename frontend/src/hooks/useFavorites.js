import { useState, useCallback } from 'react';

/**
 * Hook modular para gestion de canciones favoritas, repeticiones y acciones de Like/Dislike.
 */
export default function useFavorites({ currentSong, sessionId, syncStatus, handleSendMessage, onClearPreload }) {
  const [repeatCount, setRepeatCount] = useState(0);
  const [globalRepeatCount, setGlobalRepeatCount] = useState(0);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [favoritesList, setFavoritesList] = useState([]);
  const [sessionFavoritesList, setSessionFavoritesList] = useState([]);
  const [globalFavoritesList, setGlobalFavoritesList] = useState([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [dislikeStreak, setDislikeStreak] = useState(0);

  const fetchFavorites = useCallback(async (customSessionId = null) => {
    setLoadingFavorites(true);
    const targetSessionId = customSessionId || sessionId;
    try {
      const [sessionRes, globalRes] = await Promise.all([
        fetch(`http://127.0.0.1:3001/api/favorites/repeats?scope=session&session_id=${encodeURIComponent(targetSessionId)}`),
        fetch('http://127.0.0.1:3001/api/favorites/repeats?scope=general')
      ]);
      const sessionData = await sessionRes.json();
      const globalData = await globalRes.json();

      if (sessionData && Array.isArray(sessionData.favorites)) {
        setSessionFavoritesList(sessionData.favorites);
      } else {
        setSessionFavoritesList([]);
      }

      if (globalData && Array.isArray(globalData.favorites)) {
        setGlobalFavoritesList(globalData.favorites);
        setFavoritesList(globalData.favorites);
      } else {
        setGlobalFavoritesList([]);
        setFavoritesList([]);
      }
    } catch (e) {
      console.warn("Error cargando lista de favoritas en repetición:", e);
    } finally {
      setLoadingFavorites(false);
    }
  }, [sessionId]);

  const handleLike = useCallback(async () => {
    if (!currentSong || isLiked) return;
    setIsLiked(true);
    setDislikeStreak(0);
    setRepeatCount(prev => prev + 1);
    setGlobalRepeatCount(prev => prev + 1);
    try {
      const res = await fetch(`http://127.0.0.1:8000/like/${currentSong.videoId}?artist=${encodeURIComponent(currentSong.artist)}&current_title=${encodeURIComponent(currentSong.title)}&session_id=${encodeURIComponent(sessionId)}`, { 
        method: 'POST' 
      });
      const data = await res.json();
      if (data) {
        if (data.session_repeat_count !== undefined) {
          setRepeatCount(data.session_repeat_count);
        } else if (data.repeat_count !== undefined) {
          setRepeatCount(data.repeat_count);
        }
        if (data.global_repeat_count !== undefined) {
          setGlobalRepeatCount(data.global_repeat_count);
        }
      }
      if (syncStatus) {
        syncStatus();
      }
    } catch (e) { 
      setIsLiked(false); 
      setRepeatCount(prev => Math.max(0, prev - 1));
      setGlobalRepeatCount(prev => Math.max(0, prev - 1));
      console.error(e); 
    }
  }, [currentSong, isLiked, sessionId, syncStatus]);

  const handleDislike = useCallback(async () => {
    if (!currentSong || isDisliked) return;
    setIsDisliked(true);
    const newStreak = dislikeStreak + 1;
    setDislikeStreak(newStreak);

    if (onClearPreload) {
      onClearPreload();
    }

    try {
      await fetch(`http://127.0.0.1:8000/dislike/${currentSong.videoId}?artist=${encodeURIComponent(currentSong.artist)}`, { 
        method: 'POST' 
      });

      if (handleSendMessage) {
        if (newStreak >= 3) {
          handleSendMessage(null, "He dado dislike a varias canciones seguidas. DJ, cambia totalmente de estilo y recomiéndame algo diferente.");
          setDislikeStreak(0);
        } else {
          handleSendMessage(null, "He dado dislike. Siguiente canción DJ.");
        }
      }
    } catch (e) { 
      setIsDisliked(false); 
      console.error(e); 
    }
  }, [currentSong, isDisliked, dislikeStreak, handleSendMessage, onClearPreload]);

  return {
    repeatCount,
    setRepeatCount,
    globalRepeatCount,
    setGlobalRepeatCount,
    isFavoritesOpen,
    setIsFavoritesOpen,
    favoritesList,
    setFavoritesList,
    sessionFavoritesList,
    setSessionFavoritesList,
    globalFavoritesList,
    setGlobalFavoritesList,
    loadingFavorites,
    fetchFavorites,
    isLiked,
    setIsLiked,
    isDisliked,
    setIsDisliked,
    dislikeStreak,
    setDislikeStreak,
    handleLike,
    handleDislike
  };
}
