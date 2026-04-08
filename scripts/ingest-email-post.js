const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const POSTS_PATH = path.join(ROOT, 'posts', 'places', 'posts-places.json');
const VIBES_PATH = path.join(ROOT, 'content', 'vibes.yml');
const POST_INSTRUCTIONS_PATH = path.join(ROOT, 'posts', 'posts_instructions.md');
const IMAGES_DIR = path.join(ROOT, 'images', 'places');
const MAX_IMAGES_PER_POST = 6;

const OPENAI_ENDPOINT = process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_TOKEN || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

let _sharp = null;

function fail(message) {
  throw new Error(message);
}

function sanitizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseVibeKeys(yamlText) {
  const keys = [];
  const lines = String(yamlText || '').split(/\r?\n/);
  let inVibes = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (!inVibes) {
      if (trimmed === 'vibes:') inVibes = true;
      continue;
    }

    const match = line.match(/^\s{2}([a-zA-Z0-9_]+):\s*$/);
    if (match) keys.push(match[1]);
  }

  return keys;
}

function normalizeEmailPayload(payload) {
  const source = payload?.client_payload || payload || {};
  const email = source?.email || source?.gmail || source?.message || source || {};
  const attachments = Array.isArray(email.attachments)
    ? email.attachments
    : Array.isArray(source.attachments)
      ? source.attachments
      : Array.isArray(email?.payload?.attachments)
        ? email.payload.attachments
        : Array.isArray(email?.parts)
          ? email.parts
      : [];

  return {
    subject: email.subject || source.subject || '',
    from: email.from || source.from || '',
    text: email.text || email.textPlain || source.text || source.textPlain || source.bodyPlain || '',
    html: email.html || source.html || source.bodyHtml || '',
    googleMapsUrl: source.google_maps_url || email.google_maps_url || '',
    placeHint: source.place || email.place || '',
    cityHint: source.city || email.city || '',
    attachments,
  };
}

function decodeHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findGoogleMapsUrl(emailPayload) {
  if (emailPayload.googleMapsUrl) return emailPayload.googleMapsUrl;
  const haystack = `${emailPayload.text || ''}\n${decodeHtml(emailPayload.html || '')}`;
  const match = haystack.match(/https?:\/\/(?:www\.)?(?:google\.[^\s/]+\/maps|maps\.app\.goo\.gl)\S+/i);
  return match ? match[0] : '';
}

async function expandGoogleMapsUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (!/maps\.app\.goo\.gl/i.test(raw)) return raw;

  try {
    const response = await fetch(raw, { redirect: 'follow' });
    return response?.url || raw;
  } catch (err) {
    console.warn(`Maps URL expansion failed, using original URL: ${err.message}`);
    return raw;
  }
}

function derivePlaceHintFromEmail(emailPayload) {
  const rawText = String(emailPayload.text || decodeHtml(emailPayload.html || '') || '');
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^https?:\/\//i.test(line))
    .filter((line) => !/^\[[^\]]+\]$/.test(line));

  for (const line of lines) {
    const match = line.match(/\bat\s+(.+)$/i);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return lines[0] || '';
}

