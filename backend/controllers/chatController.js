const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PYTHON_SERVICE_URL, DJ_INTRODUCE_SONG_PROMPT, OPENROUTER_API_KEY } = require('../config/constants');
const { getDJDecision } = require('../services/djService');
const { generateTTS } = require('../services/ttsService');

const lyricsCacheFolder = path.join(__dirname, '..', 'temp_audio', 'lyrics_cache');
if (!fs.existsSync(lyricsCacheFolder)) {
  fs.mkdirSync(lyricsCacheFolder, { recursive: true });
}

let songsSinceLastDJIntervention = 1;
const triviaCache = new Map();

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

async function handleChat(req, res) {
  const { message, currentSong, searchType, personality = 'chill', frequency = 5, timeZone } = req.body;
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

    let nextSong = null;
    let djComment = null;
    let audioUrl = null;

    // CASO 1: El usuario pide pasar a la siguiente canción de la cola (o fin de canción)
    if (isPureNextRequest(message)) {
      songsSinceLastDJIntervention++;
      console.log(`[SESIÓN RADIO] Canción en sesión: ${songsSinceLastDJIntervention}/${targetFrequency || 'Solo Chat'}`);

      try {
        const searchRes = await axios.get(`${PYTHON_SERVICE_URL}/search`, { 
          params: { q: 'siguiente', type: 'song' } 
        });
        nextSong = searchRes.data;
      } catch (err) {
        console.error("Error obteniendo siguiente canción de Python:", err.message);
      }

      // Habla si targetFrequency > 0 y se alcanzó la cuota, O si fue una acción de dislike explícita
      const isDislike = /\b(?:dislike|no\s+me\s+gusta)\b/i.test(message);
      const shouldSpeak = (targetFrequency > 0 && songsSinceLastDJIntervention >= targetFrequency) || isDislike;

      if (shouldSpeak && nextSong && nextSong.title) {
        songsSinceLastDJIntervention = 0; // Reiniciar contador de sesión
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
        audioUrl = await generateTTS(djComment);
      }

      return res.json({ dj_comment: djComment, audioUrl, nextSong });
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
Estilo de locutor: ${personality}.
Usuario dice: "${message}".
${modeInstruction}
Sonando ahora: ${currentSong ? `${currentSong.title} - ${currentSong.artist}` : 'Nada'}.
Historial reciente: ${historyContext}.
REGLAS OBLIGATORIAS:
1. TIEMPO EXACTO: Si saludas o haces referencia al momento del día, básate ESTRICTAMENTE en "${timeContext}". Si el periodo es Tarde o Mediodía, JAMÁS digas 'en esta noche' ni 'buenas noches'.
2. Sé musicalmente coherente. Si el usuario menciona múltiples artistas o un estilo, elige una canción representativa del mismo género. Tu locución debe nombrar ÚNICAMENTE al artista que pongas en "busqueda".
3. PETICIÓN DIRECTA: Si el usuario pide poner una canción (ej: "pon...", "reproduce...", "toca..."), pon SIEMPRE cambiar_cancion: true y busca la canción solicitada. JAMÁS digas 'ya la tienes puesta' ni rechaces ponerla, aunque sea la misma que suena ahora (el usuario puede estar pidiendo reiniciarla o desatascarla).`;

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

    console.log(`DJ (${searchType || 'song'}): ¿Cambiar música? ${shouldChangeSong ? 'SÍ (' + djDecision.busqueda + ')' : 'NO (respondiendo en chat sin cambiar)'} -> Locución: "${djComment}"`);

    audioUrl = await generateTTS(djComment);

    if (shouldChangeSong) {
      songsSinceLastDJIntervention = 1; // La primera canción del nuevo bloque empieza en 1
      console.log(`[SESIÓN RADIO] Canción en sesión: 1/${targetFrequency || 'Solo Chat'}`);
      
      let searchQuery = djDecision.busqueda;
      if (searchType === 'artist' && djDecision.artista) {
        searchQuery = djDecision.artista;
      } else if (searchType === 'album' && djDecision.album) {
        searchQuery = djDecision.album;
      } else if (searchType === 'playlist' && djDecision.playlist) {
        searchQuery = djDecision.playlist;
      }

      try {
        const searchRes = await axios.get(`${PYTHON_SERVICE_URL}/search`, { 
          params: { q: searchQuery, type: searchType || 'song' } 
        });
        nextSong = searchRes.data;
      } catch (err) {
        console.error("Error en search_song:", err.message);
      }

      if (nextSong && nextSong.videoId) {
        // Precargar letras de inmediato para que la primera canción también tenga traducción lista
        preloadSongLyrics(nextSong.videoId, nextSong.title, nextSong.artist).catch(() => {});

        // Registrar petición del usuario en el contador de canciones favoritas en repetición
        try {
          const favRes = await axios.post(`${PYTHON_SERVICE_URL}/favorites/track-request`, {
            video_id: nextSong.videoId,
            title: nextSong.title,
            artist: nextSong.artist
          }, { timeout: 3000 });
          nextSong.repeatCount = favRes.data?.total_count || 1;
        } catch (fErr) {
          nextSong.repeatCount = 1;
        }
      }
    } else {
      nextSong = null;
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
  const { currentSong, personality = 'chill', frequency = 5, timeZone } = req.body;
  const targetFrequency = Number(frequency) >= 0 ? Number(frequency) : 5;
  const timeContext = getTimeContext(timeZone);

  try {
    const peekRes = await axios.get(`${PYTHON_SERVICE_URL}/queue/peek`);
    const candidate = peekRes.data?.nextSong;

    if (!candidate || !candidate.videoId) {
      return res.json({ nextSong: null });
    }

    // Predecir si la siguiente canción alcanzará la cuota de sesión para hablar
    const willSpeak = targetFrequency > 0 && (songsSinceLastDJIntervention + 1) >= targetFrequency;
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
      audioUrl = await generateTTS(djComment);
      console.log(`[PRELOAD CON VOZ Y TRIVIA]: "${candidate.title}" - ${songArtist}`);
    } else {
      console.log(`[PRELOAD SILENCIOSO - AHORRANDO ELEVENLABS]: "${candidate.title}" (${songsSinceLastDJIntervention + 1}/${targetFrequency || 'Solo Chat'})`);
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

function parseLRCLines(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const hundredths = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const totalSeconds = minutes * 60 + seconds + hundredths;
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        result.push({ time: totalSeconds, text });
      }
    }
  }
  return result;
}

async function fastTranslateText(text) {
  try {
    const url = "https://translate.google.com/m?sl=auto&tl=es&q=" + encodeURIComponent(text);
    const res = await axios.get(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, 
      timeout: 5000 
    });
    const match = res.data.match(/<div class="result-container">(.*?)<\/div>/s);
    if (match) {
      return match[1]
        .replace(/<br\s*[\/]?>/gi, "\n")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    }
  } catch (err) {
    console.error("Error en fastTranslateText:", err.message);
  }
  return null;
}

async function translateLyrics(textArray, videoId) {
  if (!textArray || textArray.length === 0) return [];
  
  const cacheFile = path.join(lyricsCacheFolder, `${videoId}_es.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (Array.isArray(cached) && cached.length === textArray.length) {
        console.log(`[LYRICS CACHE HIT]: Letras traducidas para ${videoId} desde caché.`);
        return cached;
      }
    } catch (e) {}
  }

  try {
    // Usar etiquetas con índice exacto [0], [1], [2] para evitar cualquier desfasamiento de versos
    const taggedPayload = textArray.map((line, idx) => `[${idx}] ${line || ' '}`).join('\n');
    const translatedBlock = await fastTranslateText(taggedPayload);
    
    if (translatedBlock) {
      const resultMap = new Map();
      const lineRegex = /\[(\d+)\]\s*([^\[\n]*)/g;
      let match;
      while ((match = lineRegex.exec(translatedBlock)) !== null) {
        const index = parseInt(match[1], 10);
        const translatedText = match[2].trim();
        resultMap.set(index, translatedText);
      }

      // Reconstruir el array respetando exactamente el orden e índice original
      const alignedTranslations = textArray.map((originalLine, idx) => {
        if (!originalLine || !originalLine.trim()) return '';
        return resultMap.get(idx) || '';
      });

      fs.writeFileSync(cacheFile, JSON.stringify(alignedTranslations));
      console.log(`[LYRICS TRADUCIDAS ALINEADAS 1:1]: ${alignedTranslations.length} versos para ${videoId}`);
      return alignedTranslations;
    }
  } catch (err) {
    console.error("Error traduciendo letras:", err.message);
  }

  return [];
}

