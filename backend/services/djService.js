const axios = require('axios');
const { GROQ_API_KEY, GROQ_MODEL, OPENROUTER_API_KEY, DJ_SYSTEM_PROMPT } = require('../config/constants');

let groqCooldownUntil = 0;
let openRouterCooldownUntil = 0;

function extractJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (err2) {
        // Limpieza de trailing commas comunes en respuestas LLM
        try {
          const sanitized = match[0].replace(/,\s*([\]}])/g, '$1');
          return JSON.parse(sanitized);
        } catch (err3) {}
      }
    }
  }
  return null;
}

function buildMessages(prompt, systemPrompt, conversationHistory = []) {
  const messages = [
    { role: "system", content: systemPrompt || DJ_SYSTEM_PROMPT }
  ];

  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-6);
    for (const msg of recent) {
      const role = (msg.sender === 'user' || msg.role === 'user') ? 'user' : 'assistant';
      const content = msg.text || msg.content || '';
      if (content && typeof content === 'string') {
        messages.push({ role, content });
      }
    }
  }

  messages.push({ role: "user", content: prompt });
  return messages;
}

async function callGroqModel(model, prompt, systemPrompt, conversationHistory = [], timeoutMs = 3800) {
  if (!GROQ_API_KEY) return null;
  if (Date.now() < groqCooldownUntil) {
    return null;
  }

  const messages = buildMessages(prompt, systemPrompt, conversationHistory);

  try {
    const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
      model: model || GROQ_MODEL || "openai/gpt-oss-120b",
      messages,
      response_format: { type: "json_object" },
      temperature: 0.65
    }, {
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: timeoutMs
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = extractJSON(content);
      if (parsed) return parsed;
    }
    throw new Error(`Respuesta vacía o JSON no interpretable del modelo Groq ${model}`);
  } catch (error) {
    if (error.response?.status === 429) {
      groqCooldownUntil = Date.now() + 5 * 60 * 1000;
      console.warn("DJ AI: Groq rate limit (429). Enfriamiento activado por 5 minutos.");
    }
    throw error;
  }
}

async function callOpenRouterModel(model, prompt, systemPrompt, timeoutMs = 2800) {
  if (!OPENROUTER_API_KEY) return null;
  if (Date.now() < openRouterCooldownUntil) {
    return null;
  }

  try {
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

    const content = response.data?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = extractJSON(content);
      if (parsed) return parsed;
    }
    throw new Error(`Respuesta vacía del modelo ${model}`);
  } catch (error) {
    if (error.response?.status === 429) {
      openRouterCooldownUntil = Date.now() + 5 * 60 * 1000;
      console.warn("DJ AI: OpenRouter rate limit (429). Enfriamiento activado por 5 minutos.");
    }
    throw error;
  }
}

async function getDJDecision(prompt, customSystemPrompt = null, conversationHistory = []) {
  // Nivel 1: Groq (Ultra rápido y sin problemas de cuota)
  if (GROQ_API_KEY && Date.now() >= groqCooldownUntil) {
    const groqModels = [GROQ_MODEL || "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
    for (const model of groqModels) {
      try {
        const res = await callGroqModel(model, prompt, customSystemPrompt, conversationHistory, 3500);
        if (res) return res;
      } catch (gErr) {
        console.warn(`DJ AI: Intento con Groq (${model}) falló: ${gErr.message}. Probando siguiente alternativa...`);
      }
    }
  }

  // Nivel 2: OpenRouter (Fallback en caso de que Groq esté saturado o no disponible)
  if (OPENROUTER_API_KEY && Date.now() >= openRouterCooldownUntil) {
    const primaryModel = "nex-agi/nex-n2.5-mini:free";
    const fallbackModels = [
      "liquid/lfm-2.5-2.6b:free",
      "nvidia/nemotron-3.5-lightning:free"
    ];

    try {
      const res = await callOpenRouterModel(primaryModel, prompt, customSystemPrompt, 2500);
      if (res) return res;
    } catch (err1) {
      console.warn(`DJ AI: OpenRouter primario falló (${err1.message}). Probando alternativas en paralelo...`);
    }

    try {
      const racers = fallbackModels.map(m => callOpenRouterModel(m, prompt, customSystemPrompt, 3500));
      const fastest = await Promise.any(racers);
      if (fastest) return fastest;
    } catch (raceErr) {
      console.error("DJ AI: Todos los modelos de OpenRouter fallaron:", raceErr.message);
    }
  }

  return null;
}

module.exports = {
  getDJDecision,
  extractJSON
};