function extractLatLngFromUrl(url) {
  const match = String(url || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

function extractPlaceNameFromUrl(url) {
  const match = String(url || '').match(/\/place\/([^/]+)/i);
  if (!match) return '';
  return decodeURIComponent(match[1]).replace(/\+/g, ' ').trim();
}

function extractPlaceIdFromUrl(url) {
  const asString = String(url || '');
  const queryId = asString.match(/[?&]query_place_id=([^&]+)/i);
  if (queryId) return decodeURIComponent(queryId[1]);
  const direct = asString.match(/place_id:([A-Za-z0-9_-]+)/i);
  if (direct) return direct[1];
  return '';
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

async function resolveMapContext(mapsUrl, placeHint, cityHint) {
  const latLng = extractLatLngFromUrl(mapsUrl);
  const nameFromUrl = extractPlaceNameFromUrl(mapsUrl);
  const placeId = extractPlaceIdFromUrl(mapsUrl);

  const fallback = {
    place: placeHint || nameFromUrl,
    city: cityHint,
    coordinates: latLng,
    address: '',
    mapsUrl,
  };

  if (!GOOGLE_MAPS_API_KEY || !mapsUrl) {
    return fallback;
  }

  try {
    if (placeId) {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,formatted_address,geometry,address_components,url&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
      const details = await fetchJson(detailsUrl);
      if (details?.result) {
        const cityComp = (details.result.address_components || []).find((c) =>
          Array.isArray(c.types) && (c.types.includes('locality') || c.types.includes('postal_town'))
        );
        return {
          place: details.result.name || fallback.place,
          city: cityComp?.long_name || fallback.city,
          coordinates: details.result.geometry?.location
            ? [details.result.geometry.location.lat, details.result.geometry.location.lng]
            : fallback.coordinates,
          address: details.result.formatted_address || '',
          mapsUrl: details.result.url || mapsUrl,
        };
      }
    }

    const findInput = placeHint || nameFromUrl || '';
    if (findInput) {
      const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(findInput)}&inputtype=textquery&fields=name,formatted_address,geometry,place_id&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}`;
      const found = await fetchJson(findUrl);
      const candidate = found?.candidates?.[0];
      if (candidate) {
        const cityFromAddress = String(candidate.formatted_address || '').split(',').map((s) => s.trim())[1] || '';
        return {
          place: candidate.name || fallback.place,
          city: cityHint || cityFromAddress,
          coordinates: candidate.geometry?.location
            ? [candidate.geometry.location.lat, candidate.geometry.location.lng]
            : fallback.coordinates,
          address: candidate.formatted_address || '',
          mapsUrl,
        };
      }
    }
  } catch (err) {
    console.warn(`Map enrichment failed: ${err.message}`);
  }

  return fallback;
}

function normalizeAttachment(input) {
  const filename = String(input.filename || input.name || '').trim();
  const mimeType = String(input.contentType || input.mimeType || input.mime_type || '').trim();
  const contentBase64 = String(
    input.contentBase64 ||
    input.base64 ||
    input.content ||
    input.data ||
    input.attachmentData ||
    ''
  ).trim();
  const url = String(input.url || '').trim();

  return { filename, mimeType, contentBase64, url };
}

function isImageAttachment(att) {
  const lowerName = att.filename.toLowerCase();
  return (
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.heic') ||
    lowerName.endsWith('.heif') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    att.mimeType.toLowerCase().startsWith('image/')
  );
}

async function getSharp() {
  if (_sharp) return _sharp;
  try {
    _sharp = require('sharp');
  } catch (err) {
    _sharp = null;
  }
  return _sharp;
}

function decodeBase64Payload(value) {
  const raw = String(value || '').trim();
  if (!raw) return Buffer.alloc(0);
  const payload = raw.includes(',') ? raw.split(',').pop() : raw;
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64');
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAttachmentBytesWithRetry(url, { retries = 3, initialDelayMs = 600 } = {}) {
  let lastErr = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) {
        throw new Error('Downloaded attachment is empty');
      }

      return bytes;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await delay(initialDelayMs * attempt);
      }
    }
  }

  throw new Error(`Image download failed after ${retries} attempts (${url}): ${lastErr?.message || lastErr}`);
}

async function optimizeToJpeg(buffer) {
  const sharp = await getSharp();
  if (!sharp) return buffer;

  if (!buffer || !buffer.length) {
    fail('Image processing failed: attachment buffer is empty.');
  }

  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: 1800, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
      .toBuffer();
  } catch (err) {
    fail(`Image processing failed: ${err.message}`);
  }
}

async function saveAttachmentAsJpg(att, outputPath) {
  let bytes;

  if (att.contentBase64) {
    bytes = decodeBase64Payload(att.contentBase64);
    if (!bytes.length) {
      fail(`Attachment ${att.filename || '(unnamed)'} has empty base64 image content.`);
    }
  } else if (att.url) {
    bytes = await fetchAttachmentBytesWithRetry(att.url);
  } else {
    fail(`Attachment ${att.filename || '(unnamed)'} has no contentBase64 or URL`);
  }

  const optimized = await optimizeToJpeg(bytes);
  await fs.writeFile(outputPath, optimized);
}

async function generatePostDraftWithOpenAI({
  emailPayload,
  mapsContext,
  vibeKeys,
  postInstructions,
}) {
  if (!OPENAI_API_KEY) {
    fail('Missing OPENAI_API_KEY secret. Add it to repository secrets.');
  }

  const mailText = [
    `Subject: ${emailPayload.subject || ''}`,
    `From: ${emailPayload.from || ''}`,
    '',
    emailPayload.text || '',
    '',
    decodeHtml(emailPayload.html || ''),
  ].join('\n').trim();

  const system = 'Use the provided repository instructions markdown as the source of truth for how to generate the post. Return only one raw JSON object with no markdown or surrounding explanation.';

  const user = JSON.stringify({
    task: 'Create or refresh one place post draft from the email and map context.',
    source_of_truth: {
      posts_instructions_markdown: postInstructions,
      allowed_vibe_keys: vibeKeys,
    },
    input_context: {
      email_content: mailText,
      google_maps_context: mapsContext,
    },
  });

  const payload = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const details = await response.text();
    fail(`OpenAI API error ${response.status} for model ${OPENAI_MODEL}: ${details}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    fail('OpenAI response did not contain message content.');
  }

  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end < start) {
    fail(`Copilot response is not valid JSON: ${content}`);
  }

  const json = content.slice(start, end + 1);
  try {
    return JSON.parse(json);
  } catch (err) {
    fail(`Could not parse OpenAI JSON output: ${err.message}`);
  }
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function toIsoUtcTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function nowIsoUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function validateAndBuildPost({ draft, mapsContext, imagePaths, existingImages, existingPost, vibeKeys, now }) {
  const allowedVibes = new Set(vibeKeys);
  const inputVibes = Array.isArray(draft.vibes) ? draft.vibes : [];
  const normalizedVibes = [...new Set(
    inputVibes
      .map((v) => String(v || '').trim())
      .filter((v) => allowedVibes.has(v))
  )];

  const preferredVibe = String(draft.vibe || '').trim();
  const firstAllowedVibe = vibeKeys.find((v) => allowedVibes.has(String(v))) || 'easygoing';
  const fallbackVibe = allowedVibes.has(preferredVibe)
    ? preferredVibe
    : normalizedVibes[0] || firstAllowedVibe;

  let vibes = normalizedVibes;
  if (allowedVibes.has(fallbackVibe)) {
    vibes = [fallbackVibe, ...vibes.filter((v) => v !== fallbackVibe)];
  }
  if (!vibes.length) {
    vibes = [fallbackVibe];
  }
  vibes = vibes.slice(0, 3);

  const coordinates = Array.isArray(draft.coordinates) && draft.coordinates.length === 2
    ? [Number(draft.coordinates[0]), Number(draft.coordinates[1])]
    : Array.isArray(mapsContext.coordinates) && mapsContext.coordinates.length === 2
      ? [Number(mapsContext.coordinates[0]), Number(mapsContext.coordinates[1])]
      : null;

  if (!coordinates || Number.isNaN(coordinates[0]) || Number.isNaN(coordinates[1])) {
    fail('Valid coordinates are required from Google Maps URL or AI output.');
  }

  const place = String(draft.place || mapsContext.place || '').trim();
  const city = String(draft.city || mapsContext.city || '').trim();
  const adress = String(draft.adress || mapsContext.address || '').trim();

  if (!place) fail('Post requires a place name.');
  if (!city) fail('Post requires a city.');
  if (!adress) fail('Post requires adress.');
  const resolvedImages = Array.isArray(imagePaths) && imagePaths.length
    ? imagePaths
    : Array.isArray(existingImages)
      ? existingImages
      : [];

  if (!resolvedImages.length) fail('At least one JPG image is required.');

  const fallbackCreatedOn = toIsoUtcTimestamp(existingPost?.created_on);
  const createdOn = toIsoUtcTimestamp(draft.created_on) || fallbackCreatedOn || now;
  const draftUpdatedOn = toIsoUtcTimestamp(draft.updated_on);
  const updatedOn = existingPost ? now : (draftUpdatedOn || createdOn);

  return {
    place,
    city,
    vibe: vibes[0],
    title: String(draft.title || `${place} ${city} - Best spot for ${titleCase(vibes[0]).replace(/_/g, ' ')}`).trim(),
    images: resolvedImages,
    short_description: String(draft.short_description || '').trim(),
    description: String(draft.description || '').trim(),
    coordinates,
    adress,
    created_on: createdOn,
    updated_on: updatedOn,
    vibes,
  };
}

function findExistingPostIndex(existingPosts, post) {
  return existingPosts.findIndex((p) =>
    String(p.place || '').trim().toLowerCase() === String(post.place || '').trim().toLowerCase() &&
    String(p.city || '').trim().toLowerCase() === String(post.city || '').trim().toLowerCase()
  );
}

function uniqueImages(list) {
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const value = String(item || '').trim();
    if (!value) continue;
    const normalized = value.replace(/\\/g, '/').toLowerCase();
    if (!normalized.startsWith('images/places/')) continue;
    if (!normalized.endsWith('.jpg') && !normalized.endsWith('.jpeg')) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.replace(/\\/g, '/').replace(/\.jpeg$/i, '.jpg'));
  }
  return result;
}

