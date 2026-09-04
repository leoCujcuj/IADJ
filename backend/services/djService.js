const axios = require('axios');
const { OPENROUTER_API_KEY, DJ_SYSTEM_PROMPT } = require('../config/constants');

async function getDJDecision(prompt, customSystemPrompt = null) {
  if (!OPENROUTER_API_KEY) return null;
  const models = [
    "inclusionai/ling-3.0-flash-fin:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "minimax/minimax-m2.7:free",
    "liquid/lfm-2.5-2.6b:free"
  ];

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
        timeout: 4500
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
