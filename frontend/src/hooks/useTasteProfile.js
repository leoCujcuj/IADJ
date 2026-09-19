import { useState, useRef, useEffect, useCallback } from 'react';

const INITIAL_PROFILE = {
  favorite_artists: [],
  favorite_songs: [],
  favorite_genres: [],
  disliked_artists: [],
  disliked_songs: [],
  disliked_genres: []
};

/**
 * Hook modular para consulta, actualizacion y sincronizacion del perfil musical del usuario.
 */
export default function useTasteProfile() {
  const [tasteProfile, setTasteProfile] = useState(INITIAL_PROFILE);
  const [isTasteModalOpen, setIsTasteModalOpen] = useState(false);
  const [loadingTasteProfile, setLoadingTasteProfile] = useState(false);
  const tasteProfileRef = useRef(tasteProfile);

  useEffect(() => {
    tasteProfileRef.current = tasteProfile;
  }, [tasteProfile]);

  const fetchTasteProfile = useCallback(async () => {
    setLoadingTasteProfile(true);
    try {
      const res = await fetch('http://127.0.0.1:3001/api/profile/taste');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setTasteProfile({
            favorite_artists: data.favorite_artists || [],
            favorite_songs: data.favorite_songs || [],
            favorite_genres: data.favorite_genres || [],
            disliked_artists: data.disliked_artists || [],
            disliked_songs: data.disliked_songs || [],
            disliked_genres: data.disliked_genres || []
          });
        }
      }
    } catch (err) {
      console.warn("Error cargando perfil musical:", err);
    } finally {
      setLoadingTasteProfile(false);
    }
  }, []);

  const saveTasteProfile = useCallback(async (updatedProfile) => {
    setLoadingTasteProfile(true);
    try {
      const res = await fetch('http://127.0.0.1:3001/api/profile/taste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProfile)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.profile) {
          setTasteProfile(data.profile);
        }
        return data;
      }
    } catch (err) {
      console.error("Error guardando perfil musical:", err);
      throw err;
    } finally {
      setLoadingTasteProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchTasteProfile();
  }, [fetchTasteProfile]);

  return {
    tasteProfile,
    setTasteProfile,
    tasteProfileRef,
    isTasteModalOpen,
    setIsTasteModalOpen,
    loadingTasteProfile,
    fetchTasteProfile,
    saveTasteProfile
  };
}