function mergePost(existing, incoming, now) {
  const mergedImages = uniqueImages([
    ...(Array.isArray(incoming.images) ? incoming.images : []),
    ...(Array.isArray(existing.images) ? existing.images : []),
  ]).slice(0, MAX_IMAGES_PER_POST);

  const preservedCreatedOn = toIsoUtcTimestamp(existing.created_on) || toIsoUtcTimestamp(incoming.created_on) || now;
  // Existing posts must always reflect the update moment.
  const updatedOn = now;

  return {
    place: incoming.place || existing.place,
    city: incoming.city || existing.city,
    vibe: incoming.vibe || existing.vibe,
    title: incoming.title || existing.title,
    images: mergedImages.length ? mergedImages : existing.images,
    short_description: incoming.short_description || existing.short_description,
    description: incoming.description || existing.description,
    coordinates: Array.isArray(incoming.coordinates) && incoming.coordinates.length === 2
      ? incoming.coordinates
      : existing.coordinates,
    adress: incoming.adress || existing.adress,
    created_on: preservedCreatedOn,
    updated_on: updatedOn,
    vibes: Array.isArray(incoming.vibes) && incoming.vibes.length ? incoming.vibes : existing.vibes,
  };
}

function assertNoDuplicatePost(existingPosts, post, existingIndex) {
  const duplicate = existingPosts.find((p, idx) => idx !== existingIndex &&
    String(p.place || '').trim().toLowerCase() === String(post.place || '').trim().toLowerCase() &&
    String(p.city || '').trim().toLowerCase() === String(post.city || '').trim().toLowerCase()
  );

  if (duplicate) {
    fail(`Duplicate post detected for place+city: ${post.place} + ${post.city}`);
  }
}

