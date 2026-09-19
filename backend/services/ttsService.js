const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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

async function generateTTS(text, customVoiceId = null) {
  if (!text || !text.trim()) return null;
  const keys = getElevenLabsKeys();
  if (keys.length === 0) {
    console.warn("Advertencia: No hay ninguna ELEVENLABS_API_KEY configurada.");
    return null;
  }

  const voiceToUse = (customVoiceId && customVoiceId.trim()) || process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_VOICE_ID;

  // Normalizar texto para clave de caché
  const cleanText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const textHash = crypto.createHash('md5').update(`${voiceToUse}_${cleanText}`).digest('hex');
  const fileName = `tts_cache_${textHash}.mp3`;
  const filePath = path.join(audioFolder, fileName);

  // 1. Si ya existe en caché, retornarlo inmediatamente (0 llamadas a la API)
  if (fs.existsSync(filePath)) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > 100) {
        console.log(`[TTS CACHE HIT - $0]: "${text.slice(0, 35)}..." reutilizado de caché local.`);
        return `/audio/${fileName}`;
      }
    } catch (e) {}
  }

  // Comprobar si todas las claves ya están agotadas
  const availableKeys = keys.filter(k => !exhaustedKeys.has(k));
  if (availableKeys.length === 0) {
    console.warn("[ElevenLabs]: Todas las claves han agotado su cuota mensual. Usando voz del navegador.");
    return null;
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
        console.warn("[ElevenLabs]: Todas las claves han agotado su cuota mensual. Usando voz del navegador.");
        return null;
      }
      activeKeyIndex = nextIdx;
      continue;
    }

    attempts++;

    try {
      console.log(`Generando voz con ElevenLabs (Clave ${activeKeyIndex + 1}/${keys.length} ${maskKey(currentKey)})... (Texto: "${text}")`);
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
      console.log(`Voz generada y guardada en caché: ${fileName}`);
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
          console.log(`[ElevenLabs]: Cambiando automáticamente a clave ${activeKeyIndex + 1} (${maskKey(keys[activeKeyIndex])}) para esta y las siguientes canciones.`);
          continue;
        } else {
          console.warn("[ElevenLabs]: Cuota agotada en todas las cuentas de ElevenLabs configuradas. Usando voz del navegador.");
          return null;
        }
      } else {
        if (error.response) {
          const errStr = getErrorString(error.response.data);
          console.error(`Error ElevenLabs (${error.response.status}):`, errStr);
        } else {
          console.error("Error de red con ElevenLabs:", error.message);
        }
        return null;
      }
    }
  }

  return null;
}

module.exports = {
  generateTTS,
  audioFolder,
  getElevenLabsKeys
};
