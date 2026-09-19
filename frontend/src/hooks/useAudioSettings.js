import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook modular para gestion de configuraciones de audio, preferencias de locucion y preview de voces.
 * Persiste los parametros en localStorage.
 */
export default function useAudioSettings() {
  const [frequency, setFrequencyState] = useState(() => {
    const saved = localStorage.getItem('dj_frequency');
    return saved !== null ? Number(saved) : 5;
  });
  const [personality, setPersonalityState] = useState(() => {
    return localStorage.getItem('dj_personality') || 'chill';
  });
  const [crossfade, setCrossfadeState] = useState(() => {
    return localStorage.getItem('dj_crossfade') !== 'false';
  });
  const [autoPauseOnTabChange, setAutoPauseOnTabChangeState] = useState(() => {
    return localStorage.getItem('dj_auto_pause_tab') === 'true';
  });
  const [duckingVolume, setDuckingVolumeState] = useState(() => {
    const saved = localStorage.getItem('dj_ducking_volume');
    return saved !== null ? Number(saved) : 20;
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const frequencyRef = useRef(frequency);
  const personalityRef = useRef(personality);
  const crossfadeRef = useRef(crossfade);
  const autoPauseOnTabChangeRef = useRef(autoPauseOnTabChange);
  const duckingVolumeRef = useRef(duckingVolume);
  const wasPlayingBeforeAutoPauseRef = useRef(false);
  const wasDJSpeakingBeforeAutoPauseRef = useRef(false);
  const wasSpeechSpeakingBeforeAutoPauseRef = useRef(false);
  const tabIdRef = useRef(`tab_${Math.random().toString(36).slice(2, 9)}`);
  const broadcastChannelRef = useRef(null);

  const setFrequency = useCallback((val) => {
    setFrequencyState(val);
    frequencyRef.current = val;
    localStorage.setItem('dj_frequency', val);
  }, []);

  const setPersonality = useCallback((val) => {
    setPersonalityState(val);
    personalityRef.current = val;
    localStorage.setItem('dj_personality', val);
  }, []);

  const setCrossfade = useCallback((val) => {
    setCrossfadeState(val);
    crossfadeRef.current = val;
    localStorage.setItem('dj_crossfade', val);
  }, []);

  const setAutoPauseOnTabChange = useCallback((val) => {
    setAutoPauseOnTabChangeState(val);
    autoPauseOnTabChangeRef.current = val;
    localStorage.setItem('dj_auto_pause_tab', val);
    if (!val) {
      wasPlayingBeforeAutoPauseRef.current = false;
      wasDJSpeakingBeforeAutoPauseRef.current = false;
      wasSpeechSpeakingBeforeAutoPauseRef.current = false;
    }
  }, []);

  const setDuckingVolume = useCallback((val) => {
    const num = Math.max(0, Math.min(100, Number(val)));
    setDuckingVolumeState(num);
    duckingVolumeRef.current = num;
    localStorage.setItem('dj_ducking_volume', num);
  }, []);

  // Seleccion y preview de voz de locutor (ElevenLabs)
  const [selectedVoice, setSelectedVoiceState] = useState(() => {
    return localStorage.getItem('dj_voice_id') || 'IKne3meq5aSn9XLyUdCD';
  });
  const selectedVoiceRef = useRef(selectedVoice);

  const setSelectedVoice = useCallback((val) => {
    setSelectedVoiceState(val);
    selectedVoiceRef.current = val;
    localStorage.setItem('dj_voice_id', val);
  }, []);

  const [playingPreviewVoiceId, setPlayingPreviewVoiceId] = useState(null);
  const previewAudioRef = useRef(null);

  const handlePlayVoicePreview = useCallback(async (voiceId, previewText) => {
    if (previewAudioRef.current) {
      try { previewAudioRef.current.pause(); } catch (e) {}
      previewAudioRef.current = null;
    }

    if (playingPreviewVoiceId === voiceId) {
      setPlayingPreviewVoiceId(null);
      return;
    }

    setPlayingPreviewVoiceId(voiceId);

    try {
      const res = await fetch('http://127.0.0.1:3001/api/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice_id: voiceId, text: previewText })
      });
      const data = await res.json();
      if (data && data.audioUrl) {
        const audio = new Audio(`http://127.0.0.1:3001${data.audioUrl}`);
        previewAudioRef.current = audio;
        audio.onended = () => {
          setPlayingPreviewVoiceId(null);
          previewAudioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingPreviewVoiceId(null);
          previewAudioRef.current = null;
        };
        await audio.play();
      } else {
        setPlayingPreviewVoiceId(null);
      }
    } catch (err) {
      console.error("Error reproduciendo muestra de voz:", err);
      setPlayingPreviewVoiceId(null);
    }
  }, [playingPreviewVoiceId]);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        try { previewAudioRef.current.pause(); } catch (e) {}
        previewAudioRef.current = null;
      }
    };
  }, []);

  return {
    frequency,
    setFrequency,
    personality,
    setPersonality,
    crossfade,
    setCrossfade,
    autoPauseOnTabChange,
    setAutoPauseOnTabChange,
    duckingVolume,
    setDuckingVolume,
    isSettingsOpen,
    setIsSettingsOpen,
    selectedVoice,
    setSelectedVoice,
    playingPreviewVoiceId,
    handlePlayVoicePreview,
    // Refs para sincronizacion sin re-renders en timers
    frequencyRef,
    personalityRef,
    crossfadeRef,
    autoPauseOnTabChangeRef,
    duckingVolumeRef,
    selectedVoiceRef,
    wasPlayingBeforeAutoPauseRef,
    wasDJSpeakingBeforeAutoPauseRef,
    wasSpeechSpeakingBeforeAutoPauseRef,
    tabIdRef,
    broadcastChannelRef
  };
}
