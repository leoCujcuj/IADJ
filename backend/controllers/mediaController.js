const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PYTHON_SERVICE_URL, GROQ_API_KEY } = require('../config/constants');
const { getDJDecision } = require('../services/djService');

const lyricsCacheFolder = path.join(__dirname, '..', 'temp_audio', 'lyrics_cache');
if (!fs.existsSync(lyricsCacheFolder)) {
  fs.mkdirSync(lyricsCacheFolder, { recursive: true });
}

const triviaCache = new Map();

function parseLRCLines(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/;
  const offsetRegex = /\[offset:\s*([+-]?\d+)\]/i;
  let offsetSec = 0;

  for (const line of lines) {
    const offMatch = offsetRegex.exec(line);
    if (offMatch) {
      offsetSec = parseInt(offMatch[1], 10) / 1000;
    }
  }

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const hundredths = match[3] ? parseFloat(`0.${match[3]}`) : 0;
      const totalSeconds = Math.max(0, minutes * 60 + seconds + hundredths + offsetSec);
      const text = line.replace(timeRegex, '').trim();
      if (text) {
        result.push({ time: Math.round(totalSeconds * 100) / 100, text });
      }
    }
  }
  return result;
}

async function fastTranslateText(text) {
  // 1. Google Translate Client GTX (directo, sin límite 429 de scraping móvil)
  try {
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(text);
    const res = await axios.get(url, { 
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }, 
      timeout: 5000 
    });
    if (res.data && Array.isArray(res.data[0])) {
      const translated = res.data[0].map(item => item[0]).join('');
      const detected = res.data[2] || '';
      return { translated, detected };
    }
  } catch (err) {
    console.warn("Google GTX falló, probando fallback con Groq:", err.message);
  }

  // 2. Fallback de alta velocidad con Groq AI
  if (GROQ_API_KEY) {
    try {
      const groqRes = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "qwen/qwen3.8-27b",
        messages: [
          { role: "system", content: "Traduce las siguientes líneas de letra al español de forma natural. Conserva exactamente las etiquetas [N] al inicio de cada línea sin omitir ninguna." },
          { role: "user", content: text }
        ],
        temperature: 0.2
      }, {
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 6000
      });
      const content = groqRes.data?.choices?.[0]?.message?.content;
      if (content) {
        return { translated: content, detected: 'auto' };
      }
    } catch (gErr) {
      console.warn("Groq fallback de traducción falló:", gErr.message);
    }
  }

  // 3. Fallback de rescate con MyMemory
  try {
    const cleanedText = text.substring(0, 450);
    const myMemoryUrl = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(cleanedText) + "&langpair=auto|es";
    const mmRes = await axios.get(myMemoryUrl, { timeout: 4000 });
    if (mmRes.data?.responseData?.translatedText) {
      return { translated: mmRes.data.responseData.translatedText, detected: 'auto' };
    }
  } catch (mErr) {}

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
    // 1. Detección rápida de idioma: si la canción ya está en español, evitar llamadas innecesarias
    const nonEmpties = textArray.filter(l => l && l.trim().length > 0).slice(0, 5);
    if (nonEmpties.length > 0) {
      const sampleText = nonEmpties.join('\n');
      try {
        const detectUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=" + encodeURIComponent(sampleText);
        const dRes = await axios.get(detectUrl, { 
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
          timeout: 3000 
        });
        const detectedLang = dRes.data?.[2];
        if (detectedLang === 'es') {
          console.log(`[LYRICS EN ESPAÑOL DETECTADAS]: La canción ya es en español (${videoId}), omitiendo traducción redundante.`);
          const spanishOriginal = textArray.map(l => l || '');
          fs.writeFileSync(cacheFile, JSON.stringify(spanishOriginal));
          return spanishOriginal;
        }
      } catch (dErr) {}
    }

    // 2. Procesamiento por lotes de 25 líneas para evitar límites de URL y garantizar alineación 1:1
    const BATCH_SIZE = 25;
    const resultMap = new Map();
    const lineRegex = /\[(\d+)\]\s*([^\[\n]*)/g;

    for (let i = 0; i < textArray.length; i += BATCH_SIZE) {
      const chunk = textArray.slice(i, i + BATCH_SIZE);
      const taggedChunk = chunk.map((line, offset) => `[${i + offset}] ${line || ' '}`).join('\n');
      
      const res = await fastTranslateText(taggedChunk);
      const translatedBlock = res?.translated;
      if (translatedBlock) {
        let match;
        while ((match = lineRegex.exec(translatedBlock)) !== null) {
          const index = parseInt(match[1], 10);
          const translatedText = match[2].trim();
          resultMap.set(index, translatedText);
        }
      }
    }

    if (resultMap.size > 0) {
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

async function preloadSongLyrics(videoId, title, artist, duration) {
  if (!videoId) return;
  const cacheFile = path.join(lyricsCacheFolder, `${videoId}_es.json`);
  if (fs.existsSync(cacheFile)) return;

  try {
    let plainLines = [];
    const cleanTitle = (title || '')
      .replace(/\s*[\(\[](?:official\s*(?:video|audio|music\s*video|visualizer|lyric\s*video|hd|4k)|video\s*oficial|audio\s*oficial|remaster(?:ed)?|live|en\s*vivo)[\)\]]/gi, '')
      .trim();

    const numDuration = duration && !isNaN(duration) && Number(duration) > 0 ? Math.round(Number(duration)) : null;

    if (cleanTitle || title) {
      try {
        const getParams = { track_name: cleanTitle || title, artist_name: artist || '' };
        if (numDuration) getParams.duration = numDuration;
        const lrcRes = await axios.get('https://lrclib.net/api/get', {
          params: getParams,
          timeout: 3000
        });
        const lrcText = lrcRes.data?.syncedLyrics || lrcRes.data?.plainLyrics;
        if (lrcText) {
          const lines = parseLRCLines(lrcText);
          plainLines = lines.length > 0 ? lines.map(l => l.text) : lrcText.split('\n').filter(l => l.trim().length > 0);
        }
      } catch (e) {}
    }

    if (plainLines.length === 0) {
      const ytmRes = await axios.get(`${PYTHON_SERVICE_URL}/lyrics/${videoId}`, { timeout: 2500 });
      if (ytmRes.data?.lyrics) {
        plainLines = ytmRes.data.lyrics.split('\n').filter(l => l.trim().length > 0);
      }
    }

    if (plainLines.length > 0) {
      translateLyrics(plainLines, videoId).catch(() => {});
    }
  } catch (err) {}
}

async function handleLyrics(req, res) {
  const { videoId } = req.params;
  const { title = '', artist = '', duration } = req.query;

  let syncedLyrics = null;
  let plainLyrics = null;
  let source = null;
  let isSynced = false;

  const cleanTitle = (title || '')
    .replace(/\s*[\(\[](?:official\s*(?:video|audio|music\s*video|visualizer|lyric\s*video|hd|4k)|video\s*oficial|audio\s*oficial|remaster(?:ed)?|live|en\s*vivo)[\)\]]/gi, '')
    .trim();

  const numDuration = duration && !isNaN(duration) && Number(duration) > 0 ? Math.round(Number(duration)) : null;

  if (cleanTitle || title) {
    const candidateTitles = cleanTitle && cleanTitle !== title ? [cleanTitle, title] : [title || cleanTitle];

    for (const cTitle of candidateTitles) {
      if (!cTitle) continue;
      try {
        const getParams = { track_name: cTitle, artist_name: artist };
        if (numDuration) getParams.duration = numDuration;
        const lrcRes = await axios.get('https://lrclib.net/api/get', {
          params: getParams,
          timeout: 2500
        });
        if (lrcRes.data?.syncedLyrics) {
          syncedLyrics = lrcRes.data.syncedLyrics;
          plainLyrics = lrcRes.data.plainLyrics;
          source = 'Karaoke Sincronizado';
          isSynced = true;
          break;
        }
      } catch (e) {}
    }

    if (!syncedLyrics) {
      try {
        const queryTerm = `${cleanTitle || title} ${artist}`.trim();
        const searchRes = await axios.get('https://lrclib.net/api/search', {
          params: { q: queryTerm },
          timeout: 2500
        });
        const items = searchRes.data || [];
        const syncedMatches = items.filter(item => item.syncedLyrics);
        if (syncedMatches.length > 0) {
          if (numDuration) {
            // Ordenar por diferencia absoluta de duración con el audio real para descartar snippets o cortes
            syncedMatches.sort((a, b) => Math.abs((a.duration || 0) - numDuration) - Math.abs((b.duration || 0) - numDuration));
          }
          const match = syncedMatches[0];
          syncedLyrics = match.syncedLyrics;
          plainLyrics = match.plainLyrics;
          source = 'Karaoke Sincronizado';
          isSynced = true;
        }
      } catch (e2) {}
    }
  }

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

  let cachedTranslations = null;
  const cacheFile = path.join(lyricsCacheFolder, `${videoId}_es.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      cachedTranslations = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } catch (e) {}
  }

  if (isSynced && syncedLyrics) {
    const lines = parseLRCLines(syncedLyrics);
    // Invalidar caché si no coincide el número de líneas con la versión seleccionada
    if (cachedTranslations && Array.isArray(cachedTranslations) && cachedTranslations.length !== lines.length) {
      cachedTranslations = null;
    }
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

async function handleTranslateLyrics(req, res) {
  const { videoId } = req.params;
  const { lines } = req.body;

  if (!lines || !Array.isArray(lines) || lines.length === 0) {
    return res.json({ translations: [] });
  }

  const translations = await translateLyrics(lines, videoId);
  res.json({ translations });
}

async function handleTrivia(req, res) {
  const { videoId } = req.params;
  const { title = '', artist = '', refresh = 'false' } = req.query;
  const isRefresh = refresh === 'true';

  let list = triviaCache.get(videoId);
  if (!Array.isArray(list)) {
    list = list ? [list] : [];
  }

  if (!isRefresh && list.length > 0) {
    return res.json({ trivia: list[list.length - 1], source: 'cache' });
  }

  // 1. Consultar persistencia en base de datos PostgreSQL si no es refresh forzado
  if (!isRefresh) {
    try {
      const dbCheck = await axios.get(`${PYTHON_SERVICE_URL}/trivia/cache/${videoId}`, { timeout: 2000 });
      if (dbCheck.data?.found && dbCheck.data?.trivia) {
        const dbTrivia = dbCheck.data.trivia;
        list.push(dbTrivia);
        triviaCache.set(videoId, list);
        return res.json({ trivia: dbTrivia, source: 'db' });
      }
    } catch (e) {}
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

      // Guardar en base de datos para no volver a gastar llamadas
      axios.post(`${PYTHON_SERVICE_URL}/trivia/cache`, {
        video_id: videoId,
        title: cleanTitle,
        artist: cleanArtist,
        trivia
      }, { timeout: 3000 }).catch(() => {});

      return res.json({ trivia, source: 'ai' });
    }
  } catch (err) {
    console.error("Error al generar trivia musical:", err.message);
  }

  const fallback = cleanArtist 
    ? `"${cleanTitle}" de ${cleanArtist} cuenta con una producción destacada y es uno de los temas favoritos de los oyentes por su estilo inconfundible.`
    : `Esta canción destaca por su rica instrumentación y melodía que atrapa desde los primeros compases.`;

  list.push(fallback);
  triviaCache.set(videoId, list);
  return res.json({ trivia: fallback, source: 'fallback' });
}

async function handleExportPlaylist(req, res) {
  try {
    const exportRes = await axios.post(`${PYTHON_SERVICE_URL}/playlist/export`);
    res.json(exportRes.data);
  } catch (error) {
    console.error("Error exportando playlist:", error.message);
    res.status(500).json({ error: error.message });
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

module.exports = {
  handleLyrics,
  handleTranslateLyrics,
  handleTrivia,
  handleExportPlaylist,
  handleFallbackVideo,
  preloadSongLyrics,
  parseLRCLines,
  translateLyrics
};
