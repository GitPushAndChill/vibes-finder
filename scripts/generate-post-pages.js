const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const POSTS_PATH = path.join(ROOT, 'posts', 'places', 'posts-places.json');
const VIBES_PATH = path.join(ROOT, 'content', 'vibes.yml');
const POST_TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'post-page.template.html');
const CITY_TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'city-page.template.html');
const CITY_ROOT_TEMPLATE_PATH = path.join(ROOT, 'scripts', 'templates', 'city-root-index.template.html');
const BASE_URL = 'https://vibesfinder.nl';

function slugifyAscii(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function postIdentity(post) {
  return [
    String(post.city || '').trim(),
    String(post.place || '').trim(),
    String(post.adress || '').trim(),
    String(post.created_on || '').trim(),
  ].join('|').toLowerCase();
}

function shortHash(value) {
  const input = String(value || '');
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6);
}

function toTitleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeVibeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
}

function parseVibeIconsFromYaml(rawYaml) {
  const iconByKey = new Map();
  const lines = String(rawYaml || '').split(/\r?\n/);

  let currentKey = '';
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    const keyMatch = line.match(/^\s{2}([a-z0-9_]+):\s*$/i);
    if (keyMatch) {
      currentKey = normalizeVibeKey(keyMatch[1]);
      continue;
    }

    const iconMatch = line.match(/^\s{4}icon:\s*["']?(.+?)["']?\s*$/i);
    if (iconMatch && currentKey) {
      iconByKey.set(currentKey, iconMatch[1].trim());
    }
  }

  return iconByKey;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPostRouteMap(posts) {
  const entries = posts.map((post) => {
    const citySlug = slugifyAscii(post.city);
    const placeBase = slugifyAscii(post.place || post.title);
    const basePath = `city/${citySlug}/${placeBase}`;
    const identity = postIdentity(post);
    return { post, citySlug, placeBase, basePath, identity };
  });

  const grouped = new Map();
  entries.forEach((entry) => {
    if (!grouped.has(entry.basePath)) grouped.set(entry.basePath, []);
    grouped.get(entry.basePath).push(entry);
  });

  const used = new Set();
  const routeByIdentity = new Map();

  grouped.forEach((group, basePath) => {
    const sorted = group.slice().sort((a, b) => a.identity.localeCompare(b.identity));

    if (sorted.length === 1) {
      let resolved = basePath;
      let counter = 2;
      while (used.has(resolved)) {
        resolved = `${basePath}-${counter}`;
        counter += 1;
      }
      used.add(resolved);
      routeByIdentity.set(sorted[0].identity, resolved);
      return;
    }

    sorted.forEach((entry) => {
      const hash = shortHash(entry.identity);
      let resolved = `city/${entry.citySlug}/${entry.placeBase}-${hash}`;
      let counter = 2;
      while (used.has(resolved)) {
        resolved = `city/${entry.citySlug}/${entry.placeBase}-${hash}-${counter}`;
        counter += 1;
      }
      used.add(resolved);
      routeByIdentity.set(entry.identity, resolved);
    });
  });

  return routeByIdentity;
}

function renderImageSlider(post) {
  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];
  if (!images.length) return '';

  const imageEls = images.map((img, idx) => {
    const src = `/${String(img).replace(/^\/+/, '')}`;
    return `<img class="slider-img" src="${escapeHtml(src)}" alt="${escapeHtml(post.place || post.title)}" loading="lazy" decoding="async" fetchpriority="low" width="800" height="500" ${idx === 0 ? '' : 'hidden'} />`;
  }).join('\n');

  const controls = images.length > 1
    ? '<button type="button" class="slider-control prev" aria-label="Previous image">&lt;</button><button type="button" class="slider-control next" aria-label="Next image">&gt;</button>'
    : '';

  return `<div class="image-slider">${imageEls}${controls}</div>`;
}

function renderVibeChips(post, iconByVibe) {
  const vibes = Array.isArray(post.vibes) && post.vibes.length
    ? post.vibes
    : (post.vibe ? [post.vibe] : []);

  return vibes
    .map((v) => {
      const vibeKey = normalizeVibeKey(v);
      const icon = iconByVibe.get(vibeKey) || '';
      const iconHtml = icon ? `<span class="vibe-icon" aria-hidden="true">${escapeHtml(icon)}</span>` : '';
      return `<span class="modal-vibe-chip">${iconHtml}<span>${escapeHtml(toTitleCase(v))}</span></span>`;
    })
    .join('');
}

function validatePost(post, idx) {
  const required = ['place', 'city', 'title', 'adress', 'description', 'short_description', 'created_on', 'updated_on'];
  const missing = required.filter((k) => !String(post?.[k] || '').trim());
  if (missing.length) {
    throw new Error(`Post at index ${idx} is missing required fields: ${missing.join(', ')}`);
  }

  if (!Array.isArray(post.images) || !post.images.length) {
    throw new Error(`Post at index ${idx} requires at least one image.`);
  }

  if (!Array.isArray(post.coordinates) || post.coordinates.length !== 2) {
    throw new Error(`Post at index ${idx} requires coordinates [lat, lng].`);
  }
}

function replaceTokens(template, map) {
  let output = template;
  Object.entries(map).forEach(([key, value]) => {
    output = output.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
  });
  return output;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const [postsRaw, vibesRaw, postTemplate, cityTemplate, cityRootTemplate] = await Promise.all([
    fs.readFile(POSTS_PATH, 'utf8'),
    fs.readFile(VIBES_PATH, 'utf8'),
    fs.readFile(POST_TEMPLATE_PATH, 'utf8'),
    fs.readFile(CITY_TEMPLATE_PATH, 'utf8'),
    fs.readFile(CITY_ROOT_TEMPLATE_PATH, 'utf8'),
  ]);

  const vibeIcons = parseVibeIconsFromYaml(vibesRaw);

  const posts = JSON.parse(postsRaw);
  if (!Array.isArray(posts)) {
    throw new Error('posts-places.json must contain an array');
  }

  posts.forEach(validatePost);

  const routeMap = buildPostRouteMap(posts);
  const sorted = posts
    .slice()
    .sort((a, b) => (Date.parse(b.created_on) || 0) - (Date.parse(a.created_on) || 0));

  const cityNameBySlug = new Map();
  sorted.forEach((post) => {
    const slug = slugifyAscii(post.city);
    if (!cityNameBySlug.has(slug)) {
      cityNameBySlug.set(slug, String(post.city || '').trim());
    }
  });

  const routeList = sorted.map((post) => {
    const identity = postIdentity(post);
    const route = routeMap.get(identity);
    if (!route) throw new Error(`No route generated for post identity: ${identity}`);
    return { post, route, identity };
  });

  for (let i = 0; i < routeList.length; i += 1) {
    const { post, route } = routeList[i];
    const [, citySlug] = route.split('/');
    const outDir = path.join(ROOT, route);
    await ensureDir(outDir);

    const canonical = `${BASE_URL}/${route}/`;
    const firstImage = String(post.images[0] || '').replace(/^\/+/, '');
    const ogImage = `${BASE_URL}/${firstImage}`;

    const prev = routeList[(i - 1 + routeList.length) % routeList.length];
    const next = routeList[(i + 1) % routeList.length];

    const prevLink = routeList.length > 1
      ? `<a class="btn modal-nav-btn" href="/${prev.route}/index.html" aria-label="Open previous article: ${escapeHtml(prev.post.title)}">&larr; Previous article</a>`
      : '';
    const nextLink = routeList.length > 1
      ? `<a class="btn modal-nav-btn" href="/${next.route}/index.html" aria-label="Open next article: ${escapeHtml(next.post.title)}">Next article &rarr;</a>`
      : '';

    const metaDescription = String(post.short_description || post.description || '').trim().slice(0, 160);
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'TouristAttraction',
      name: post.place,
      description: post.description,
      image: post.images.map((img) => `${BASE_URL}/${String(img).replace(/^\/+/, '')}`),
      address: post.adress,
      datePublished: post.created_on,
      dateModified: post.updated_on,
      url: canonical,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: Number(post.coordinates[0]),
        longitude: Number(post.coordinates[1]),
      },
    };

    const html = replaceTokens(postTemplate, {
      SITE_ROOT: '/',
      PAGE_TITLE: escapeHtml(post.title),
      META_DESCRIPTION: escapeHtml(metaDescription),
      CANONICAL_URL: escapeHtml(canonical),
      OG_TITLE: escapeHtml(post.title),
      OG_DESCRIPTION: escapeHtml(metaDescription),
      OG_IMAGE: escapeHtml(ogImage),
      JSON_LD: JSON.stringify(jsonLd).replace(/<\//g, '<\\/'),
      IMAGE_SLIDER: renderImageSlider(post),
      POST_TITLE: escapeHtml(post.title),
      POST_CITY: escapeHtml(post.city),
      POST_SHORT_DESCRIPTION: escapeHtml(post.short_description),
      POST_DESCRIPTION: escapeHtml(post.description),
      POST_ADDRESS: escapeHtml(post.adress),
      VIBE_CHIPS: renderVibeChips(post, vibeIcons),
      PREV_LINK: prevLink,
      NEXT_LINK: nextLink,
      CITY_PAGE_PATH: `/city/${citySlug}/`,
      POST_PATH: `/${route}/index.html`,
    });

    await fs.writeFile(path.join(outDir, 'index.html'), `${html}\n`, 'utf8');
  }

  const citySlugs = Array.from(cityNameBySlug.keys()).sort((a, b) =>
    cityNameBySlug.get(a).localeCompare(cityNameBySlug.get(b))
  );

  const formatLinkList = (links) => {
    if (links.length === 0) return '';
    if (links.length === 1) return links[0];
    if (links.length === 2) return `${links[0]} and ${links[1]}`;
    return `${links.slice(0, -1).join(', ')}, and ${links[links.length - 1]}`;
  };

  for (const citySlug of citySlugs) {
    const cityName = cityNameBySlug.get(citySlug);
    const otherLinks = formatLinkList(
      ['amsterdam', 'rotterdam', 'utrecht', 'haarlem']
        .filter((slug) => cityNameBySlug.has(slug))
        .map((slug) => `<a href="/city/${slug}/">best places in ${escapeHtml(cityNameBySlug.get(slug))}</a>`)
    );

    const cityHtml = replaceTokens(cityTemplate, {
      CITY_NAME: escapeHtml(cityName),
      CITY_SLUG: escapeHtml(citySlug),
      OTHER_CITY_LINKS: otherLinks || 'Browse more city guides',
    });

    const cityDir = path.join(ROOT, 'city', citySlug);
    await ensureDir(cityDir);
    await fs.writeFile(path.join(cityDir, 'index.html'), `${cityHtml}\n`, 'utf8');
  }

  await ensureDir(path.join(ROOT, 'city'));
  await fs.writeFile(path.join(ROOT, 'city', 'index.html'), `${cityRootTemplate}\n`, 'utf8');

  const staticPages = [
    '',
    '/index.html',
    '/about.html',
    '/blog.html',
    '/faq.html',
    '/contact.html',
    '/reviews.html',
    '/privacy.html',
    '/cookies.html',
    '/city/',
    '/vibes/',
    ...citySlugs.map((slug) => `/city/${slug}/`),
  ];

  const urls = [
    ...staticPages.map((p) => `${BASE_URL}${p}`),
    ...routeList.map((item) => `${BASE_URL}/${item.route}/`),
  ];

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((loc) => `  <url><loc>${loc}</loc></url>`),
    '</urlset>',
    '',
  ].join('\n');

  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`Generated ${routeList.length} post pages and sitemap.xml`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
