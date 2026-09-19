const axios = require('axios');
const { PYTHON_SERVICE_URL, DJ_INTRODUCE_SONG_PROMPT, OPENROUTER_API_KEY } = require('../config/constants');
const { getDJDecision } = require('../services/djService');
const { generateTTS } = require('../services/ttsService');
const chatState = require('./chatState');

const {
  preloadSongLyrics,
  handleLyrics,
  handleTranslateLyrics,
  handleTrivia,
  handleExportPlaylist,
  handleFallbackVideo
} = require('./mediaController');

const {
  handleGetCurrentSession,
  handleSaveSession,
  handleResetSession,
  handleGetSessions,
  handleLoadSession,
  handleCreateSession,
  handleRenameSession,
  handleDeleteSession
} = require('./sessionController');

const {
  handleGetTasteProfile,
  handleSaveTasteProfile
} = require('./profileController');

const {
  handleGetFavorites,
  handleGetFavoriteCount,
  handleRecordHistory
} = require('./favoritesController');

function getTimeContext(userTimeZone) {
  const tz = userTimeZone || process.env.TZ || 'America/Guatemala';
  const now = new Date();

  let hours = now.getHours();
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hourCycle: 'h23',
      timeZone: tz
    }).format(now);
    hours = parseInt(hourStr, 10);
  } catch (e) {
    console.warn("Error resolviendo hora en zona horaria:", tz, e.message);
  }

  let period = "Madrugada";
  if (hours >= 6 && hours < 12) period = "Mañana";
  else if (hours >= 12 && hours < 14) period = "Mediodía";
  else if (hours >= 14 && hours < 19) period = "Tarde";
  else if (hours >= 19 && hours <= 23) period = "Noche";

  let formatted = "";
  try {
    const timeFormatter = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz
    });
    formatted = timeFormatter.format(now);
  } catch (e) {
    formatted = `${hours}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  return `${formatted} (${period}). OBLIGATORIO: Son las ${hours}h (${period}). NO uses saludos de 'noche' si el periodo es ${period}`;
}

function isTriviaOrConversation(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  
  // Si pide explícitamente reproducir/cambiar, saltar o da dislike, JAMÁS es trivia
  if (
    /\b(?:pon|ponme|reproduce|toca|cambia|salta|next|play|dislike|no\s+me\s+gusta|otra|siguiente)\b/i.test(t) ||
    /\b(?:quiero\s+escuchar|quiero\s+o[ií]r|busca|b[uú]scame)\b/i.test(t)
  ) {
    return false;
  }

  // Si pide curiosidades, datos, anécdotas, información, preguntas
  if (
    /\b(?:curiosidad|curiosidades|trivia|dato|datos|an[eé]cdota|historia)\b/i.test(t) ||
    /\b(?:cu[eé]ntame\s+m[aá]s|h[aá]blame\s+de|qu[eé]\s+sabes|de\s+qu[eé]\s+trata)\b/i.test(t) ||
    /\b(?:qui[eé]n\s+(?:es|fue|escribi[oó]|compuso|canta)|cu[aá]ndo\s+sali[oó]|en\s+qu[eé]\s+a[nñ]o)\b/i.test(t) ||
    /\b(?:qu[eé]\s+significa|por\s+qu[eé]\s+se\s+llama)\b/i.test(t)
  ) {
    return true;
  }

  return false;
}

function isSameSong(songA, songB) {
  if (!songA || !songB) return false;
  if (songA.videoId && songB.videoId && songA.videoId === songB.videoId) return true;
  const clean = (str) => (str || '')
    .replace(/[\(\[].*?[\)\]]/g, '')
    .replace(/\b(?:feat|ft)\.?\s+.*$/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const titleA = clean(songA.title);
  const titleB = clean(songB.title);
  return !!(titleA && titleB && titleA === titleB);
}

function isPureNextRequest(text) {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  
  // Si es consulta de curiosidad o conversación, jamás saltar canción
  if (isTriviaOrConversation(t)) {
    return false;
  }

  if (
    t === 'siguiente canción dj.' ||
    t === 'siguiente' ||
    t === 'next' ||
    t === 'salta' ||
    t === 'siguiente cancion' ||
    t === 'otra cancion' ||
    t.includes('he dado dislike') ||
    t.includes('siguiente canción dj') ||
    t === 'dislike' ||
    t === 'no me gusta'
  ) {
    return true;
  }
  if (/cambia\s+a|pon\b|quiero\b|escuchar\b|reproduce\b|toca\b/i.test(t)) {
    return false;
  }
  return /^(siguiente|next|salta|pasa)(?:\s+(?:canci[oó]n|tema|rola|track|porfa|dj))?$/i.test(t);
}

function parseMultipleSongs(text) {
  if (!text) return [];
  let clean = text.replace(/^(?:pon(?:me)?|reproduce|toca|quiero\s+escuchar|quiero\s+o[ií]r|lista(?:\s+de\s+canciones)?(?:\s*:)?)\s+/i, '').trim();
  clean = clean.replace(/^[0-9]+\.\s*/, '');
  // Separar por "+", saltos de línea, comas (con o sin "y"), o " y "
  let parts = clean.split(/(?:\r?\n|\s*\+\s*|\s*,\s*(?:y\s+|and\s+)?|\s+(?:y|and)\s+|(?:\s+[0-9]+\.\s+))/i);
  return parts
    .map(p => p.replace(/^(?:y|and)\s+/i, '').trim())
    .filter(p => p.length > 1 && !/^(?:y|and|canciones|cancion|rola)$/i.test(p));
}

function isPureArtistRequest(text, detectedArtist) {
  if (!text) return false;
  const clean = text
    .toLowerCase()
    .replace(/^(?:pon(?:me)?|reproduce|toca|quiero\s+escuchar|quiero\s+o[ií]r|m[uú]sica\s+de|solo|sesi[oó]n\s+de|pon\s+a)\s+/i, '')
    .replace(/[.?!,]/g, '')
    .trim();
  if (!clean) return false;
  if (detectedArtist && clean === detectedArtist.toLowerCase().trim()) return true;
  // Si no contiene palabras o conectores de canción ("de", "por", "feat", "-", "album") y es corto
  if (!/\b(?:de|por|feat|ft|-|album|álbum|cancion|canción|rola)\b/i.test(clean)) {
    if (detectedArtist && (detectedArtist.toLowerCase().includes(clean) || clean.includes(detectedArtist.toLowerCase()))) {
      return true;
    }
    if (clean.split(/\s+/).length <= 3 && detectedArtist) {
      return true;
    }
  }
  return false;
}

async function handleChat(req, res) {
  const { message, currentSong, searchType, personality = 'chill', frequency = 5, timeZone, session_id, taste_profile, voice_id } = req.body;
  const targetFrequency = Number(frequency) >= 0 ? Number(frequency) : 5;
  const timeContext = getTimeContext(timeZone);
  
  try {
    const statusRes = await axios.get(`${PYTHON_SERVICE_URL}/status`);
    const isLogged = statusRes.data.status !== "invitado";
    
    let musicHistory = [];
    if (isLogged) {
      try {
        const historyRes = await axios.get(`${PYTHON_SERVICE_URL}/history?limit=10`);
        musicHistory = historyRes.data || [];
      } catch (hErr) {
        console.error("Error cargando historial de música:", hErr.message);
      }
    }

    const historyContext = musicHistory.length > 0 
      ? musicHistory.map(h => `${h.title} - ${h.artists?.[0]?.name || h.artist}`).join(', ')
      : "No hay historial";

    let userTaste = taste_profile;
    if (!userTaste) {
      try {
        const tasteRes = await axios.get(`${PYTHON_SERVICE_URL}/profile/taste`);
        userTaste = tasteRes.data;
      } catch (tErr) {
        // Ignorable si el servicio aún no responde
      }
    }

    let tasteContext = '';
    if (userTaste) {
      const favArtists = Array.isArray(userTaste.favorite_artists) && userTaste.favorite_artists.length > 0
        ? userTaste.favorite_artists.join(', ') : 'Ninguno especificado';
      const favSongs = Array.isArray(userTaste.favorite_songs) && userTaste.favorite_songs.length > 0
        ? userTaste.favorite_songs.map(s => typeof s === 'object' ? `${s.title}${s.artist ? ' (' + s.artist + ')' : ''}` : s).join(', ') : 'Ninguna especificada';
      const favGenres = Array.isArray(userTaste.favorite_genres) && userTaste.favorite_genres.length > 0
        ? userTaste.favorite_genres.join(', ') : 'Ninguno especificado';
      
      const disArtists = Array.isArray(userTaste.disliked_artists) && userTaste.disliked_artists.length > 0
        ? userTaste.disliked_artists.join(', ') : 'Ninguno';
      const disSongs = Array.isArray(userTaste.disliked_songs) && userTaste.disliked_songs.length > 0
        ? userTaste.disliked_songs.map(s => typeof s === 'object' ? `${s.title}${s.artist ? ' (' + s.artist + ')' : ''}` : s).join(', ') : 'Ninguna';
      const disGenres = Array.isArray(userTaste.disliked_genres) && userTaste.disliked_genres.length > 0
        ? userTaste.disliked_genres.join(', ') : 'Ninguno';

      tasteContext = `
PERFIL DE GUSTOS Y RESTRICCIONES DEL USUARIO:
- Artistas Favoritos: ${favArtists}
- Canciones Favoritas: ${favSongs}
- Géneros Favoritos: ${favGenres}
- Artistas Vetados/Prohibidos (JAMÁS poner ni sugerir): ${disArtists}
- Canciones Vetadas/Prohibidas (JAMÁS poner estas canciones específicas; si el artista está permitido, solo se prohíbe esta canción individual): ${disSongs}
- Géneros Vetados/Prohibidos (JAMÁS poner ni sugerir): ${disGenres}`;
    }

    let nextSong = null;
    let djComment = null;
    let audioUrl = null;

    // CASO 1: El usuario pide pasar a la siguiente canción de la cola (o fin de canción)
    if (isPureNextRequest(message)) {
      if (targetFrequency > 0 && chatState.count >= targetFrequency) {
        chatState.reset();
      } else {
        chatState.increment();
      }
      console.log(`[SESIÓN RADIO] Canción en sesión: ${chatState.count}/${targetFrequency || 'Solo Chat'}`);

      try {
        const searchRes = await axios.get(`${PYTHON_SERVICE_URL}/search`, { 
          params: { q: 'siguiente', type: 'song' } 
        });
        nextSong = searchRes.data;
        if (currentSong && isSameSong(nextSong, currentSong)) {
          console.warn(`[CHAT NEXT]: Siguiente tema "${nextSong?.title}" es idéntico al actual. Saltando al siguiente...`);
          const retryRes = await axios.get(`${PYTHON_SERVICE_URL}/search`, { 
            params: { q: 'siguiente', type: 'song' } 
          });
          nextSong = retryRes.data;
        }
      } catch (err) {
        console.error("Error obteniendo siguiente canción de Python:", err.message);
      }

      // Habla si targetFrequency > 0 y se alcanzó la cuota, O si fue una acción de dislike explícita
      const isDislike = /\b(?:dislike|no\s+me\s+gusta)\b/i.test(message);
      const shouldSpeak = (targetFrequency > 0 && chatState.count >= targetFrequency) || isDislike;

      if (shouldSpeak && nextSong && nextSong.title) {
        chatState.resetToZero(); // Reiniciar contador de sesión
        const songArtist = nextSong.artist || nextSong.artists?.[0]?.name || 'el artista';
        let prompt = `MODO: ${isLogged ? 'LOGUEADO' : 'INVITADO'}. Presenta el bloque con la siguiente canción: "${nextSong.title}" de "${songArtist}".`;
        if (isDislike) {
          prompt = `MODO: ${isLogged ? 'LOGUEADO' : 'INVITADO'}. El oyente descartó la canción anterior. En máximo 15 palabras, confirma relajadamente que cambiaste y presenta de una vez: "${nextSong.title}" de "${songArtist}".`;
        }

        const introPrompt = DJ_INTRODUCE_SONG_PROMPT(
          nextSong.title, 
          songArtist, 
          currentSong?.title, 
          currentSong?.artist,
          { personality, timeContext, includeTrivia: !isDislike }
        );
        
        const djDecision = await getDJDecision(prompt, introPrompt);
        djComment = djDecision?.locucion || (isDislike
          ? `¡Sin problema! Dejamos esa atrás y seguimos con ${nextSong.title} de ${songArtist}.`
          : `¡Seguimos con ${songArtist} y su tema ${nextSong.title}!`);
        audioUrl = await generateTTS(djComment, voice_id);
      }

      return res.json({ dj_comment: djComment, audioUrl, nextSong });
    }

    // CASO 1.5: Peticion de retroceso a cancion anterior (sin consumo de IA ni busqueda en YouTube)
    const isPreviousIntent = /^(?:(?:ir\s+a\s+la\s+|pon(?:me)?\s+(?:la\s+)?)?(?:canci[oó]n\s+)?(?:anterior|previa)|regresa(?:r)?|vuelve(?:\s+a\s+la\s+anterior)?|atr[aá]s)$/i.test((message || '').trim());
    if (isPreviousIntent) {
      console.log("[CHAT]: Peticion de cancion anterior detectada. Retornando accion previa directa sin consumo de IA.");
      return res.json({
        action: 'previous',
        dj_comment: 'Regresando a la cancion anterior.',
        skip_ai: true
      });
    }

    // CASO 2: Petición musical explícita o conversación en el chat
    let modeInstruction = '';
    if (searchType === 'artist') {
      modeInstruction = `ESTÁS EN MODO ARTISTA. El usuario desea escuchar canciones EXCLUSIVAS de este artista durante toda la sesión. Identifica qué artista solicita (o qué artista encaja). En "artista" y "busqueda", pon ÚNICAMENTE el nombre del artista (ej: "Frank Ocean", "Coldplay", "Mac Miller"). Tu locución debe anunciar una sesión o bloque especial dedicado exclusivamente a ese artista.`;
    } else if (searchType === 'album') {
      modeInstruction = `ESTÁS EN MODO ÁLBUM. El usuario desea escuchar un ÁLBUM completo. Identifica el álbum y su artista. En "album" y "busqueda", pon el nombre del álbum y artista (ej: "Blonde Frank Ocean"). Tu locución debe presentar el álbum.`;
    } else if (searchType === 'playlist') {
      modeInstruction = `ESTÁS EN MODO PLAYLIST. El usuario desea escuchar una PLAYLIST temática. En "playlist" y "busqueda", pon el concepto o nombre de la playlist (ej: "R&B Chill", "Rock Clásico"). Tu locución debe presentar la playlist.`;
    } else {
      modeInstruction = `ESTÁS EN MODO CANCIÓN. En "busqueda", pon artista y canción (ej: "Coldplay Yellow").`;
    }

    const prompt = `MODO: ${isLogged ? 'LOGUEADO' : 'INVITADO'}.
Contexto temporal: ${timeContext}.
Estilo de locución al hablar: ${personality} (ATENCIÓN: Tu estilo de locutor SOLO define el tono de tu voz al hablar, NUNCA altera la música ni el género a reproducir).
Usuario dice: "${message}".
${modeInstruction}
Sonando ahora: ${currentSong ? `${currentSong.title} - ${currentSong.artist}` : 'Nada'}.
Historial reciente: ${historyContext}.${tasteContext}
REGLAS OBLIGATORIAS:
1. TIEMPO EXACTO: Si saludas o haces referencia al momento del día, básate ESTRICTAMENTE en "${timeContext}". Si el periodo es Tarde o Mediodía, JAMÁS digas 'en esta noche' ni 'buenas noches'.
2. RECOMENDACIONES Y SUGERENCIAS ("recomiéndame algo", "sorpréndeme", "pon algo bueno", etc.):
   - Prioriza basarte en los Artistas Favoritos, Canciones Favoritas y Géneros Favoritos del perfil de gustos del usuario, o en temas afines al historial reciente.
   - Tu nivel de energía o personalidad (${personality}) NUNCA debe desviar el estilo musical ni imponer géneros ajenos al gusto demostrado por el oyente. La energía solo modula tus palabras.
3. COHERENCIA MUSICAL: Si el usuario menciona múltiples artistas o un estilo, elige una canción representativa del mismo género. Tu locución debe nombrar ÚNICAMENTE al artista que pongas en "busqueda".
4. PETICIÓN DIRECTA: Si el usuario pide poner una canción (ej: "pon...", "reproduce...", "toca..."), pon SIEMPRE cambiar_cancion: true y busca la canción solicitada. Su orden directa tiene prioridad absoluta sobre la lista de vetados.
5. RESTRICCIONES Y VETOS ESTRICTOS:
   - Para recomendaciones, sugerencias abiertas ("recomiéndame algo", "sorpréndeme") o cuando tú elijas la música, JAMÁS elijas, busques ni sugieras artistas, canciones o géneros que figuren como Vetados/Prohibidos en el perfil de gustos.
   - EXCEPCIÓN DE PETICIÓN DIRECTA: Si el usuario te pide explícitamente una canción o artista que está en su lista de vetados, complácelo y búscala de inmediato. En tu locución puedes mencionar brevemente y con frescura que aunque la tenía en su lista negra, sus órdenes mandan en la cabina.`;

    let djDecision = await getDJDecision(prompt);
    
    if (!djDecision) {
      djDecision = { locucion: "¡Aquí tienes música para seguir con la vibra!", busqueda: message, cambiar_cancion: true };
    }

    djComment = djDecision.locucion;

    const isQuestionOrTrivia = isTriviaOrConversation(message);
    let shouldChangeSong = !isQuestionOrTrivia && (djDecision.cambiar_cancion !== false) && !!djDecision.busqueda && djDecision.busqueda.trim() !== '';

    // Salvaguarda: Si el usuario dio dislike o pidió música explícitamente, SIEMPRE debe cambiar de canción
    if (!isQuestionOrTrivia && /\b(?:dislike|no\s+me\s+gusta|cambia|pon|ponme|reproduce|salta|otra|siguiente)\b/i.test(message)) {
      shouldChangeSong = true;
      if (!djDecision.busqueda || djDecision.busqueda.trim() === '' || /ya\s+la\s+tienes/i.test(djComment)) {
        const cleanedUserSearch = message
          .replace(/^(?:pon(?:me)?|reproduce|toca|cambia\s+a|quiero\s+escuchar|quiero\s+o[ií]r)\s+/i, '')
          .replace(/[.?!,]/g, '')
          .trim();
        djDecision.busqueda = cleanedUserSearch || djDecision.artista || djDecision.cancion || (searchType === 'artist' ? 'Frank Ocean' : 'canciones recomendadas');
        if (/ya\s+la\s+tienes/i.test(djComment)) {
          djComment = `¡Marchando de nuevo "${djDecision.busqueda}" para ti!`;
        }
      }
    }

    // Detectar si el mensaje contiene un link de YouTube o YouTube Music (playlist o video)
    const urlMatch = message ? message.match(/https?:\/\/(?:www\.|music\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i) : null;
    if (urlMatch) {
      djDecision.busqueda = urlMatch[0];
      shouldChangeSong = true;
      if (!djDecision.locucion || djDecision.locucion.trim() === '') {
        djComment = "¡Claro que sí! Conectando tu enlace directo para que suene de inmediato.";
      }
    }

    console.log(`DJ (${searchType || 'song'}): ¿Cambiar música? ${shouldChangeSong ? 'SÍ (' + djDecision.busqueda + ')' : 'NO (respondiendo en chat sin cambiar)'} -> Locución inicial: "${djComment}"`);

    if (shouldChangeSong) {
      chatState.reset(); // La primera canción del nuevo bloque empieza en 1
      console.log(`[SESIÓN RADIO] Canción en sesión: 1/${targetFrequency || 'Solo Chat'}`);
      
      // CASO A: Lista de canciones múltiples solicitadas por el usuario (desde IA o fallback del texto)
      let candidateSongs = Array.isArray(djDecision.canciones) && djDecision.canciones.length >= 2
        ? djDecision.canciones
        : parseMultipleSongs(message);

      if (Array.isArray(candidateSongs) && candidateSongs.length >= 2) {
        try {
          console.log(`[CHAT MULTI-SONGS]: Detectadas ${candidateSongs.length} canciones para encolar:`, candidateSongs);
          const batchRes = await axios.post(`${PYTHON_SERVICE_URL}/queue/batch-songs`, {
            songs: candidateSongs,
            source_name: `Tus ${candidateSongs.length} canciones pedidas`
          });
          if (batchRes.data && batchRes.data.currentSong) {
            nextSong = batchRes.data.currentSong;
          }
        } catch (bErr) {
          console.error("Error en batch-songs de Python:", bErr.message);
        }
      }

      // CASO B: Si no fue lista múltiple (o falló), proceder con búsqueda estándar
      let finalType = searchType || 'song';
      if (!nextSong || !nextSong.videoId) {
        let searchQuery = djDecision.busqueda;

        const isArtistReq = searchType === 'artist' ||
          (Array.isArray(djDecision.artistas) && djDecision.artistas.length >= 2) ||
          isPureArtistRequest(message, djDecision.artista) ||
          (djDecision.artista && (!djDecision.cancion || djDecision.cancion.trim() === ''));

        if (urlMatch) {
          searchQuery = urlMatch[0];
        } else if (Array.isArray(djDecision.artistas) && djDecision.artistas.length >= 2) {
          searchQuery = djDecision.artistas.join(', ');
          finalType = 'artist';
        } else if (searchType === 'album' || djDecision.album) {
          searchQuery = djDecision.album || djDecision.busqueda;
          finalType = 'album';
        } else if (searchType === 'playlist' || djDecision.playlist) {
          searchQuery = djDecision.playlist || djDecision.busqueda;
          finalType = 'playlist';
        } else if (isArtistReq) {
          searchQuery = djDecision.artista || djDecision.busqueda || message;
          finalType = 'artist';
        } else {
          finalType = 'song';
          if (djDecision.cancion && djDecision.artista) {
            searchQuery = `${djDecision.cancion} ${djDecision.artista}`;
          } else if (djDecision.cancion) {
            searchQuery = djDecision.cancion;
          } else {
            searchQuery = djDecision.busqueda || message;
          }
        }

        try {
          console.log(`[CHAT SEARCH]: Buscando en YouTube Music: query="${searchQuery}" (tipo=${finalType})`);
          const searchRes = await axios.get(`${PYTHON_SERVICE_URL}/search`, { 
            params: { q: searchQuery, type: finalType, force: true } 
          });
          nextSong = searchRes.data;
        } catch (err) {
          console.error("Error en search_song:", err.message);
        }
      }

      if (nextSong && nextSong.videoId) {
        const realTitle = nextSong.title;
        const realArtist = nextSong.artist || nextSong.artists?.[0]?.name || '';

        // Sincronizar locución con la canción REALMENTE devuelta por YouTube
        if (finalType === 'artist') {
          if (djDecision.cancion && !realTitle.toLowerCase().includes(djDecision.cancion.toLowerCase())) {
            djComment = `¡Conectamos con una sesión especial de ${realArtist}! Arrancamos con "${realTitle}".`;
          }
        } else if (djDecision.cancion && !realTitle.toLowerCase().includes(djDecision.cancion.toLowerCase())) {
          djComment = `¡Aquí tienes "${realTitle}" de ${realArtist}!`;
        }

        // Generar locución de voz después de confirmar la canción real
        audioUrl = await generateTTS(djComment, voice_id);

        // Precargar letras de inmediato para que la primera canción también tenga traducción lista
        preloadSongLyrics(nextSong.videoId, nextSong.title, nextSong.artist).catch(() => {});

        // Registrar petición del usuario en el contador de canciones favoritas en repetición
        try {
          const favRes = await axios.post(`${PYTHON_SERVICE_URL}/favorites/track-request`, {
            video_id: nextSong.videoId,
            title: nextSong.title,
            artist: nextSong.artist,
            session_id: session_id || null
          }, { timeout: 3000 });
          nextSong.repeatCount = favRes.data?.session_total_count || favRes.data?.total_count || 1;
          nextSong.globalRepeatCount = favRes.data?.total_count || 1;
        } catch (fErr) {
          nextSong.repeatCount = 1;
          nextSong.globalRepeatCount = 1;
        }
      } else {
        audioUrl = await generateTTS(djComment, voice_id);
      }
    } else {
      nextSong = null;
      audioUrl = await generateTTS(djComment, voice_id);
    }

    res.json({ 
      dj_comment: djComment, 
      audioUrl, 
      nextSong 
    });

  } catch (error) {
    console.error("Error en controller chat:", error.message);
    res.status(500).json({ error: 'Server Error' });
  }
}

// Endpoint para precargar la siguiente canción a los últimos 30 segundos
async function handlePreload(req, res) {
  const { currentSong, personality = 'chill', frequency = 5, timeZone, voice_id } = req.body;
  const targetFrequency = Number(frequency) >= 0 ? Number(frequency) : 5;
  const timeContext = getTimeContext(timeZone);

  try {
    const peekRes = await axios.get(`${PYTHON_SERVICE_URL}/queue/peek`);
    let candidate = peekRes.data?.nextSong;

    if (!candidate || !candidate.videoId) {
      return res.json({ nextSong: null });
    }

    // Salvaguarda: si candidate es idéntica a la canción actual, purgarla y obtener la siguiente
    if (isSameSong(candidate, currentSong)) {
      console.warn(`[PRELOAD]: Candidate "${candidate.title}" es idéntica a la actual "${currentSong?.title}". Purgando duplicado...`);
      await axios.post(`${PYTHON_SERVICE_URL}/queue/pop`).catch(() => {});
      const retryPeek = await axios.get(`${PYTHON_SERVICE_URL}/queue/peek`);
      candidate = retryPeek.data?.nextSong;
      if (!candidate || !candidate.videoId || isSameSong(candidate, currentSong)) {
        return res.json({ nextSong: null });
      }
    }

    // Predecir si la siguiente canción alcanzará la cuota de sesión para hablar
    const willSpeak = targetFrequency > 0 && (chatState.count + 1) >= targetFrequency;
    let djComment = null;
    let audioUrl = null;

    if (willSpeak) {
      const songArtist = candidate.artist || candidate.artists?.[0]?.name || 'el artista';
      const introPrompt = DJ_INTRODUCE_SONG_PROMPT(
        candidate.title, 
        songArtist, 
        currentSong?.title, 
        currentSong?.artist,
        { personality, timeContext, includeTrivia: true }
      );
      const djDecision = await getDJDecision("Presenta el siguiente tema que cerrará el bloque", introPrompt);
      djComment = djDecision?.locucion || `¡A continuación, ${songArtist} con ${candidate.title}!`;
      audioUrl = await generateTTS(djComment, voice_id);
      console.log(`[PRELOAD CON VOZ Y TRIVIA]: "${candidate.title}" - ${songArtist}`);
    } else {
      console.log(`[PRELOAD SILENCIOSO - AHORRANDO ELEVENLABS]: "${candidate.title}" (${chatState.count + 1}/${targetFrequency || 'Solo Chat'})`);
    }

    // Precargar letras y traducción en segundo plano antes de que la canción comience a sonar
    preloadSongLyrics(candidate.videoId, candidate.title, candidate.artist).catch(() => {});

    res.json({
      nextSong: candidate,
      dj_comment: djComment,
      audioUrl,
      willSpeak
    });
  } catch (error) {
    console.error("Error en handlePreload:", error.message);
    res.status(500).json({ error: 'Error al precargar canción' });
  }
}

// Endpoint para registrar la transicion de cancion precargada y avanzar el contador
function handleSessionTransition(req, res) {
  const { song, spoke, frequency = 5, isBackTrack = false, isReplay = false } = req.body;
  const targetFrequency = Number(frequency) >= 0 ? Number(frequency) : 5;

  if (isBackTrack) {
    // Si retrocedemos en el historial, decrementamos la posicion en el bloque actual
    chatState.decrement();
    console.log(`[SESIÓN RADIO] Retroceso a "${song?.title || 'Tema'}": Posicion en bloque ${chatState.count}/${targetFrequency || 'Solo Chat'}`);
    return res.json({ count: chatState.count });
  }

  if (isReplay) {
    // Si re-avanzamos hacia una cancion que ya habia sido escuchada en este bloque, no inflamos el contador
    console.log(`[SESIÓN RADIO] Repeticion/avance hacia "${song?.title || 'Tema'}" ya escuchada: ${chatState.count}/${targetFrequency || 'Solo Chat'}`);
    return res.json({ count: chatState.count });
  }

  if (spoke) {
    chatState.resetToZero();
    console.log(`[SESIÓN RADIO] DJ intervino en "${song?.title || 'Tema'}". Proximo bloque comenzara en 1/${targetFrequency || 'Solo Chat'}`);
  } else {
    // Si ya alcanzo la cuota maxima de canciones del bloque y no hubo locucion, cicla a un nuevo bloque
    if (targetFrequency > 0 && chatState.count >= targetFrequency) {
      chatState.reset();
      console.log(`[SESIÓN RADIO] Bloque completado sin locucion. Nuevo ciclo comenzado con: "${song?.title || 'Tema'}" (1/${targetFrequency})`);
    } else {
      chatState.increment();
      console.log(`[SESIÓN RADIO] Cancion en sesion: ${song?.title || 'Tema'} (${chatState.count}/${targetFrequency || 'Solo Chat'})`);
    }
  }

  res.json({ count: chatState.count });
}

async function handleVoicePreview(req, res) {
  try {
    const { voice_id, text } = req.body;
    if (!voice_id || !text) {
      return res.status(400).json({ error: "voice_id y text son requeridos" });
    }
    const audioUrl = await generateTTS(text, voice_id);
    if (!audioUrl) {
      return res.status(500).json({ error: "No se pudo generar la muestra de voz" });
    }
    return res.json({ audioUrl });
  } catch (error) {
    console.error("Error en handleVoicePreview:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  handleChat,
  handlePreload,
  handleSessionTransition,
  handleVoicePreview,
  // Re-exportaciones para retrocompatibilidad total
  handleLyrics,
  handleTranslateLyrics,
  handleTrivia,
  handleExportPlaylist,
  handleFallbackVideo,
  handleGetCurrentSession,
  handleSaveSession,
  handleResetSession,
  handleGetSessions,
  handleLoadSession,
  handleCreateSession,
  handleRenameSession,
  handleDeleteSession,
  handleGetFavorites,
  handleGetFavoriteCount,
  handleRecordHistory,
  handleGetTasteProfile,
  handleSaveTasteProfile
};
