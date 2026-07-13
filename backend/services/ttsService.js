const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = require('../config/constants');

const audioFolder = path.join(__dirname, '..', 'temp_audio');

// Asegurar que la carpeta temporal exista
if (!fs.existsSync(audioFolder)) {
  fs.mkdirSync(audioFolder, { recursive: true });
}

async function generateTTS(text) {
  if (!ELEVENLABS_API_KEY) {
    console.warn("⚠️ No hay ELEVENLABS_API_KEY configurada.");
    return null;
  }
  
  try {
    console.log(`🎙️ Generando voz con ElevenLabs... (Texto: "${text}")`);
    const response = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    }, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      responseType: 'arraybuffer'
    });

    const fileName = `dj_voice_${Date.now()}.mp3`;
    const filePath = path.join(audioFolder, fileName);
    fs.writeFileSync(filePath, response.data);
    console.log(`✅ Voz generada con éxito: ${fileName}`);
    return `/audio/${fileName}`;
  } catch (error) {
    if (error.response) {
      console.error(`❌ Error ElevenLabs (${error.response.status}):`, error.response.data.toString());
    } else {
      console.error("❌ Error de red con ElevenLabs:", error.message);
    }
    return null;
  }
}

module.exports = {
  generateTTS,
  audioFolder
};
