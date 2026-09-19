const axios = require('axios');
const { OPENROUTER_API_KEY, DJ_SYSTEM_PROMPT } = require('../config/constants');

async function callOpenRouterModel(model, prompt, systemPrompt, timeoutMs = 2800) {
  const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
    model: model,
    messages: [
      { role: "system", content: systemPrompt || DJ_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    response_format: { type: "json_object" }
  }, {
    headers: { 
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`, 
      "Content-Type": "application/json" 
    },
    timeout: timeoutMs
  });

  if (response.data?.choices?.[0]?.message?.content) {
    let raw = response.data.choices[0].message.content.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(raw);
  }
  throw new Error(`Respuesta vacia del modelo ${model}`);
}

async function getDJDecision(prompt, customSystemPrompt = null) {
  if (!OPENROUTER_API_KEY) return null;

  const primaryModel = "nex-agi/nex-n2.5-mini:free";
  const fallbackModels = [
    "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-lightning:free",
    "dots-studio/dots-3-note-preview:free"
  ];

  // Intento 1: Llamar al primer modelo con timeout rapido de 2500ms
  try {
    const res = await callOpenRouterModel(primaryModel, prompt, customSystemPrompt, 2500);
    if (res) return res;
  } catch (err1) {
    console.warn(`DJ AI: Intento rapido con ${primaryModel} expiro o fallo (${err1.message}). Probando alternativas en paralelo...`);
  }

  // Intento 2: Si el primero fallo, carrera paralela entre los modelos de respaldo (el mas rapido gana)
  try {
    const racers = fallbackModels.map(m => callOpenRouterModel(m, prompt, customSystemPrompt, 3500));
    const fastest = await Promise.any(racers);
    if (fastest) return fastest;
  } catch (raceErr) {
    console.error("DJ AI: Todos los modelos de respaldo fallaron:", raceErr.message);
  }

  return null;
}

module.exports = {
  getDJDecision
};
