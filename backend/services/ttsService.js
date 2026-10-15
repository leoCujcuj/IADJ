const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const { 
  ELEVENLABS_API_KEY, 
  ELEVENLABS_API_KEY_2, 
  ELEVENLABS_API_KEYS, 
  ELEVENLABS_VOICE_ID 
} = require('../config/constants');

const audioFolder = path.join(__dirname, '..', 'temp_audio');

// Asegurar que la carpeta temporal exista
if (!fs.existsSync(audioFolder)) {
  fs.mkdirSync(audioFolder, { recursive: true });
}

// Mapeo de voces de configuración (ElevenLabs ID) a voces neuronales de Microsoft Edge-TTS en español
const ELEVENLABS_TO_EDGE_VOICES = {
  'IKne3meq5aSn9XLyUdCD': 'es-MX-JorgeNeural',   // Charlie (Masculino, Enérgico)
  'bIHbv24MWmeRgasZH58o': 'es-ES-AlvaroNeural',  // Will (Masculino, Chill)
  'CwhRBWXzGAHq8TQ4Fs17': 'es-CO-GonzaloNeural', // Roger (Masculino, Grave)
  'cjVigY5qzO86Huf0OWal': 'es-ES-AlvaroNeural',  // Eric (Masculino, Clásico)
  'nPczCjzI2devNBz1zQrb': 'es-CO-GonzaloNeural', // Brian (Masculino, Profundo)
  'cgSgspJ2msm6clMCkdW9': 'es-MX-DaliaNeural',   // Jessica (Femenino, Cálida)
  'EXAVITQu4vr4xnSDxMaL': 'es-ES-ElviraNeural',  // Sarah (Femenino, Profesional)
  'FGY2WhTYpPnrIDTdsKH5': 'es-CO-SalomeNeural'   // Laura (Femenino, Entusiasta)
};

function resolveEdgeVoice(voiceId) {
  if (voiceId && typeof voiceId === 'string' && voiceId.startsWith('es-')) {
    return voiceId;
  }
  if (voiceId && ELEVENLABS_TO_EDGE_VOICES[voiceId]) {
    return ELEVENLABS_TO_EDGE_VOICES[voiceId];
  }
  return 'es-MX-JorgeNeural';
}

let activeKeyIndex = 0;
const exhaustedKeys = new Set();

function getElevenLabsKeys() {
  const keys = [];
  const primary = process.env.ELEVENLABS_API_KEY || ELEVENLABS_API_KEY;
  const secondary = process.env.ELEVENLABS_API_KEY_2 || ELEVENLABS_API_KEY_2;
  const list = process.env.ELEVENLABS_API_KEYS || ELEVENLABS_API_KEYS;

  if (primary && primary.trim()) keys.push(primary.trim());
  if (secondary && secondary.trim() && !keys.includes(secondary.trim())) keys.push(secondary.trim());
  if (list && list.trim()) {
    list.split(',').map(k => k.trim()).filter(Boolean).forEach(k => {
      if (!keys.includes(k)) keys.push(k);
    });
  }
  return keys;
}

