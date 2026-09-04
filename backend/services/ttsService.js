const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = require('../config/constants');

const audioFolder = path.join(__dirname, '..', 'temp_audio');

// Asegurar que la carpeta temporal exista
if (!fs.existsSync(audioFolder)) {
  fs.mkdirSync(audioFolder, { recursive: true });
}

const crypto = require('crypto');

async function generateTTS(text) {
  if (!text || !text.trim()) return null;
  if (!ELEVENLABS_API_KEY) {
    console.warn("Advertencia: No hay ELEVENLABS_API_KEY configurada.");
    return null;
  }

  // Normalizar texto para clave de caché
  const cleanText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const textHash = crypto.createHash('md5').update(`${ELEVENLABS_VOICE_ID}_${cleanText}`).digest('hex');
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
  
  try {
    console.log(`Generando voz con ElevenLabs (Flash ultra-rápido)... (Texto: "${text}")`);
    const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?optimize_streaming_latency=3`, {
      text: text,
      model_id: "eleven_flash_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    }, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      responseType: 'arraybuffer',
      timeout: 7000
    });

    fs.writeFileSync(filePath, response.data);
    console.log(`Voz generada y guardada en caché: ${fileName}`);
    return `/audio/${fileName}`;
  } catch (error) {
    if (error.response) {
      console.error(`Error ElevenLabs (${error.response.status}):`, error.response.data.toString());
    } else {
      console.error("Error de red con ElevenLabs:", error.message);
    }
    return null;
  }
}

module.exports = {
  generateTTS,
  audioFolder
};
