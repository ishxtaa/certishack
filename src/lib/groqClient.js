/**
 * Groq API Client - Direct API calls from frontend
 * Handles AI chat and audio transcription
 */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error('VITE_GROQ_API_KEY not set. Please add it to your .env file');
}

/**
 * Invoke LLM with Groq
 * @param {Object} options
 * @param {string} options.prompt - The prompt text
 * @param {Object} [options.response_json_schema] - If set, request JSON output
 * @param {string[]} [options.file_urls] - (unsupported) voice file urls
 * @param {Object} [options.sensorData] - Structured sensor readings to inject as context
 */
export async function invokeLLM({ prompt, response_json_schema, file_urls, sensorData }) {
  // Handle file_urls (not supported for now)
  if (file_urls && file_urls.length > 0) {
    console.warn('Audio transcription not supported via invokeLLM. Use transcribeAudio instead.');
    return { transcription: '[Voice transcription not available]' };
  }

  // Build full prompt with sensor data if provided
  let fullPrompt = prompt;
  if (sensorData && Object.keys(sensorData).length > 0) {
    const sensorText = formatSensorData(sensorData);
    fullPrompt = `[SENSOR DATA CONTEXT]\n${sensorText}\n[END SENSOR DATA]\n\n${prompt}`;
  }

  // Groq requires 'json' in the prompt when using response_format
  if (response_json_schema && !fullPrompt.toLowerCase().includes('json')) {
    fullPrompt += '\n\nRespond with valid JSON.';
  }

  const systemPrompt = "You are an AI assistant for airport security operations. Be concise and professional.";
  
  const body = {
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: fullPrompt }
    ],
    temperature: 0.7,
    max_tokens: 2048
  };

  if (response_json_schema) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
    if (res.status === 429) {
      throw new Error(`⏱️ Rate limit: ${error.error?.message || 'Too many requests. Please wait a moment.'}`);
    }
    throw new Error(error.error?.message || `Groq API error: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;

  // Remove markdown code fences if present
  let cleanContent = content;
  if (cleanContent.startsWith("```")) {
    cleanContent = cleanContent.split("```")[1];
    if (cleanContent.startsWith("json")) {
      cleanContent = cleanContent.slice(4);
    }
    cleanContent = cleanContent.trim();
  }

  if (response_json_schema) {
    try {
      return JSON.parse(cleanContent);
    } catch (e) {
      return { response: cleanContent };
    }
  }
  return { response: cleanContent };
}

/**
 * Format a sensor data object into a readable string for the LLM prompt.
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

/**
 * Transcribe audio file using Groq Whisper
 * @param {File} file - Audio file to transcribe
 */
export async function transcribeAudio(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `Groq API error: ${res.status}`);
  }

  const data = await res.json();
  return data.text || 'Could not transcribe audio.';
}