async function processImages({ attachments, place, city, required = true }) {
  const normalized = attachments.map(normalizeAttachment).filter((a) => a.filename || a.url || a.contentBase64);

  if (!normalized.length) {
    if (!required) return [];
    fail('No attachments were provided in webhook payload. At least one JPG image is required.');
  }

  const imageAttachments = normalized.filter(isImageAttachment).slice(0, MAX_IMAGES_PER_POST);
  if (!imageAttachments.length) {
    if (!required) return [];
    fail('No image attachments found. Provide at least one image in the email webhook payload.');
  }

  await fs.mkdir(IMAGES_DIR, { recursive: true });

  const baseSlug = sanitizeSlug(`${place}-${city}`) || `place-${Date.now()}`;
  const imagePaths = [];

  for (let i = 0; i < imageAttachments.length; i += 1) {
    const filename = `${baseSlug}${i === 0 ? '' : `-${i + 1}`}.jpg`;
    const relative = `images/places/${filename}`;
    const absolute = path.join(ROOT, relative);
    await saveAttachmentAsJpg(imageAttachments[i], absolute);
    imagePaths.push(relative);
  }

  return imagePaths;
}

async function main() {
  const payloadFile = process.argv[2];
  if (!payloadFile) fail('Usage: node scripts/ingest-email-post.js <payload-json-file>');

  const [payloadRaw, postsRaw, vibesRaw, postInstructions] = await Promise.all([
    fs.readFile(payloadFile, 'utf8'),
    fs.readFile(POSTS_PATH, 'utf8'),
    fs.readFile(VIBES_PATH, 'utf8'),
    fs.readFile(POST_INSTRUCTIONS_PATH, 'utf8'),
  ]);

  const payload = JSON.parse(payloadRaw);
  const emailPayload = normalizeEmailPayload(payload);
  const originalMapsUrl = findGoogleMapsUrl(emailPayload);
  if (!originalMapsUrl) {
    fail('No Google Maps URL found in webhook payload/email content.');
  }
  const mapsUrl = await expandGoogleMapsUrl(originalMapsUrl);
  const now = nowIsoUtc();

  const existingPosts = JSON.parse(postsRaw);
  const vibeKeys = parseVibeKeys(vibesRaw);

  const derivedPlaceHint = emailPayload.placeHint || derivePlaceHintFromEmail(emailPayload);
  const mapsContext = await resolveMapContext(mapsUrl, derivedPlaceHint, emailPayload.cityHint);

  const draft = await generatePostDraftWithOpenAI({
    emailPayload,
    mapsContext,
    vibeKeys,
    postInstructions,
  });

  const draftKeyForLookup = {
    place: String(draft.place || mapsContext.place || '').trim(),
    city: String(draft.city || mapsContext.city || '').trim(),
  };
  const maybeExistingIndex = findExistingPostIndex(existingPosts, draftKeyForLookup);

  const imagePaths = await processImages({
    attachments: emailPayload.attachments,
    place: draft.place || mapsContext.place,
    city: draft.city || mapsContext.city,
    required: maybeExistingIndex < 0,
  });

  const post = validateAndBuildPost({
    draft,
    mapsContext,
    imagePaths,
    existingImages: maybeExistingIndex >= 0 ? existingPosts[maybeExistingIndex]?.images : [],
    existingPost: maybeExistingIndex >= 0 ? existingPosts[maybeExistingIndex] : null,
    vibeKeys,
    now,
  });

  const existingIndex = findExistingPostIndex(existingPosts, post);
  if (existingIndex >= 0) {
    const merged = mergePost(existingPosts[existingIndex], post, now);
    assertNoDuplicatePost(existingPosts, merged, existingIndex);
    existingPosts[existingIndex] = merged;
    console.log(`Updated existing post for ${merged.place} (${merged.city}).`);
  } else {
    assertNoDuplicatePost(existingPosts, post, -1);
    existingPosts.push(post);
    console.log(`Created post for ${post.place} (${post.city}) with ${post.images.length} image(s).`);
  }
  await fs.writeFile(POSTS_PATH, `${JSON.stringify(existingPosts, null, 2)}\n`, 'utf8');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});