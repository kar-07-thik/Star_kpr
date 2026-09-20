const Submission = require('../models/Submission');
const Activity = require('../models/Activity');
const { calculateSubmissionScore } = require('../utils/scoringEngine');
const OpenAI = require('openai');
const { InferenceClient } = require('@huggingface/inference');

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function getProvider() {
  const requested = String(process.env.AI_PROVIDER || '').toLowerCase();
  if ((requested === 'openai' || requested === '') && process.env.OPENAI_API_KEY) return 'openai';
  if ((requested === 'gemini' || requested === '') && process.env.GEMINI_API_KEY) return 'gemini';
  if ((requested === 'groq' || requested === '') && process.env.GROQ_API_KEY) return 'groq';
  if ((requested === 'tokenrouter' || requested === '') && process.env.TOKENROUTER_API_KEY) return 'tokenrouter';
  if ((requested === 'huggingface' || requested === '') && process.env.HF_TOKEN) return 'huggingface';

  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.TOKENROUTER_API_KEY) return 'tokenrouter';
  if (process.env.HF_TOKEN) return 'huggingface';
  return null;
}

function providerConfig(provider) {
  if (provider === 'openai') {
    return {
      label: 'OpenAI',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }
  if (provider === 'gemini') {
    return {
      label: 'Google Gemini',
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    };
  }
  if (provider === 'huggingface') {
  return {
    label: 'Hugging Face',
    model: process.env.HF_MODEL || 'Qwen/Qwen2.5-VL-3B-Instruct',
  };
}
  // if (provider === 'groq') {
  //   return {
  //     label: 'Groq',
  //     model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  //   };
  // }
  if (provider === 'tokenrouter') {
    return {
      label: 'TokenRouter',
      model: process.env.TOKENROUTER_MODEL || '',
    };
  }
  return { label: 'Rule Engine', model: 'rule-based-fallback' };
}

function clampPoints(value, maxPoints) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Math.max(0, Math.min(Math.round(parsed), maxPoints));
}