function maskKey(key) {
  if (!key || key.length < 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function getErrorString(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (Buffer.isBuffer(data)) return data.toString('utf-8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf-8');
  if (typeof data === 'object') {
    try { return JSON.stringify(data); } catch (e) { return String(data); }
  }
  return String(data);
}

function isQuotaError(error) {
  if (!error.response) return false;
  const status = error.response.status;
  const errStr = getErrorString(error.response.data).toLowerCase();

  if (status === 429) return true;
  if (errStr.includes("quota_exceeded") ||
      errStr.includes("insufficient_credits") ||
      errStr.includes("exceeds your quota") ||
      (status === 401 && errStr.includes("quota"))) {
    return true;
  }
  return false;
}

async function generateEdgeTTS(text, customVoiceId = null) {
  if (!text || !text.trim()) return null;
  const edgeVoice = resolveEdgeVoice(customVoiceId);
  const cleanText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const textHash = crypto.createHash('md5').update(`edge_${edgeVoice}_${cleanText}`).digest('hex');
  const fileName = `tts_edge_${textHash}.mp3`;
  const filePath = path.join(audioFolder, fileName);

  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 100) {
        console.log(`[EDGE-TTS CACHE HIT - $0]: "${text.slice(0, 35)}..." reutilizado de caché local.`);
        return `/audio/${fileName}`;
      }
    } catch (e) {}
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Generando voz con Edge-TTS (${edgeVoice})${attempt > 1 ? ` [Intento ${attempt}]` : ''}... (Texto: "${text.slice(0, 50)}...")`);
      const tts = new MsEdgeTTS();
      await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const readable = tts.toStream(text);

      await new Promise((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath);
        readable.audioStream.pipe(writeStream);
        readable.audioStream.on('error', reject);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const stats = fs.statSync(filePath);
      if (stats.size > 100) {
        console.log(`Voz Edge-TTS generada y guardada en caché: ${fileName} (${stats.size} bytes)`);
        return `/audio/${fileName}`;
      } else {
        console.warn(`Archivo generado por Edge-TTS es muy pequeño (${stats.size} bytes), eliminando.`);
        try { fs.unlinkSync(filePath); } catch (e) {}
        if (attempt === 3) return null;
      }
    } catch (error) {
      console.error(`Error al generar voz con Edge-TTS (intento ${attempt}):`, error.message);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
      if (attempt < 3) {
        // Pausa progresiva para recuperación de conexión WebSocket o 429
        await new Promise(r => setTimeout(r, attempt * 1000));
      } else {
        return null;
      }
    }
  }
  return null;
}

async function generateTTS(text, customVoiceId = null, options = { mode: 'vip' }) {
  if (!text || !text.trim()) return null;
  const mode = (typeof options === 'object' && options?.mode) ? options.mode : (typeof options === 'string' ? options : 'vip');
  const edgeVoiceId = (typeof options === 'object' && options?.edgeVoiceId) ? options.edgeVoiceId : null;
  const targetEdgeVoice = edgeVoiceId || (typeof customVoiceId === 'string' && customVoiceId.startsWith('es-') ? customVoiceId : resolveEdgeVoice(customVoiceId));

  // 1. Modo transicion: presentaciones rutinarias entre canciones con Edge-TTS (0 cuota ElevenLabs)
  if (mode === 'transition') {
    console.log(`[TTS HÍBRIDO - TRANSICIÓN]: Presentación rutinaria detectada -> Usando Edge-TTS (${resolveEdgeVoice(targetEdgeVoice)}).`);
    return await generateEdgeTTS(text, targetEdgeVoice);
  }

  // 2. Si el usuario seleccionó una voz de Edge-TTS directamente como su voz activa para todo
  if (customVoiceId && typeof customVoiceId === 'string' && customVoiceId.startsWith('es-')) {
    console.log(`[TTS DIRECTO]: Voz Edge-TTS seleccionada (${customVoiceId}) -> Usando Edge-TTS.`);
    return await generateEdgeTTS(text, customVoiceId);
  }

  // 3. Modo VIP: interacción manual en el chat
  const keys = getElevenLabsKeys();
  if (keys.length === 0) {
    console.warn("Advertencia: No hay ninguna ELEVENLABS_API_KEY configurada. Conmutando automáticamente a Edge-TTS.");
    return await generateEdgeTTS(text, targetEdgeVoice);
  }

  const voiceToUse = (customVoiceId && customVoiceId.trim()) || process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE_ID;

  // Normalizar texto para clave de caché ElevenLabs
  const cleanText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const textHash = crypto.createHash('md5').update(`${voiceToUse}_${cleanText}`).digest('hex');
  const fileName = `tts_cache_${textHash}.mp3`;
  const filePath = path.join(audioFolder, fileName);

  // 1. Si ya existe en caché de ElevenLabs, retornarlo inmediatamente
  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 100) {
        console.log(`[ELEVENLABS CACHE HIT - $0]: "${text.slice(0, 35)}..." reutilizado de caché local.`);
        return `/audio/${fileName}`;
      }
    } catch (e) {}
  }

  // Comprobar si todas las claves ya están agotadas
  const availableKeys = keys.filter(k => !exhaustedKeys.has(k));
  if (availableKeys.length === 0) {
    console.warn("[ElevenLabs]: Todas las claves han agotado su cuota mensual. Conmutando automáticamente a Edge-TTS como respaldo.");
    return await generateEdgeTTS(text, targetEdgeVoice);
  }

  // Asegurar que activeKeyIndex apunte a una clave no agotada
  if (activeKeyIndex >= keys.length || exhaustedKeys.has(keys[activeKeyIndex])) {
    const nextIdx = keys.findIndex(k => !exhaustedKeys.has(k));
    if (nextIdx !== -1) {
      activeKeyIndex = nextIdx;
    }
  }

  let attempts = 0;
  const maxAttempts = keys.length;

  while (attempts < maxAttempts) {
    const currentKey = keys[activeKeyIndex];
    if (exhaustedKeys.has(currentKey)) {
      const nextIdx = keys.findIndex(k => !exhaustedKeys.has(k));
      if (nextIdx === -1) {
        console.warn("[ElevenLabs]: Todas las claves han agotado su cuota mensual. Conmutando automáticamente a Edge-TTS como respaldo.");
        return await generateEdgeTTS(text, targetEdgeVoice);
      }
      activeKeyIndex = nextIdx;
      continue;
    }

    attempts++;

    try {
      console.log(`Generando voz VIP con ElevenLabs (Clave ${activeKeyIndex + 1}/${keys.length} ${maskKey(currentKey)})... (Texto: "${text}")`);
      const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceToUse}?optimize_streaming_latency=3`, {
        text: text,
        model_id: "eleven_flash_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }, {
        headers: { "xi-api-key": currentKey, "Content-Type": "application/json" },
        responseType: 'arraybuffer',
        timeout: 7000
      });

      fs.writeFileSync(filePath, response.data);
      console.log(`Voz VIP generada y guardada en caché: ${fileName}`);
      return `/audio/${fileName}`;
    } catch (error) {
      if (isQuotaError(error)) {
        exhaustedKeys.add(currentKey);
        const errDetails = getErrorString(error.response?.data);
        console.warn(`[ElevenLabs]: Clave ${activeKeyIndex + 1} (${maskKey(currentKey)}) agotó su cuota (${error.response?.status}): ${errDetails}`);

        const remaining = keys.filter(k => !exhaustedKeys.has(k));
        if (remaining.length > 0) {
          const nextIdx = keys.findIndex(k => !exhaustedKeys.has(k));
          activeKeyIndex = nextIdx;
          console.log(`[ElevenLabs]: Cambiando automáticamente a clave ${activeKeyIndex + 1} (${maskKey(keys[activeKeyIndex])})...`);
          continue;
        } else {
          console.warn("[ElevenLabs]: Cuota agotada en todas las cuentas de ElevenLabs configuradas. Conmutando automáticamente a Edge-TTS.");
          return await generateEdgeTTS(text, targetEdgeVoice);
        }
      } else {
        if (error.response) {
          const errStr = getErrorString(error.response.data);
          console.error(`Error ElevenLabs (${error.response.status}):`, errStr);
        } else {
          console.error("Error de red con ElevenLabs:", error.message);
        }
        console.warn("[ElevenLabs]: Conmutando a Edge-TTS tras fallo en ElevenLabs.");
        return await generateEdgeTTS(text, targetEdgeVoice);
      }
    }
  }

  console.warn("[ElevenLabs]: Intentos agotados. Conmutando a Edge-TTS.");
  return await generateEdgeTTS(text, targetEdgeVoice);
}

module.exports = {
  generateTTS,
  generateEdgeTTS,
  resolveEdgeVoice,
  ELEVENLABS_TO_EDGE_VOICES,
  audioFolder,
  getElevenLabsKeys
};
