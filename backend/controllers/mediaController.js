const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PYTHON_SERVICE_URL } = require('../config/constants');
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
    console.error("Error en fastTranslateText (Google):", err.message);
  }

  try {
    const cleanedText = text.substring(0, 450);
    const myMemoryUrl = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(cleanedText) + "&langpair=auto|es";
    const mmRes = await axios.get(myMemoryUrl, { timeout: 4000 });
    if (mmRes.data?.responseData?.translatedText) {
      return mmRes.data.responseData.translatedText;
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
    const taggedPayload = textArray.map((line, idx) => `[${idx}] ${line || ' '}`).join('\n');
    let translatedBlock = await fastTranslateText(taggedPayload);
    
    if (translatedBlock) {
      const resultMap = new Map();
      const lineRegex = /\[(\d+)\]\s*([^\[\n]*)/g;
      let match;
      while ((match = lineRegex.exec(translatedBlock)) !== null) {
        const index = parseInt(match[1], 10);
        const translatedText = match[2].trim();
        resultMap.set(index, translatedText);
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
    }
  } catch (err) {
    console.error("Error traduciendo letras con scraper:", err.message);
  }

  try {
    const aiPrompt = `Traduce cada una de estas líneas de canción al español manteniendo la misma cantidad e índice:
${textArray.slice(0, 50).map((l, i) => `[${i}] ${l}`).join('\n')}

Devuelve un JSON plano:
{"translations": ["...", "..."]}`;

    const decision = await getDJDecision(aiPrompt, "Eres un traductor musical profesional. Devuelve EXCLUSIVAMENTE un JSON con la propiedad 'translations' que contenga el array de versos traducidos al español.");
    if (decision && Array.isArray(decision.translations) && decision.translations.length > 0) {
      const fullAligned = textArray.map((_, idx) => decision.translations[idx] || '');
      fs.writeFileSync(cacheFile, JSON.stringify(fullAligned));
      console.log(`[LYRICS TRADUCIDAS CON DJ AI]: ${fullAligned.length} versos para ${videoId}`);
      return fullAligned;
    }
  } catch (aiErr) {
    console.error("Error en fallback DJ AI para traducción de letras:", aiErr.message);
  }

  return [];
}

async function preloadSongLyrics(videoId, title, artist) {
  if (!videoId) return;
  const cacheFile = path.join(lyricsCacheFolder, `${videoId}_es.json`);
  if (fs.existsSync(cacheFile)) return;

  try {
    let plainLines = [];
    if (title) {
      try {
        const lrcRes = await axios.get('https://lrclib.net/api/get', {
          params: { track_name: title, artist_name: artist || '' },
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
  const { title = '', artist = '' } = req.query;

  let syncedLyrics = null;
  let plainLyrics = null;
  let source = null;
  let isSynced = false;

  if (title) {
    try {
      const lrcRes = await axios.get('https://lrclib.net/api/get', {
        params: { track_name: title, artist_name: artist },
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