// Precarga en segundo plano de letras y traducción antes de que empiece a sonar la canción
async function preloadSongLyrics(videoId, title, artist) {
  if (!videoId) return;
  const cacheFile = path.join(lyricsCacheFolder, `${videoId}_es.json`);
  if (fs.existsSync(cacheFile)) return;

  console.log(`[PRELOAD LETRAS]: Precargando letras y traducción para ${title} - ${artist}...`);
  try {
    const cleanTitle = (title || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = (artist || '').split(/,|&|feat\./i)[0].trim();
    let lrcText = null;

    const lrcRes = await axios.get('https://lrclib.net/api/get', {
      params: { track_name: cleanTitle, artist_name: cleanArtist },
      timeout: 3000
    });
    if (lrcRes.data?.syncedLyrics) {
      lrcText = lrcRes.data.syncedLyrics;
    }

    if (lrcText) {
      const lines = parseLRCLines(lrcText);
      if (lines.length > 0) {
        await translateLyrics(lines.map(l => l.text), videoId);
        console.log(`[PRELOAD COMPLETO]: Traducción lista para ${title} antes de que comience.`);
      }
    }
  } catch (err) {
    console.warn(`[PRELOAD ERROR]: No se pudo precargar letra para ${title}:`, err.message);
  }
}

// Endpoint instantáneo para obtener letras (<200ms) sin bloquear
async function handleLyrics(req, res) {
  const { videoId } = req.params;
  const { title = '', artist = '' } = req.query;

  let syncedLyrics = null;
  let plainLyrics = null;
  let source = 'YouTube Music';
  let isSynced = false;

  // 1. Intentar obtener letras sincronizadas (Karaoke con timestamps) de LRCLIB
  if (title) {
    try {
      const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').trim();
      const cleanArtist = artist.split(/,|&|feat\./i)[0].trim();
      const lrcRes = await axios.get('https://lrclib.net/api/get', {
        params: { track_name: cleanTitle, artist_name: cleanArtist },
        timeout: 2500
      });

      if (lrcRes.data?.syncedLyrics) {
        syncedLyrics = lrcRes.data.syncedLyrics;
        plainLyrics = lrcRes.data.plainLyrics;
        source = 'Karaoke Sincronizado';
        isSynced = true;
      }
    } catch (e) {
      try {
        const searchRes = await axios.get('https://lrclib.net/api/search', {
          params: { q: `${title} ${artist}`.trim() },
          timeout: 2500
        });
        const match = searchRes.data?.find(item => item.syncedLyrics);
        if (match) {
          syncedLyrics = match.syncedLyrics;
          plainLyrics = match.plainLyrics;
          source = 'Karaoke Sincronizado';
          isSynced = true;
        }
      } catch (e2) {}
    }
  }

  // 2. Fallback a YouTube Music
  if (!syncedLyrics && !plainLyrics) {
    try {
      const lyricsRes = await axios.get(`${PYTHON_SERVICE_URL}/lyrics/${videoId}`, { timeout: 2500 });
      if (lyricsRes.data?.lyrics) {
        plainLyrics = lyricsRes.data.lyrics;
        source = 'YouTube Music';
      }
    } catch (error) {
      console.error("Error obteniendo letras de YouTube Music:", error.message);
    }
  }

  if (!syncedLyrics && !plainLyrics) {
    return res.json({ isSynced: false, plainLyrics: null });
  }

  // Verificar si ya hay traducciones en caché
  let cachedTranslations = null;
  const cacheFile = path.join(lyricsCacheFolder, `${videoId}_es.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      cachedTranslations = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {}
  }

  // 3. Respuesta ultra rápida con letras sincronizadas (si es primera canción y no hay caché, traducir de una vez en 400ms)
  if (isSynced && syncedLyrics) {
    const lines = parseLRCLines(syncedLyrics);
    if (!cachedTranslations && lines.length > 0) {
      cachedTranslations = await translateLyrics(lines.map(l => l.text), videoId);
    }
    const linesWithTranslation = lines.map((item, idx) => ({
      time: item.time,
      text: item.text,
      translation: (cachedTranslations && cachedTranslations[idx]) || null
    }));

    return res.json({
      isSynced: true,
      lines: linesWithTranslation,
      hasTranslation: Array.isArray(cachedTranslations) && cachedTranslations.length > 0,
      source
    });
  }

  // 4. Respuesta ultra rápida con letras planas
  if (plainLyrics) {
    const splitLines = plainLyrics.split('\n');
    if (!cachedTranslations) {
      const nonEmpties = splitLines.filter(l => l.trim().length > 0);
      cachedTranslations = await translateLyrics(nonEmpties, videoId);
    }
    let transIdx = 0;
    const plainWithTranslation = splitLines.map(line => {
      if (!line.trim()) return { text: '', translation: '' };
      const trans = (cachedTranslations && cachedTranslations[transIdx]) || null;
      transIdx++;
      return { text: line, translation: trans };
    });

    return res.json({
      isSynced: false,
      plainLines: plainWithTranslation,
      hasTranslation: Array.isArray(cachedTranslations) && cachedTranslations.length > 0,
      source
    });
  }

  res.json({ isSynced: false, plainLyrics: null });
}

// Endpoint en segundo plano para traducir versos sin congelar la app
async function handleTranslateLyrics(req, res) {
  const { videoId } = req.params;
  const { lines } = req.body;

  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return res.json({ translations: [] });
  }

  const translations = await translateLyrics(lines, videoId);
  res.json({ translations });
}

// Endpoint para obtener curiosidades breves de la canción o del músico
async function handleTrivia(req, res) {
  const { videoId } = req.params;
  const { title = '', artist = '', refresh = 'false' } = req.query;
  const isRefresh = refresh === 'true';

  let list = triviaCache.get(videoId);
  if (!Array.isArray(list)) {
    list = list ? [list] : [];
  }

  // Si no se pide refrescar y ya tenemos al menos una en caché, devolver la última
  if (!isRefresh && list.length > 0) {
    return res.json({ trivia: list[list.length - 1], source: 'cache' });
  }

  const cleanTitle = (title || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();
  const cleanArtist = (artist || '').trim();

  const previousTrivia = list.length > 0 
    ? `Datos ya mencionados anteriormente: "${list.join(' // ')}".\nProporciona una curiosidad completamente NUEVA y DIFERENTE a las anteriores.` 
    : '';

  const prompt = `Canción: "${cleanTitle || 'Tema'}" del artista "${cleanArtist || 'Músico'}".
${previousTrivia}
Comparte un dato curioso, detalle de producción, inspiración o récord real y fascinante sobre esta canción o sobre el artista.
REGLAS ESTRICTAS:
- Que sea BREVE y CONCISO: exactamente entre 2 y 3 oraciones cortas (máximo 40 palabras).
- Nada de introducciones largas ni rodeos. Ve directo al dato interesante.
- En español.`;

  const triviaSystemPrompt = `Eres un historiador musical y DJ de radio melómano con una cultura musical impecable.
Tu misión es dar un dato curioso breve, verídico y sorprendente sobre la canción o músico indicado.
INSTRUCCIONES DE FORMATO:
- Responde EXCLUSIVAMENTE con un objeto JSON plano:
{
  "curiosidad": "Tu dato curioso aquí (2 a 3 frases cortas)"
}
- Prohibido usar bloques markdown o texto extra.`;

  try {
    const decision = await getDJDecision(prompt, triviaSystemPrompt);
    if (decision && decision.curiosidad) {
      const trivia = decision.curiosidad.trim();
      list.push(trivia);
      triviaCache.set(videoId, list);
      return res.json({ trivia, source: 'ai' });
    }
  } catch (err) {
    console.error("Error al generar trivia musical:", err.message);
  }

  // Fallback si la IA no responde o tarda
  const fallback = cleanArtist 
    ? `"${cleanTitle}" de ${cleanArtist} cuenta con una producción destacada y es uno de los temas favoritos de los oyentes por su estilo inconfundible.`
    : `Esta canción destaca por su rica instrumentación y melodía que atrapa desde los primeros compases.`;

  list.push(fallback);
  triviaCache.set(videoId, list);
  return res.json({ trivia: fallback, source: 'fallback' });
}

// Endpoint para exportar la playlist del día
async function handleExportPlaylist(req, res) {
  try {
    const exportRes = await axios.post(`${PYTHON_SERVICE_URL}/playlist/export`);
    res.json(exportRes.data);
  } catch (error) {
    console.error("Error exportando playlist:", error.message);
    res.status(500).json({ error: error.message });
  }
}

// Endpoint para registrar la transición de canción precargada y avanzar el contador
function handleSessionTransition(req, res) {
  const { song, spoke, frequency = 5 } = req.body;
  const targetFrequency = Number(frequency) >= 0 ? Number(frequency) : 5;

  if (spoke) {
    // Si el DJ intervino al inicio de esta canción, la sesión se reinicia para que el próximo tema arranque en 1
    songsSinceLastDJIntervention = 0;
    console.log(`[SESIÓN RADIO] DJ intervino en "${song?.title || 'Tema'}". Próximo bloque comenzará en 1/${targetFrequency || 'Solo Chat'}`);
  } else {
    songsSinceLastDJIntervention++;
    console.log(`[SESIÓN RADIO] Canción en sesión: ${song?.title || 'Tema'} (${songsSinceLastDJIntervention}/${targetFrequency || 'Solo Chat'})`);
  }

  res.json({ count: songsSinceLastDJIntervention });
}

// Handlers de persistencia de sesiones en BD
async function handleGetCurrentSession(req, res) {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/session/current`, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo sesión actual:", error.message);
    return res.json({ exists: false, session: null, error: error.message });
  }
}

async function handleSaveSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/save`, req.body, { timeout: 5000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error guardando sesión:", error.message);
    return res.json({ success: false, error: error.message });
  }
}

async function handleResetSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/reset`, req.body || {}, { timeout: 5000 });
    songsSinceLastDJIntervention = 1;
    return res.json(response.data);
  } catch (error) {
    console.error("Error reiniciando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleGetSessions(req, res) {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/sessions`, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error listando sesiones:", error.message);
    return res.json({ sessions: [], error: error.message });
  }
}

