/**
 * LLM Client - Uses Pollinations.AI (free, no API key needed)
 */

async function callPollinations(prompt, jsonMode = false) {
  const systemPrompt = 'You are a helpful AI assistant for airport security operations. Be concise and professional.';
  const body = {
    model: 'openai',
    messages: [
      { role: 'system', content: systemPrompt + (jsonMode ? ' Respond ONLY with valid JSON, no markdown, no explanation.' : '') },
      { role: 'user', content: prompt }
    ],
    seed: Math.floor(Math.random() * 10000),
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
  };

  const response = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`Pollinations API error: ${response.status} ${await response.text()}`);

  const data = await response.json();
  let text = data?.choices?.[0]?.message?.content || '';
  text = text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  if (jsonMode) {
    try { return JSON.parse(text); } catch { return { response: text }; }
  }
  return text;
}

/**
 * Invoke LLM - uses Pollinations.AI (free, no install needed)
 * @param {Object} options
 * @param {string} options.prompt
 * @param {Object} [options.response_json_schema]
 * @param {string[]} [options.file_urls]
 */
export async function invokeLLM({ prompt, response_json_schema, file_urls }) {
  if (file_urls && file_urls.length > 0) {
    console.warn('Audio transcription not supported. Returning placeholder.');
    return { transcription: '[Voice transcription not available]' };
  }

  const jsonMode = !!response_json_schema;

  try {
    return await callPollinations(prompt, jsonMode);
  } catch (error) {
    console.error('Pollinations.AI failed:', error);
    throw new Error('Failed to get AI response. Check your internet connection.');
  }
}