function normalizeRecommendation(value) {
  const key = String(value || '').toLowerCase();
  if (key.startsWith('approv')) return 'Approve';
  if (key.startsWith('reject')) return 'Reject';
  return 'Review';
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

function buildPrompt(activity, submission) {
  const levels = Array.isArray(activity?.levels) && activity.levels.length
    ? activity.levels.map((level) => `${level.label} = ${level.points} SP`).join(', ')
    : 'None defined';

  const evidence = submission?.certificateFile
    ? {
        fileName: submission.certificateFile.fileName || '',
        contentType: submission.certificateFile.contentType || '',
        size: submission.certificateFile.size || 0,
      }
    : null;

  return {
    activity: {
      name: activity?.activityName || '',
      vertical: activity?.vertical || '',
      selectedActivity: activity?.activityName || '',
      selectedVertical: activity?.vertical || '',
      maximumPoints: Number(activity?.maximumPoints || 0),
      description: activity?.description || '',
      levels,
    },
    submission: {
      activityType: submission?.activityType || '',
      visitType: submission?.visitType || '',
      durationWeeks: submission?.durationWeeks || '',
      selectedLevel: submission?.selectedLevel || '',
      projectUrl: submission?.projectUrl || submission?.proofUrl || '',
      description: submission?.description || '',
      evidence,
    },
  };
}

const SYSTEM_PROMPT = `You are the AI evidence reviewer for the STARS framework at KPR College (Student Activity Reward Points System). Faculty members remain the final decision-makers; you provide only a recommendation.

You must perform these checks in this exact order:
1. Identify the selected STAR activity and vertical from the activity data.
2. Identify what the uploaded evidence actually proves.
3. Determine whether that evidence directly supports the selected STAR activity/vertical.
4. If the evidence is unrelated, invalid for the selected activity, or does not provide evidence of the claimed achievement, return recommendation "Reject", suggestedPoints 0, a confidence reflecting your certainty, reasoning that explicitly says the evidence does not support the selected activity/vertical, and a flag explaining the mismatch.
5. Only when the evidence is relevant, evaluate validity, level, duration, certificate details, and possible points.

Never award points merely because a document is genuine, official-looking, contains the student's name, or is a valid ID card. A college/student ID card by itself is not evidence for technical skills, internships, certifications, paper presentations, visits, courses, competitions, projects, or other achievement-based STAR activities unless the selected activity explicitly requires an ID card.

If evidence is not relevant to the selected activity/vertical, suggestedPoints MUST be 0. Do not calculate partial points for unrelated evidence.

For relevant evidence, evaluate:
- Does the description match the activity and its type?
- Does the stated level match what is claimed?
- Is the proof URL or certificate plausible and relevant?
- Should the submission be approved, rejected, or manually reviewed?

Return STRICT JSON only, with exactly this shape:
{
  "recommendation": "Approve" | "Reject" | "Review",
  "suggestedPoints": <integer between 0 and maximumPoints>,
  "confidence": <integer 0-100>,
  "reasoning": "<2-3 sentence explanation>",
  "flags": ["<concern or note>"]
}`;

async function callOpenAI(data, submission) {
  const model = providerConfig('openai').model;


  const image = submission?.certificateFile;
  const hasImage = Boolean((image?.url || image?.data) && image?.contentType?.startsWith('image/') && (!image.data || image.data.length <= MAX_IMAGE_BYTES));

  const content = [
    { type: 'text', text: `Review this STAR framework submission as JSON:\n${JSON.stringify(data, null, 2)}` },
  ];
  if (hasImage) {
    content.push({
      type: 'image_url',
      image_url: {
        url: image.url || `data:${image.contentType};base64,${image.data.toString('base64')}`,
      },
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const json = await response.json();
  const parsed = extractJson(json?.choices?.[0]?.message?.content);
  if (!parsed) throw new Error('OpenAI returned an unparseable response');

  return { ...parsed, provider: 'openai', model };
}

async function callGemini(data, submission) {
  const model = providerConfig('gemini').model;
  const key = process.env.GEMINI_API_KEY;
  const image = submission?.certificateFile;
  const hasImage = Boolean((image?.url || image?.data) && image?.contentType?.startsWith('image/') && (!image.data || image.data.length <= MAX_IMAGE_BYTES));

  const parts = [
    { text: `Review this STAR framework submission as JSON:\n${JSON.stringify(data, null, 2)}` },
  ];
  if (hasImage) {
    parts.push({
      ...(image.url ? { file_data: { mime_type: image.contentType, file_uri: image.url } } : { inline_data: {
        mime_type: image.contentType,
        data: image.data.toString('base64'),
      } }),
    });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const json = await response.json();
  const raw = json?.candidates?.[0]?.content?.parts?.map((part) => part.text).join('') || '';
  const parsed = extractJson(raw);
  if (!parsed) throw new Error('Gemini returned an unparseable response');

  return { ...parsed, provider: 'gemini', model };
}

async function callGroq(data, submission) {
  const model = providerConfig('groq').model;
  const image = submission?.certificateFile;
  const supportsVision = String(model).toLowerCase().includes('vision');
  const hasImage = supportsVision && Boolean((image?.url || image?.data) && image?.contentType?.startsWith('image/') && (!image.data || image.data.length <= MAX_IMAGE_BYTES));

  const content = [
    { type: 'text', text: `Review this STAR framework submission as JSON:\n${JSON.stringify(data, null, 2)}` },
  ];
  if (hasImage) {
    content.push({
      type: 'image_url',
      image_url: { url: image.url || `data:${image.contentType};base64,${image.data.toString('base64')}` },
    });
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const json = await response.json();
  const parsed = extractJson(json?.choices?.[0]?.message?.content);
  if (!parsed) throw new Error('Groq returned an unparseable response');

  return { ...parsed, provider: 'groq', model };
}

function tokenRouterClient() {
  return new OpenAI({
    apiKey: process.env.TOKENROUTER_API_KEY,
    baseURL: process.env.TOKENROUTER_BASE_URL || 'https://api.tokenrouter.com/v1',
  });
}
async function callHuggingFace(data, submission, imagePages = []) {
  const model = providerConfig('huggingface').model;
  const token = process.env.HF_TOKEN;

  if (!token) {
    throw new Error('HF_TOKEN is not configured');
  }

  const image = submission?.certificateFile;

  const hasImage = Boolean(
    (image?.url || image?.data) &&
    image?.contentType?.startsWith('image/') &&
    (!image.data || image.data.length <= MAX_IMAGE_BYTES)
  );

  const content = [
    {
      type: 'text',
      text: `Review this STAR framework submission as JSON:\n${JSON.stringify(
        data,
        null,
        2
      )}`,
    },
  ];

  if (hasImage) {
    content.push({
      type: 'image_url',
      image_url: {
        url:
          image.url ||
          `data:${image.contentType};base64,${image.data.toString('base64')}`,
      },
    });
  }

  const generatedPages = Array.isArray(imagePages)
    ? imagePages.filter((page) => typeof page === 'string' && page.startsWith('data:image/')).slice(0, 50)
    : [];
  if (generatedPages.length) {
    generatedPages.forEach((page) => content.push({ type: 'image_url', image_url: { url: page } }));
  }

  const client = new InferenceClient(token);

  const response = await client.chatCompletion({
    model,
    provider: process.env.HF_PROVIDER || 'featherless-ai',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content,
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
  });

  const raw = response?.choices?.[0]?.message?.content || '';
  const parsed = extractJson(raw);

  if (!parsed) {
    throw new Error('Hugging Face returned an unparseable response');
  }

  return {
    ...parsed,
    provider: 'huggingface',
    model,
  };
}
async function callTokenRouter(data, submission, imagePages = []) {
  const model = providerConfig('tokenrouter').model;
  if (!model) throw new Error('TOKENROUTER_MODEL is not configured');

  const image = submission?.certificateFile;
  const hasImage = Boolean((image?.url || image?.data) && image?.contentType?.startsWith('image/') && (!image.data || image.data.length <= MAX_IMAGE_BYTES));
  const content = [
    { type: 'text', text: `Review this STAR framework submission as JSON:\n${JSON.stringify(data, null, 2)}` },
  ];
  const generatedPages = Array.isArray(imagePages)
    ? imagePages.filter((page) => typeof page === 'string' && page.startsWith('data:image/')).slice(0, 50)
    : [];
  if (generatedPages.length) {
    generatedPages.forEach((page) => content.push({ type: 'image_url', image_url: { url: page } }));
  } else if (hasImage) {
    content.push({
      type: 'image_url',
      image_url: { url: image.url || `data:${image.contentType};base64,${image.data.toString('base64')}` },
    });
  }

  const response = await tokenRouterClient().chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content },
    ],
    temperature: 0.2,
  });

  const parsed = extractJson(response?.choices?.[0]?.message?.content);
  if (!parsed) throw new Error('TokenRouter returned an unparseable response');

  return { ...parsed, provider: 'tokenrouter', model };
}

async function validateTokenRouterModel() {
  if (String(process.env.AI_PROVIDER || '').toLowerCase() !== 'tokenrouter') return;

  const model = providerConfig('tokenrouter').model;
  if (!process.env.TOKENROUTER_API_KEY || !model) {
    console.warn('[AI] TokenRouter startup check skipped: set TOKENROUTER_API_KEY and TOKENROUTER_MODEL');
    return;
  }

  try {
    const models = await tokenRouterClient().models.list();
    const available = Array.isArray(models?.data) && models.data.some((entry) => entry.id === model);
    if (!available) console.warn(`[AI] TokenRouter startup check: model "${model}" was not found in /v1/models`);
    else console.log(`[AI] TokenRouter model validated: ${model}`);
  } catch (error) {
    console.warn(`[AI] TokenRouter startup check failed for model "${model}": ${error.message}`);
  }
}

function ruleBasedReview(activity, submission) {
  const calculated = calculateSubmissionScore(activity, submission);
  const description = String(submission?.description || '').trim();
  const proofUrl = String(submission?.projectUrl || submission?.proofUrl || '').trim();
  const hasFile = Boolean(submission?.certificateFile);
  const hasLevel = Boolean(String(submission?.selectedLevel || '').trim());

  const flags = [];
  let recommendation = 'Approve';
  let confidence = 62;

  if (!description && !proofUrl && !hasFile) {
    recommendation = 'Reject';
    confidence = 80;
    flags.push('No description, proof URL, or certificate provided');
  }

  if (hasLevel) {
    const levels = Array.isArray(activity?.levels) ? activity.levels : [];
    const match = levels.find((level) => String(level.label).toLowerCase() === String(submission.selectedLevel).toLowerCase());
    if (!match && levels.length > 0) {
      if (recommendation !== 'Reject') recommendation = 'Review';
      flags.push(`Selected level "${submission.selectedLevel}" is not listed for this activity`);
    }
  } else if (Array.isArray(activity?.levels) && activity.levels.length > 0) {
    if (recommendation !== 'Reject') recommendation = 'Review';
    flags.push('No certification level selected for a leveled activity');
  }

  if (!proofUrl && !hasFile) {
    flags.push('No proof URL or certificate attached');
    if (recommendation !== 'Reject') recommendation = 'Review';
  }

  if (!description) {
    flags.push('Submission has no student description');
  }

  if (recommendation === 'Approve' && flags.length > 1) recommendation = 'Review';

  return {
    recommendation,
    suggestedPoints: calculated.suggestedPoints,
    confidence,
    reasoning: recommendation === 'Reject'
      ? 'Evidence is missing or insufficient to support this claim.'
      : `Rule-based analysis suggests ${calculated.suggestedPoints} SP. ${flags.join(' ') || 'Evidence appears consistent with the activity.'}`,
    flags,
    provider: 'rule-engine',
    model: 'rule-based-fallback',
  };
}

function fallbackReasonFor(provider, error) {
  const message = String(error?.message || '');
  const statusMatch = message.match(/\((\d{3})\)/);
  const status = statusMatch ? statusMatch[1] : '';
  if (message.includes('invalid_api_key') || message.toLowerCase().includes('incorrect api key')) {
    return `${provider} API key rejected — add a valid key in .env or the system environment`;
  }
  return `${provider} unavailable${status ? ` (HTTP ${status})` : ''}`;
}

async function reviewSubmission(submissionId, options = {}) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new Error('Submission not found');

  const activity = await Activity.findById(submission.activityId);
  if (!activity) throw new Error('Activity not found');

  const data = buildPrompt(activity, submission);
  const maxPoints = Number(activity.maximumPoints || 0);
  const provider = getProvider();

  let review;
  let fallbackReason = '';
  if (provider === 'openai') {
    try {
      review = await callOpenAI(data, submission);
    } catch (error) {
      fallbackReason = fallbackReasonFor('OpenAI', error);
      console.error('[AI] OpenAI review failed, falling back to rule engine:', error.message);
    }
  } else if (provider === 'gemini') {
    try {
      review = await callGemini(data, submission);
    } catch (error) {
      fallbackReason = fallbackReasonFor('Gemini', error);
      console.error('[AI] Gemini review failed, falling back to rule engine:', error.message);
    }
  } else if (provider === 'groq') {
    try {
      review = await callGroq(data, submission);
    } catch (error) {
      fallbackReason = fallbackReasonFor('Groq', error);
      console.error('[AI] Groq review failed, falling back to rule engine:', error.message);
    }
  } else if (provider === 'tokenrouter') {
    try {
      review = await callTokenRouter(data, submission, options.imagePages);
    } catch (error) {
      fallbackReason = fallbackReasonFor('TokenRouter', error);
      console.error('[AI] TokenRouter request failed, falling back to rule engine:', error.message);
    }
  }else if (provider === 'huggingface') {
    try {
      review = await callHuggingFace(data, submission, options.imagePages);
    } catch (error) {
      fallbackReason = fallbackReasonFor('Hugging Face', error);
      console.error(
        '[AI] Hugging Face request failed, falling back to rule engine:',
        error.message
      );
    }
  }
  

  if (!review) {
    review = ruleBasedReview(activity, submission);
    if (fallbackReason) {
      
      review = {
        ...review,
        recommendation: 'Review',
        suggestedPoints: 0,
        confidence: 0,
        reasoning: 'AI evidence review was unavailable. Faculty review is required before points can be suggested.',
      };
    }
  }
  

  const flags = Array.isArray(review.flags) ? review.flags.map((flag) => String(flag).slice(0, 300)) : [];
  if (fallbackReason) flags.unshift(fallbackReason);

  const normalized = {
    provider: review.provider || 'rule-engine',
    model: review.model || 'unknown',
    recommendation: normalizeRecommendation(review.recommendation),
    suggestedPoints: normalizeRecommendation(review.recommendation) === 'Reject'
      ? 0
      : clampPoints(review.suggestedPoints, maxPoints),
    confidence: clampPoints(review.confidence, 100),
    reasoning: String(review.reasoning || '').slice(0, 2000),
    flags,
    reviewedAt: new Date(),
  };

  await Submission.findByIdAndUpdate(submissionId, { $set: { aiReview: normalized } });

  return normalized;
}

module.exports = { reviewSubmission, getProvider, ruleBasedReview, validateTokenRouterModel };
