const axios = require('axios');
const { OPENROUTER_API_KEY, DJ_SYSTEM_PROMPT } = require('../config/constants');

async function getDJDecision(prompt) {
  if (!OPENROUTER_API_KEY) return null;
  const models = ["openrouter/auto", "google/gemini-2.0-flash-001"];

  for (const model of models) {
    try {
      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: model,
        messages: [
          { role: "system", content: DJ_SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      }, {
        headers: { 
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`, 
          "Content-Type": "application/json" 
        },
        timeout: 10000
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return JSON.parse(response.data.choices[0].message.content);
      }
    } catch (error) {
      console.error(`❌ Falló ${model}`);
    }
  }
  return null;
}

module.exports = {
  getDJDecision
};
