/**
 * Free LLM Client - Uses Pollinations.AI (completely free, no API key needed)
 * Fallback to OpenAI if API key is provided
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// Pollinations.AI - Free, no-auth LLM API
const POLLINATIONS_API_URL = 'https://text.pollinations.ai';

/**
 * Call Pollinations.AI (completely free)
 * @param {string} prompt - The prompt
 * @param {boolean} jsonMode - Whether to request JSON output
 * @returns {Promise<string|Object>}
 */
async function callPollinations(prompt, jsonMode = false) {
  const systemPrompt = 'You are a helpful AI assistant for airport security operations.';
  const fullPrompt = `${systemPrompt}\n\n${prompt}`;
  
  const params = new URLSearchParams({
    model: 'openai-large',
    seed: Math.floor(Math.random() * 1000).toString()
  });
  
  if (jsonMode) {
    params.append('json', 'true');
  }
  
  const response = await fetch(`${POLLINATIONS_API_URL}/${encodeURIComponent(fullPrompt)}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.status}`);
  }
  
  const text = await response.text();
  
  if (jsonMode) {
    try {
      return JSON.parse(text);
    } catch {
      // If JSON parsing fails, wrap the text in an object
      return { response: text };
    }
  }
  
  return text;
}

/**
 * Call OpenAI (requires API key)
 * @param {string} prompt - The prompt
 * @param {boolean} jsonMode - Whether to request JSON output
 * @returns {Promise<string|Object>}
 */
async function callOpenAI(prompt, jsonMode = false) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant for airport security operations.' },
        { role: 'user', content: prompt }
      ],
      response_format: jsonMode ? { type: 'json_object' } : undefined
    })
  });
  
  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (jsonMode) {
    return JSON.parse(content);
  }
  
  return content || '';
}

/**
 * Invoke LLM with a prompt - replacement for base44.integrations.Core.InvokeLLM
 * Uses free Pollinations.AI by default, falls back to OpenAI if key is provided
 * 
 * @param {Object} options
 * @param {string} options.prompt - The prompt to send to the LLM
 * @param {Object} [options.response_json_schema] - Optional JSON schema for structured output
 * @param {string[]} [options.file_urls] - Optional array of file URLs for audio transcription
 * @returns {Promise<string|Object>} - The LLM response
 */
export async function invokeLLM({ prompt, response_json_schema, file_urls }) {
  // Handle audio transcription case
  if (file_urls && file_urls.length > 0) {
    console.warn('Audio transcription not supported in free mode. Returning placeholder.');
    return { transcription: '[Voice transcription not available]' };
  }
  
  const jsonMode = !!response_json_schema;
  
  // Try OpenAI first if API key is available
  if (OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt, jsonMode);
    } catch (error) {
      console.warn('OpenAI failed, falling back to free API:', error.message);
    }
  }
  
  // Use free Pollinations.AI
  try {
    return await callPollinations(prompt, jsonMode);
  } catch (error) {
    console.error('LLM API error:', error);
    throw new Error('Failed to get LLM response. Please try again.');
  }
}
