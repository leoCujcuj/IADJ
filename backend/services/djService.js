const axios = require('axios');
const { OPENROUTER_API_KEY, DJ_SYSTEM_PROMPT } = require('../config/constants');

async function getDJDecision(prompt, customSystemPrompt = null) {
  if (!OPENROUTER_API_KEY) return null;
  const models = ["openrouter/auto", "google/gemini-2.0-flash-001"];

  for (const model of models) {
    try {
      const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: model,
        messages: [
          { role: "system", content: customSystemPrompt || DJ_SYSTEM_PROMPT },
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
        let raw = response.data.choices[0].message.content.trim();
        raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return JSON.parse(raw);
      }
    } catch (error) {
      console.error(`Fallo en modelo ${model}:`, error.message);
    }
  }
  return null;
}

module.exports = {
  getDJDecision
};
