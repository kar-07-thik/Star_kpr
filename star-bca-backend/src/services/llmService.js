const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function isConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY
  );
}

// Resolve the active provider. Preference order is driven by AI_PROVIDER first,
// then falls back to whichever key is present.
function getProvider() {
  const requested = String(process.env.AI_PROVIDER || '').toLowerCase();
  if ((requested === 'openrouter') && process.env.OPENROUTER_API_KEY) return 'openrouter';
  if ((requested === 'openai' || requested === '') && process.env.OPENAI_API_KEY) return 'openai';
  if ((requested === 'gemini' || requested === '') && process.env.GEMINI_API_KEY) return 'gemini';
  if ((requested === 'groq' || requested === '') && process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  return null;
}

// Build an ordered provider chain: the configured/primary provider first, then
// every other provider with a key set, so a failure can fall through.
function getProviderChain() {
  const primary = getProvider();
  if (!primary) return [];
  const available = [];
  if (process.env.OPENROUTER_API_KEY) available.push('openrouter');
  if (process.env.GEMINI_API_KEY) available.push('gemini');
  if (process.env.OPENAI_API_KEY) available.push('openai');
  if (process.env.GROQ_API_KEY) available.push('groq');
  return [primary, ...available.filter((provider) => provider !== primary)];
}

function providerLabel(provider = getProvider()) {
  if (provider === 'openrouter') return 'OpenRouter';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'gemini') return 'Google Gemini';
  if (provider === 'groq') return 'Groq';
  return 'Rule Engine';
}

function providerModel(provider = getProvider()) {
  if (provider === 'openrouter') return process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  if (provider === 'openai') return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  if (provider === 'groq') return process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return 'rule-based-fallback';
}

// Keep `llmService` a drop-in for the legacy aiReviewService surface.
const getConfig = () => ({
  provider: getProvider(),
  label: providerLabel(),
  model: providerModel(),
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (error2) {
      return null;
    }
  }
}

function normalizeError(error, provider) {
  const message = String(error?.message || '');
  const statusMatch = message.match(/\((\d{3})\)/);
  const status = statusMatch ? statusMatch[1] : '';
  if (message.includes('invalid_api_key') || message.toLowerCase().includes('incorrect api key')) {
    const wrapped = new Error(`${provider} API key rejected — add a valid key in .env or the system environment`);
    wrapped.statusCode = 401;
    return wrapped;
  }
  const wrapped = new Error(`${provider} unavailable${status ? ` (HTTP ${status})` : ''}: ${message}`);
  wrapped.statusCode = status ? Number(status) : undefined;
  return wrapped;
}

function buildOpenAIBody({ system, user, image, json, temperature, maxTokens, model }) {
  const content = [{ type: 'text', text: user }];
  if (image) {
    content.push({ type: 'image_url', image_url: { url: image.url || `data:${image.contentType};base64,${image.data.toString('base64')}` } });
  }
  const body = {
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content },
    ],
    temperature,
    max_tokens: maxTokens,
  };
  if (json) body.response_format = { type: 'json_object' };
  return body;
}

async function callOpenAI({ system, user, image, json, temperature, maxTokens, model, signal }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(buildOpenAIBody({ system, user, image, json, temperature, maxTokens, model })),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned an empty response');
  return { text: String(content), provider: 'openai', model };
}

function buildGeminiBody({ system, user, image, json, temperature, maxTokens, model }) {
  const parts = [{ text: user }];
  if (image) {
    if (image.url) parts.push({ file_data: { mime_type: image.contentType, file_uri: image.url } });
    else parts.push({ inline_data: { mime_type: image.contentType, data: image.data.toString('base64') } });
  }
  const body = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
  return body;
}

async function callGemini({ system, user, image, json, temperature, maxTokens, model, signal }) {
  const key = process.env.GEMINI_API_KEY;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiBody({ system, user, image, json, temperature, maxTokens, model })),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = (data?.candidates?.[0]?.content?.parts || []).map((part) => part.text).join('');
  if (!content) throw new Error('Gemini returned an empty response');
  return { text: String(content), provider: 'gemini', model };
}

async function callGroq({ system, user, image, json, temperature, maxTokens, model, signal }) {
  const body = buildOpenAIBody({ system, user, image, json, temperature, maxTokens, model });
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned an empty response');
  return { text: String(content), provider: 'groq', model };
}

async function callOpenRouter({ system, user, image, json, temperature, maxTokens, model, signal }) {
  const body = buildOpenAIBody({ system, user, image, json, temperature, maxTokens, model });
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'STARS-BCA',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned an empty response');
  return { text: String(content), provider: 'openrouter', model };
}

function canHandleImage(provider, model, image) {
  if (!image?.url && (!image?.data || image.data.length === 0)) return false;
  if (!String(image.contentType || '').startsWith('image/')) return false;
  if (image.data && image.data.length > MAX_IMAGE_BYTES) return false;
  if (provider === 'groq') return String(model).toLowerCase().includes('vision');
  return true;
}

/**
 * Run a single LLM completion against the configured provider.
 *
 * @param {object} opts
 * @param {string} [opts.system] - System prompt.
 * @param {string} opts.user   - User message text.
 * @param {{ data: Buffer, contentType: string }} [opts.image] - Optional image evidence.
 * @param {boolean} [opts.json=false] - Ask for + parse a JSON response.
 * @param {number} [opts.temperature=0.2]
 * @param {number} [opts.maxTokens=2048]
 * @param {number} [opts.timeoutMs=30000]
 * @param {number} [opts.retries=1]
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
async function complete({
  system = '',
  user = '',
  image = null,
  json = false,
  temperature = 0.2,
  maxTokens = 2048,
  timeoutMs = 30000,
  retries = 1,
}) {
  const chain = getProviderChain();
  if (!chain.length) throw new Error('No AI provider configured — set OPENAI_API_KEY, GEMINI_API_KEY or GROQ_API_KEY');

  let lastError = null;
  for (const provider of chain) {
    const model = providerModel(provider);
    const visionImage = canHandleImage(provider, model, image) ? image : null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let result;
        if (provider === 'openrouter') {
          result = await callOpenRouter({ system, user, image: visionImage, json, temperature, maxTokens, model, signal: controller.signal });
        } else if (provider === 'openai') {
          result = await callOpenAI({ system, user, image: visionImage, json, temperature, maxTokens, model, signal: controller.signal });
        } else if (provider === 'gemini') {
          result = await callGemini({ system, user, image: visionImage, json, temperature, maxTokens, model, signal: controller.signal });
        } else {
          result = await callGroq({ system, user, image: visionImage, json, temperature, maxTokens, model, signal: controller.signal });
        }
        if (json) {
          const parsed = extractJson(result.text);
          if (!parsed) throw new Error(`${providerLabel(provider)} returned an unparseable response`);
          result.parsed = parsed;
        }
        return result;
      } catch (error) {
        if (error.name === 'AbortError') {
          lastError = new Error(`${providerLabel(provider)} request timed out after ${Math.round(timeoutMs / 1000)}s`);
        } else {
          lastError = error;
        }
        if (attempt < retries) {
          await sleep(300 * Math.pow(2, attempt));
        }
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw normalizeError(lastError, providerLabel(chain[chain.length - 1]));
}

module.exports = {
  MAX_IMAGE_BYTES,
  isConfigured,
  getProvider,
  getProviderChain,
  providerLabel,
  providerModel,
  getConfig,
  extractJson,
  complete,
};