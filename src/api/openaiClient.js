/**
 * LLM Client - Uses Pollinations.AI (free, no API key needed)
 * Replaces OpenAI dependency — no installation or billing required.
 * API docs: https://text.pollinations.ai
 */

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';

async function callPollinations(messages, jsonMode = false) {
  const systemPrompt = 'You are a helpful AI assistant for airport security operations. Be concise and professional.';

  const body = {
    model: 'openai',
    messages: [
      {
        role: 'system',
        content: systemPrompt + (jsonMode ? ' Respond ONLY with valid JSON, no markdown, no explanation.' : '')
      },
      ...messages
    ],
    seed: Math.floor(Math.random() * 10000),
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
  };

  const response = await fetch(POLLINATIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.status} ${await response.text()}`);
  }

  const raw = await response.text();
  console.log('RAW POLLINATIONS RESPONSE:', raw);

  const data = JSON.parse(raw);
  console.log('PARSED DATA:', data);

  let text = data?.choices?.[0]?.message?.content || '';
  console.log('EXTRACTED TEXT:', text);

  text = text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  if (jsonMode) {
    // Strip any non-JSON preamble (e.g. deprecation notices prepended by Pollinations)
    const jsonStart = text.indexOf('{');
    if (jsonStart > 0) text = text.slice(jsonStart);
    try { return JSON.parse(text); } catch(e) {
      console.error('JSON parse failed:', e, 'text was:', text);
      return { response: text };
    }
  }
  return text;
}

/**
 * Invoke LLM with optional sensor dataset context.
 *
 * @param {Object} options
 * @param {string}   options.prompt               - Main prompt text
 * @param {Object}   [options.response_json_schema] - If set, request JSON output
 * @param {string[]} [options.file_urls]           - (unsupported) voice file urls
 * @param {Object}   [options.sensorData]          - Structured sensor readings to inject as context
 */
export async function invokeLLM({ prompt, response_json_schema, file_urls, sensorData }) {
  if (file_urls && file_urls.length > 0) {
    console.warn('Audio transcription not supported. Returning placeholder.');
    return { transcription: '[Voice transcription not available]' };
  }

  const jsonMode = !!response_json_schema;

  // Build message array — inject sensor data as a separate context message if provided
  const messages = [];

  if (sensorData && Object.keys(sensorData).length > 0) {
    const sensorText = formatSensorData(sensorData);
    messages.push({
      role: 'user',
      content: `[SENSOR DATA CONTEXT]\n${sensorText}\n[END SENSOR DATA]`
    });
    messages.push({ role: 'assistant', content: 'Sensor data received. I will factor these readings into my analysis.' });
  }

  messages.push({ role: 'user', content: prompt });

  try {
    return await callPollinations(messages, jsonMode);
  } catch (error) {
    console.error('Pollinations.AI failed:', error);
    throw new Error('Failed to get AI response. Check your internet connection.');
  }
}

/**
 * Format a sensor data object into a readable string for the LLM prompt.
 * Handles both flat key-value objects and nested sensor groups.
 */
function formatSensorData(sensorData) {
  const lines = [];

  for (const [key, value] of Object.entries(sensorData)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const [subKey, subVal] of Object.entries(value)) {
        lines.push(`  ${subKey}: ${subVal}`);
      }
    } else if (Array.isArray(value)) {
      lines.push(`${key}: ${value.join(', ')}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}