async function handleLoadSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/load`, req.body, { timeout: 5000 });
    songsSinceLastDJIntervention = 1;
    return res.json(response.data);
  } catch (error) {
    console.error("Error cargando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleCreateSession(req, res) {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/session/create`, req.body, { timeout: 5000 });
    songsSinceLastDJIntervention = 1;
    return res.json(response.data);
  } catch (error) {
    console.error("Error creando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleRenameSession(req, res) {
  try {
    const { id } = req.params;
    const response = await axios.put(`${PYTHON_SERVICE_URL}/session/${id}/rename`, req.body, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error renombrando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleDeleteSession(req, res) {
  try {
    const { id } = req.params;
    const response = await axios.delete(`${PYTHON_SERVICE_URL}/session/${id}`, { timeout: 4000 });
    return res.json(response.data);
  } catch (error) {
    console.error("Error eliminando sesión:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleFallbackVideo(req, res) {
  try {
    const { title, artist, exclude_id } = req.query;
    const response = await axios.get(`${PYTHON_SERVICE_URL}/fallback-video`, {
      params: { title, artist, exclude_id },
      timeout: 5000
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Error en fallback video:", error.message);
    return res.status(500).json({ error: error.message });
  }
}

async function handleGetFavorites(req, res) {
  try {
    const limit = req.query.limit || 30;
    const response = await axios.get(`${PYTHON_SERVICE_URL}/favorites/repeats`, {
      params: { limit },
      timeout: 5000
    });
    return res.json(response.data);
  } catch (error) {
    console.error("Error obteniendo favoritas:", error.message);
    return res.json({ favorites: [] });
  }
}

async function handleGetFavoriteCount(req, res) {
  try {
    const { videoId } = req.params;
    const response = await axios.get(`${PYTHON_SERVICE_URL}/favorites/count/${videoId}`, {
      timeout: 3000
    });
    return res.json(response.data);
  } catch (error) {
    return res.json({ totalCount: 0, requestCount: 0, likeCount: 0 });
  }
}

module.exports = {
  handleChat,
  handlePreload,
  handleSessionTransition,
  handleLyrics,
  handleTranslateLyrics,
  handleTrivia,
  handleExportPlaylist,
  handleGetCurrentSession,
  handleSaveSession,
  handleResetSession,
  handleGetSessions,
  handleLoadSession,
  handleCreateSession,
  handleRenameSession,
  handleDeleteSession,
  handleFallbackVideo,
  handleGetFavorites,
  handleGetFavoriteCount
};
