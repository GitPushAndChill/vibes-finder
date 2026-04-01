// ===============================
// Debug Configuration
// ===============================
const DEBUG = false;

function log(message, style = '') {
    if (DEBUG) console.log(`%c${message}`, style);
}

function warn(message) {
    if (DEBUG) console.warn(message);
}

function error(message) {
    if (DEBUG) console.error(message);
}

// ===============================
// Ads Consent
// ===============================
const ADS_CONSENT_STORAGE_KEY = 'vf-ads-consent';
const CONSENT_STORAGE_KEY = 'vf-consent-v2';
const ADS_CLIENT_ID = 'ca-pub-6784233656400841';
const ADS_SCRIPT_SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS_CLIENT_ID}`;
const GA_MEASUREMENT_ID = 'G-YPKV051KH6';
const GA_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

const CONSENT_STATE_DENIED = {
    analytics: false,
    ads: false,
};

function normalizeConsent(input) {
    const source = input || {};
    return {
        analytics: Boolean(source.analytics),
        ads: Boolean(source.ads),
    };
}

function toConsentStoragePayload(consent) {
    const normalized = normalizeConsent(consent);
    return JSON.stringify({
        version: 1,
        analytics: normalized.analytics,
        ads: normalized.ads,
        updatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
}

function readLegacyAdsConsent() {
    try {
        const legacyValue = localStorage.getItem(ADS_CONSENT_STORAGE_KEY);
        if (legacyValue === 'granted') {
            return { analytics: true, ads: true };
        }
        if (legacyValue === 'denied') {
            return { analytics: false, ads: false };
        }
    } catch (err) {
        return null;
    }
    return null;
}

function getStoredConsent() {
    try {
        const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed) {
                return normalizeConsent(parsed);
            }
        }
    } catch (err) {
        warn('Unable to read consent preference.');
    }

    const legacy = readLegacyAdsConsent();
    if (legacy) {
        setStoredConsent(legacy);
        return legacy;
    }

    return null;
}

function setStoredConsent(consent) {
    const normalized = normalizeConsent(consent);
    try {
        localStorage.setItem(CONSENT_STORAGE_KEY, toConsentStoragePayload(normalized));
        localStorage.setItem(ADS_CONSENT_STORAGE_KEY, normalized.ads ? 'granted' : 'denied');
    } catch (err) {
        warn('Unable to persist consent preference.');
    }
}

function ensureGtagBase() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
        window.gtag = function gtag() {
            window.dataLayer.push(arguments);
        };
    }
}

function ensureGoogleAnalyticsLoaded() {
    if (document.querySelector('script[data-ga-loader="1"]')) return;
    if (document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = GA_SCRIPT_SRC;
    script.dataset.gaLoader = '1';
    document.head.appendChild(script);
}

function setConsentModeDefaults() {
    ensureGtagBase();
    window.gtag('consent', 'default', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        wait_for_update: 500,
    });
}

function ensureAdSenseLoaded() {
    if (document.querySelector(`script[src*="googlesyndication.com/pagead/js/adsbygoogle.js"]`)) return;
    if (window.__vfAdSenseLoading) return;
    window.__vfAdSenseLoading = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = ADS_SCRIPT_SRC;
    script.crossOrigin = 'anonymous';
    script.addEventListener('error', () => {
        window.__vfAdSenseLoading = false;
    });
    document.head.appendChild(script);
}

function applyConsent(consent, { persist = false } = {}) {
    const normalized = normalizeConsent(consent);
    const analyticsGranted = normalized.analytics;
    const adsGranted = normalized.ads;

    ensureGtagBase();
    window.gtag('consent', 'update', {
        analytics_storage: analyticsGranted ? 'granted' : 'denied',
        ad_storage: adsGranted ? 'granted' : 'denied',
        ad_user_data: adsGranted ? 'granted' : 'denied',
        ad_personalization: adsGranted ? 'granted' : 'denied',
    });

    if (analyticsGranted || adsGranted) {
        ensureGoogleAnalyticsLoaded();
        window.gtag('js', new Date());
        window.gtag('config', GA_MEASUREMENT_ID, {
            anonymize_ip: true,
        });
    }

    window.adsbygoogle = window.adsbygoogle || [];
    window.adsbygoogle.requestNonPersonalizedAds = adsGranted ? 0 : 1;

    if (adsGranted) {
        ensureAdSenseLoaded();
    }

    if (persist) {
        setStoredConsent(normalized);
    }
}

function closeAdsConsentBanner() {
    const banner = document.querySelector('#ads-consent-banner');
    if (banner && banner.parentNode) {
        banner.parentNode.removeChild(banner);
    }
}

function showAdsConsentBanner() {
    if (document.querySelector('#ads-consent-banner')) return;

    const banner = document.createElement('aside');
    banner.id = 'ads-consent-banner';
    banner.className = 'ads-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Privacy consent settings');

    banner.innerHTML = `
        <p class="ads-consent-text">
            We use cookies for analytics and ad personalization. Choose how your data may be used.
        </p>
        <p class="ads-consent-links">
            Read our <a href="${toSitePath('privacy.html')}">Privacy Policy</a> and <a href="${toSitePath('cookies.html')}">Cookie Policy</a>.
        </p>
        <div class="ads-consent-actions">
            <button type="button" class="ads-consent-btn ads-consent-btn-secondary" data-consent-choice="reject">Reject</button>
            <button type="button" class="ads-consent-btn ads-consent-btn-secondary" data-consent-choice="analytics-only">Analytics Only</button>
            <button type="button" class="ads-consent-btn ads-consent-btn-primary" data-consent-choice="accept-all">Accept All</button>
        </div>
    `;

    banner.addEventListener('click', (event) => {
        const button = event.target.closest('[data-consent-choice]');
        if (!button) return;

        const choice = String(button.getAttribute('data-consent-choice') || 'reject');
        let consent = CONSENT_STATE_DENIED;

        if (choice === 'analytics-only') {
            consent = { analytics: true, ads: false };
        } else if (choice === 'accept-all') {
            consent = { analytics: true, ads: true };
        }

        applyConsent(consent, { persist: true });
        closeAdsConsentBanner();
    });

    document.body.appendChild(banner);
}

function ensureConsentSettingsButton() {
    if (document.querySelector('#consent-settings-btn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'consent-settings-btn';
    button.className = 'consent-settings-btn';
    button.textContent = 'Privacy settings';
    button.setAttribute('aria-label', 'Open privacy settings');
    button.addEventListener('click', () => {
        showAdsConsentBanner();
    });

    document.body.appendChild(button);
}

function mapCmpConsent(cmpConsent) {
    const source = cmpConsent || {};
    return {
        analytics: Boolean(source.analytics),
        ads: Boolean(source.ads || source.advertising || source.ad_personalization || source.ad_user_data),
    };
}

function installCmpConsentBridge() {
    window.updateConsentFromCMP = function updateConsentFromCMP(cmpConsent) {
        const mapped = mapCmpConsent(cmpConsent);
        applyConsent(mapped, { persist: true });
        closeAdsConsentBanner();
    };

    window.addEventListener('cmp:consent-changed', (event) => {
        const mapped = mapCmpConsent(event?.detail || {});
        applyConsent(mapped, { persist: true });
        closeAdsConsentBanner();
    });
}

function initAdsConsent() {
    setConsentModeDefaults();
    ensureConsentSettingsButton();
    installCmpConsentBridge();

    const stored = getStoredConsent();
    if (stored) {
        applyConsent(stored);
        return;
    }

    applyConsent(CONSENT_STATE_DENIED);
    showAdsConsentBanner();
}

// ===============================
// Script Loaded Timestamp
// ===============================
const currentDate = new Date();
const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
log(`Script loaded at (UTC): ${formattedDate}`, 'color: green; font-weight: bold;');

const CITY_PAGE_MAP = {
    amsterdam: 'city/amsterdam/',
    haarlem: 'city/haarlem/',
    rotterdam: 'city/rotterdam/',
    utrecht: 'city/utrecht/',
};

function getSiteRootPrefix() {
    const fromBody = document.body?.getAttribute('data-site-root');
    if (fromBody) {
        return fromBody.endsWith('/') ? fromBody : `${fromBody}/`;
    }
    return './';
}

function toSitePath(relativePath) {
    const raw = String(relativePath || '').trim();
    if (!raw) return getSiteRootPrefix();
    if (/^(https?:|mailto:|tel:|#)/i.test(raw)) return raw;

    const cleaned = raw.replace(/^\/+/, '');
    return `${getSiteRootPrefix()}${cleaned}`;
}

function normalizeCityKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function getCurrentCityKey() {
    const path = String(window.location.pathname || '').toLowerCase();
    const match = path.match(/\/city\/([^/]+)\/?/i);
    return match ? normalizeCityKey(match[1]) : '';
}

function getCityPagePath(cityName) {
    const cityKey = normalizeCityKey(cityName);
    return CITY_PAGE_MAP[cityKey] || 'blog.html';
}

// ===============================
// Theme (Dark / Light)
// ===============================
const THEME_STORAGE_KEY = 'vf-theme';

function getStoredTheme() {
    try {
        const value = localStorage.getItem(THEME_STORAGE_KEY);
        return value === 'light' || value === 'dark' ? value : null;
    } catch (err) {
        return null;
    }
}

function getActiveTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function applyTheme(theme, { persist = false } = {}) {
    const safeTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', safeTheme);

    if (persist) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
        } catch (err) {
            warn('Unable to persist theme preference.');
        }
    }

    window.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: safeTheme }
    }));
}

function initThemeToggle() {
    const navWrap = document.querySelector('.site-header .nav-wrap');
    if (!navWrap || document.querySelector('#theme-toggle')) return;

    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'theme-toggle-wrap';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'theme-toggle';
    toggle.id = 'theme-toggle';
    toggle.setAttribute('aria-label', 'Switch to light mode');
    toggle.innerHTML = `
        <span class="theme-toggle-icon theme-toggle-icon-moon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
                <path d="M21 14.2A9 9 0 1 1 9.8 3a7 7 0 1 0 11.2 11.2z"></path>
            </svg>
        </span>
        <span class="theme-toggle-icon theme-toggle-icon-sun" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="12" r="4.2"></circle>
                <line x1="12" y1="1.8" x2="12" y2="4.2"></line>
                <line x1="12" y1="19.8" x2="12" y2="22.2"></line>
                <line x1="1.8" y1="12" x2="4.2" y2="12"></line>
                <line x1="19.8" y1="12" x2="22.2" y2="12"></line>
                <line x1="4.3" y1="4.3" x2="6" y2="6"></line>
                <line x1="18" y1="18" x2="19.7" y2="19.7"></line>
                <line x1="18" y1="6" x2="19.7" y2="4.3"></line>
                <line x1="4.3" y1="19.7" x2="6" y2="18"></line>
            </svg>
        </span>
    `;

    const updateToggleState = (theme) => {
        const isLight = theme === 'light';
        toggle.setAttribute('aria-pressed', isLight ? 'true' : 'false');
        toggle.setAttribute('title', isLight ? 'Light mode is on' : 'Dark mode is on');
        toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    };

    updateToggleState(getActiveTheme());

    toggle.addEventListener('click', () => {
        const nextTheme = getActiveTheme() === 'light' ? 'dark' : 'light';
        applyTheme(nextTheme, { persist: true });
    });

    window.addEventListener('themechange', (event) => {
        updateToggleState(event?.detail?.theme || getActiveTheme());
    });

    toggleWrap.appendChild(toggle);
    navWrap.appendChild(toggleWrap);
}

function initCityMenu() {
    const nav = document.querySelector('.site-header .main-nav');
    if (!nav || nav.querySelector('.city-menu')) return;
    const isCityPage = /\/city\//i.test(window.location.pathname);
    const currentCityKey = getCurrentCityKey();

    const menu = document.createElement('div');
    menu.className = 'city-menu';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'city-menu-trigger';
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-label', 'Browse city pages');
    trigger.textContent = 'City';

    const dropdown = document.createElement('div');
    dropdown.className = 'city-menu-dropdown';
    dropdown.setAttribute('role', 'menu');

    const cityItems = [
        { label: 'Amsterdam', path: CITY_PAGE_MAP.amsterdam },
        { label: 'Haarlem', path: CITY_PAGE_MAP.haarlem },
        { label: 'Rotterdam', path: CITY_PAGE_MAP.rotterdam },
        { label: 'Utrecht', path: CITY_PAGE_MAP.utrecht },
    ];

    cityItems.forEach((item) => {
        const link = document.createElement('a');
        link.href = toSitePath(item.path);
        link.setAttribute('role', 'menuitem');
        link.textContent = item.label;
        if (normalizeCityKey(item.label) === currentCityKey) {
            link.setAttribute('aria-current', 'page');
        }
        dropdown.appendChild(link);
    });

    const setExpanded = (isOpen) => {
        menu.classList.toggle('is-open', Boolean(isOpen));
        trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        setExpanded(!menu.classList.contains('is-open'));
    });

    document.addEventListener('click', (event) => {
        if (!menu.contains(event.target)) {
            setExpanded(false);
        }
    });

    menu.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setExpanded(false);
            trigger.focus();
        }
    });

    menu.appendChild(trigger);
    menu.appendChild(dropdown);

    const vibesLink = Array.from(nav.querySelectorAll('a')).find((a) => /vibes/i.test(a.textContent || ''));
    if (vibesLink) {
        vibesLink.insertAdjacentElement('afterend', menu);
    } else {
        nav.appendChild(menu);
    }

    if (isCityPage) {
        nav.querySelectorAll(':scope > a.active, :scope > a[aria-current="page"]').forEach((link) => {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        });
        trigger.setAttribute('aria-current', 'page');
    }
}

applyTheme(getStoredTheme() || getActiveTheme());

// ===============================
// Modal Analytics (Session Only)
// ===============================
let modalOpenCount = 0;

// ===============================
// Article Expansion Logic
// ===============================


// --- Refactored grid rendering logic ---
let postsData = null; // cache for posts

const DEFAULT_VIBE_DEFINITIONS = {
    classy: { icon: '🍸', label: 'Classy', definition: 'Dress up and romanticize it.' },
    easygoing: { icon: '👯‍♀️', label: 'Easygoing', definition: 'Keep it simple and just show up.' },
    do_mode: { icon: '🎯', label: 'Do Mode', definition: 'Have the experience and make memories.' },
    social: { icon: '🪩', label: 'Social', definition: 'Feel the energy and meet people.' },
    culture_craving: { icon: '🎭', label: 'Culture Craving', definition: 'Feed the brain and find your muse.' },
    date_night: { icon: '❤️‍🔥', label: 'Date Night', definition: 'Make it electric and feel the spark.' },
    alternative: { icon: '🦄', label: 'Alternative', definition: 'Break the stereotypical and find unexpected.' },
    little_ones: { icon: '🧸', label: 'Little Ones', definition: 'Embrace sweet childhood and play it out.' },
    outdoorsy: { icon: '🤸🏽‍♀️', label: 'Outdoorsy', definition: 'Step outside and dare to explore.' },
    hidden_gems: { icon: '💎', label: 'Hidden Gems', definition: 'Discover it, but keep it secret.' },
    beer_lovers: { icon: '🍺', label: 'Beer Lovers', definition: 'Sip it and savour it.' },
    golden_summertime: { icon: '🌞', label: 'Golden Summertime', definition: 'Catch the sun and immerse into summer.' },
    coffee_and_chill: { icon: '☕', label: 'Coffee & Chill', definition: 'Slow down and enjoy the caffeine kick.' },
    cute_girl_brunch: { icon: '🥐', label: 'Cute Girl Brunch', definition: 'Get the girls and indulge in slow mornings.' },
};

let VIBE_DEFINITIONS = { ...DEFAULT_VIBE_DEFINITIONS };
let VIBE_DEFINITIONS_FROM_YAML = null;
let VIBE_ICON_MAP = Object.fromEntries(
    Object.entries(VIBE_DEFINITIONS).map(([key, def]) => [key, def.icon || '•'])
);

function normalizeVibeKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replaceAll('&', 'and')
        .replace(/[\s\/]+/g, '_')
        .replace(/[^a-z0-9_]/g, '')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function findVibeDefinition(vibe) {
    const key = normalizeVibeKey(vibe);
    if (VIBE_DEFINITIONS[key]) return { key, def: VIBE_DEFINITIONS[key] };

    const byLabelEntry = Object.entries(VIBE_DEFINITIONS).find(([, def]) =>
        normalizeVibeKey(def?.label) === key
    );
    if (byLabelEntry) {
        return { key: byLabelEntry[0], def: byLabelEntry[1] };
    }

    return null;
}

function getPostVibes(post) {
    if (!post) return [];

    const source = Array.isArray(post.vibes) && post.vibes.length
        ? post.vibes
        : (post.vibe ? [post.vibe] : []);

    const normalized = source
        .map((v) => normalizeVibeKey(v))
        .filter(Boolean);

    return Array.from(new Set(normalized));
}

function getPostPrimaryVibe(post) {
    return getPostVibes(post)[0] || '';
}

function getPostDisplayTitle(post) {
    const place = String(post?.place || '').trim();
    if (place) return place;
    return String(post?.title || '').trim();
}

function parseVibesYaml(yamlText) {
    const definitions = {};
    const lines = String(yamlText || '').split(/\r?\n/);
    let inVibesBlock = false;
    let currentVibeKey = null;

    for (const rawLine of lines) {
        const line = rawLine.replace(/\t/g, '    ');
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        if (!inVibesBlock) {
            if (trimmed === 'vibes:') inVibesBlock = true;
            continue;
        }

        const vibeMatch = line.match(/^\s{2}([a-zA-Z0-9_-]+):\s*$/);
        if (vibeMatch) {
            currentVibeKey = vibeMatch[1].toLowerCase();
            if (!definitions[currentVibeKey]) definitions[currentVibeKey] = {};
            continue;
        }

        const propMatch = line.match(/^\s{4}([a-zA-Z0-9_-]+):\s*(.+)\s*$/);
        if (propMatch && currentVibeKey) {
            const prop = propMatch[1].toLowerCase();
            let value = propMatch[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            definitions[currentVibeKey][prop] = value;
        }
    }

    return definitions;
}

async function loadVibeDefinitionsFromYaml() {
    try {
        const response = await fetch(toSitePath('content/vibes.yml'), { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const yamlText = await response.text();
        const parsed = parseVibesYaml(yamlText);

        const parsedKeys = Object.keys(parsed);
        if (!parsedKeys.length) {
            warn('No vibe definitions found in content/vibes.yml, using defaults.');
            return;
        }

        const yamlOnlyDefinitions = {};
        parsedKeys.forEach((rawKey) => {
            const normalizedKey = normalizeVibeKey(rawKey);
            if (!normalizedKey) return;

            const parsedDef = parsed[rawKey] || {};
            yamlOnlyDefinitions[normalizedKey] = {
                label: parsedDef.label || rawKey,
                icon: parsedDef.icon || '•',
                definition: parsedDef.definition || '',
            };
        });

        const merged = { ...DEFAULT_VIBE_DEFINITIONS };
        parsedKeys.forEach((rawKey) => {
            const normalizedKey = normalizeVibeKey(rawKey);
            if (!normalizedKey) return;

            const parsedDef = parsed[rawKey] || {};
            const baseDef = merged[normalizedKey] || {};
            merged[normalizedKey] = {
                ...baseDef,
                ...parsedDef,
                label: parsedDef.label || baseDef.label || rawKey,
                icon: parsedDef.icon || baseDef.icon || '•',
            };
        });

        VIBE_DEFINITIONS = merged;
        VIBE_DEFINITIONS_FROM_YAML = yamlOnlyDefinitions;
        VIBE_ICON_MAP = Object.fromEntries(
            Object.entries(VIBE_DEFINITIONS).map(([key, def]) => [key, def.icon || '•'])
        );

        log(`Loaded ${parsedKeys.length} vibe definitions from YAML`, 'color: #c6a76e;');
    } catch (err) {
        warn(`Failed to load content/vibes.yml, using default vibe icons. (${err?.message || err})`);
    }
}

const vibeConfigReady = loadVibeDefinitionsFromYaml();
if (typeof window !== 'undefined') {
    window.vibeConfigReady = vibeConfigReady;
}

let _sortedPostsCache = null;
let _postRouteMap = null;

function slugifyAscii(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'item';
}

function getPostIdentity(post) {
    return [
        String(post?.city || '').trim(),
        String(post?.place || '').trim(),
        String(post?.adress || '').trim(),
        String(post?.created_on || '').trim(),
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

function buildPostRouteMap(posts) {
    if (!Array.isArray(posts) || !posts.length) {
        _postRouteMap = new Map();
        return _postRouteMap;
    }

    const entries = posts.map((post) => {
        const citySlug = slugifyAscii(post?.city);
        const placeBase = slugifyAscii(post?.place || post?.title);
        const basePath = `city/${citySlug}/${placeBase}`;
        const identity = getPostIdentity(post);
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

    _postRouteMap = routeByIdentity;
    return _postRouteMap;
}

function getPostRoute(post) {
    const identity = getPostIdentity(post);
    if (_postRouteMap && _postRouteMap.has(identity)) {
        return _postRouteMap.get(identity);
    }

    const fallbackCity = slugifyAscii(post?.city);
    const fallbackPlace = slugifyAscii(post?.place || post?.title);
    return `city/${fallbackCity}/${fallbackPlace}`;
}

function getPostUrl(post) {
    return toSitePath(`${getPostRoute(post)}/index.html`);
}

function getSortedPosts() {
    if (_sortedPostsCache) return _sortedPostsCache;
    if (!Array.isArray(postsData)) return [];
    _sortedPostsCache = postsData
        .slice()
        .sort((a, b) => {
            const aTime = Date.parse(a?.created_on || '') || 0;
            const bTime = Date.parse(b?.created_on || '') || 0;
            return bTime - aTime;
        });
    return _sortedPostsCache;
}

function getFilteredPosts({ cityFilter = '', vibeFilter = '' } = {}) {
    const cityNeedle = String(cityFilter || '').trim().toLowerCase();
    const vibeNeedle = String(vibeFilter || '').trim().toLowerCase();

    let posts = getSortedPosts();
    if (cityNeedle) {
        posts = posts.filter(p => String(p?.city || '').toLowerCase().includes(cityNeedle));
    }
    if (vibeNeedle) {
        posts = posts.filter((p) => {
            const vibes = getPostVibes(p);
            return vibes.some((v) => {
                const label = getVibeLabel(v).toLowerCase();
                return v.includes(vibeNeedle) || label.includes(vibeNeedle);
            });
        });
    }

    return posts;
}

function populatePostGrid({ containerSelector, limit, offset = 0, cityFilter = '', vibeFilter = '' }) {
    const container = document.querySelector(containerSelector);
    if (!container || !postsData) return { totalPosts: 0, renderedPosts: 0 };
    container.innerHTML = '';

    let posts = getFilteredPosts({ cityFilter, vibeFilter });
    const totalPosts = posts.length;
    const safeOffset = Math.max(0, Number(offset) || 0);

    if (typeof limit === 'number') {
        posts = posts.slice(safeOffset, safeOffset + limit);
    } else if (safeOffset > 0) {
        posts = posts.slice(safeOffset);
    }

    posts.forEach(post => {
        const article = document.createElement('article');
        article.className = 'card';
        article._post = post;
        article.dataset.postUrl = getPostUrl(post);
        article.setAttribute('role', 'link');
        article.tabIndex = 0;
        article.style.cursor = 'pointer';

        const h2 = document.createElement('h2');
        h2.className = 'card-title';
        h2.textContent = getPostDisplayTitle(post);
        article.appendChild(h2);

        const meta = document.createElement('time');
        meta.className = 'meta';
        meta.textContent = post.city || '';
        article.appendChild(meta);

        const p = document.createElement('p');
        p.className = 'excerpt';
        p.textContent = post.short_description || post.description || '';
        article.appendChild(p);

        // full-text is NOT pre-rendered here — it is built on-demand inside openPostModal
        // to avoid doubling DOM nodes for every visible grid card.

        const postVibes = getPostVibes(post);
        if (postVibes.length) {
            const vibeBadge = document.createElement('div');
            vibeBadge.className = 'vibe-badge';

            const icon = document.createElement('span');
            icon.className = 'vibe-badge-icon';
            icon.textContent = getVibeIcon(postVibes[0]);
            vibeBadge.appendChild(icon);

            const text = document.createElement('span');
            text.className = 'vibe-badge-text';
            const labels = postVibes.map(getVibeLabel);
            if (labels.length <= 2) {
                text.textContent = labels.join(' • ');
            } else {
                text.textContent = `${labels.slice(0, 2).join(' • ')} +${labels.length - 2}`;
            }
            vibeBadge.appendChild(text);

            article.appendChild(vibeBadge);
        }

        container.appendChild(article);
    });

    return { totalPosts, renderedPosts: posts.length };
}

function getVibeIcon(vibe) {
    if (!vibe) return '';
    const found = findVibeDefinition(vibe);
    return found?.def?.icon || '•';
}

function getVibeLabel(vibe) {
    if (!vibe) return '';
    const found = findVibeDefinition(vibe);
    if (found?.def?.label) return found.def.label;

    const normalized = normalizeVibeKey(vibe).replaceAll('_', ' ');
    return toTitleCase(normalized);
}

function initBlogFilters() {
    const grid = document.querySelector('#all-posts-grid');
    if (!grid) return;
    const pageSize = 12;
    let currentPage = 1;

    initBlogVibeGuide();

    const cityInput = document.querySelector('#city-filter');
    const vibeInput = document.querySelector('#vibe-filter');
    const citySelect = document.querySelector('#city-select');
    const vibeSelect = document.querySelector('#vibe-select');
    const cityOptions = document.querySelector('#city-options');
    const vibeOptions = document.querySelector('#vibe-options');
    const lockedCity = String(document.body?.dataset?.prefilterCity || '').trim();

    let paginationNav = document.querySelector('#posts-pagination');
    if (!paginationNav) {
        paginationNav = document.createElement('nav');
        paginationNav.id = 'posts-pagination';
        paginationNav.className = 'post-pagination';
        paginationNav.setAttribute('aria-label', 'Post pagination');
        paginationNav.innerHTML = `
            <button type="button" class="btn post-pagination-btn" id="posts-prev-page">← Previous</button>
            <span class="post-pagination-status" id="posts-pagination-status" aria-live="polite"></span>
            <button type="button" class="btn post-pagination-btn" id="posts-next-page">Next →</button>
        `;
        grid.insertAdjacentElement('afterend', paginationNav);
    }

    const prevPageBtn = paginationNav.querySelector('#posts-prev-page');
    const nextPageBtn = paginationNav.querySelector('#posts-next-page');
    const paginationStatus = paginationNav.querySelector('#posts-pagination-status');

    if (!cityInput || !vibeInput || !cityOptions || !vibeOptions) {
        // filters not present; just render the grid
        const totalPosts = getSortedPosts().length;
        const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));
        const pageOffset = (currentPage - 1) * pageSize;
        populatePostGrid({ containerSelector: '#all-posts-grid', limit: pageSize, offset: pageOffset });

        if (paginationStatus) {
            paginationStatus.textContent = totalPosts ? `Page ${currentPage} of ${totalPages}` : 'No posts found';
        }
        if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

        if (prevPageBtn && prevPageBtn.dataset.bound !== '1') {
            prevPageBtn.dataset.bound = '1';
            prevPageBtn.addEventListener('click', () => {
                if (currentPage <= 1) return;
                currentPage -= 1;
                const offset = (currentPage - 1) * pageSize;
                populatePostGrid({ containerSelector: '#all-posts-grid', limit: pageSize, offset });
                if (paginationStatus) paginationStatus.textContent = `Page ${currentPage} of ${totalPages}`;
                prevPageBtn.disabled = currentPage <= 1;
                if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
                initArticleModal();
            });
        }

        if (nextPageBtn && nextPageBtn.dataset.bound !== '1') {
            nextPageBtn.dataset.bound = '1';
            nextPageBtn.addEventListener('click', () => {
                if (currentPage >= totalPages) return;
                currentPage += 1;
                const offset = (currentPage - 1) * pageSize;
                populatePostGrid({ containerSelector: '#all-posts-grid', limit: pageSize, offset });
                if (paginationStatus) paginationStatus.textContent = `Page ${currentPage} of ${totalPages}`;
                nextPageBtn.disabled = currentPage >= totalPages;
                if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
                initArticleModal();
            });
        }

        initArticleModal();
        return;
    }

    const posts = getSortedPosts();
    const cities = Array.from(new Set(posts.map(p => p?.city).filter(Boolean))).sort();
    const vibes = Array.from(
        new Set(
            posts.flatMap((p) => getPostVibes(p))
        )
    ).sort((a, b) => getVibeLabel(a).localeCompare(getVibeLabel(b)));

    cityOptions.innerHTML = cities.map(c => `<option value="${escapeHtmlAttr(c)}"></option>`).join('');
    vibeOptions.innerHTML = vibes.map(v => `<option value="${escapeHtmlAttr(v)}"></option>`).join('');

    if (citySelect) {
        citySelect.innerHTML = '';
        const anyCity = document.createElement('option');
        anyCity.value = '';
        anyCity.textContent = 'Any city';
        citySelect.appendChild(anyCity);
        cities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            citySelect.appendChild(opt);
        });

        if (lockedCity) {
            const hasLockedCity = Array.from(citySelect.options).some((opt) =>
                String(opt.value || '').toLowerCase() === lockedCity.toLowerCase()
            );
            if (!hasLockedCity) {
                const opt = document.createElement('option');
                opt.value = lockedCity;
                opt.textContent = lockedCity;
                citySelect.appendChild(opt);
            }
            citySelect.value = lockedCity;
            citySelect.disabled = true;
            citySelect.setAttribute('aria-disabled', 'true');
        }
    }
    if (vibeSelect) {
        vibeSelect.innerHTML = '';
        const anyVibe = document.createElement('option');
        anyVibe.value = '';
        anyVibe.textContent = 'Any vibe';
        vibeSelect.appendChild(anyVibe);
        vibes.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            const emoji = getVibeIcon(v);
            opt.textContent = `${emoji ? emoji + ' ' : ''}${getVibeLabel(v)}`;
            vibeSelect.appendChild(opt);
        });
    }

    const getActiveValue = (inputEl, selectEl) => {
        if (lockedCity && inputEl?.id === 'city-filter') return lockedCity;
        if (selectEl) return selectEl.value;
        return inputEl.value;
    };

    if (lockedCity) {
        cityInput.value = lockedCity;
        cityInput.disabled = true;
        cityInput.setAttribute('aria-disabled', 'true');
        const cityFilterGroup = cityInput.closest('.filter-group');
        if (cityFilterGroup) cityFilterGroup.classList.add('filter-group-locked');
    }

    const syncSelectToInput = (inputEl, selectEl) => {
        if (!selectEl) return;
        const needle = String(inputEl.value || '').trim().toLowerCase();
        if (!needle) {
            selectEl.value = '';
            return;
        }
        const match = Array.from(selectEl.options).find(o => String(o.value || '').trim().toLowerCase() === needle);
        selectEl.value = match ? match.value : '';
    };

    const syncInputToSelect = (inputEl, selectEl) => {
        if (!selectEl) return;
        inputEl.value = selectEl.value;
    };

    const render = () => {
        const cityFilter = getActiveValue(cityInput, citySelect);
        const vibeFilter = getActiveValue(vibeInput, vibeSelect);
        const totalPosts = getFilteredPosts({ cityFilter, vibeFilter }).length;
        const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        const pageOffset = (currentPage - 1) * pageSize;
        populatePostGrid({
            containerSelector: '#all-posts-grid',
            limit: pageSize,
            offset: pageOffset,
            cityFilter,
            vibeFilter,
        });

        if (paginationStatus) {
            paginationStatus.textContent = totalPosts ? `Page ${currentPage} of ${totalPages}` : 'No posts found';
        }
        if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;

        initArticleModal();
    };

    const renderFromFirstPage = () => {
        currentPage = 1;
        render();
    };

    if (!lockedCity) {
        cityInput.addEventListener('input', () => {
            syncSelectToInput(cityInput, citySelect);
            renderFromFirstPage();
        });
    }
    vibeInput.addEventListener('input', () => {
        syncSelectToInput(vibeInput, vibeSelect);
        renderFromFirstPage();
    });

    if (citySelect && !lockedCity) {
        citySelect.addEventListener('change', () => {
            syncInputToSelect(cityInput, citySelect);
            renderFromFirstPage();
        });
    }
    if (vibeSelect) {
        vibeSelect.addEventListener('change', () => {
            syncInputToSelect(vibeInput, vibeSelect);
            renderFromFirstPage();
        });
    }

    if (prevPageBtn && prevPageBtn.dataset.bound !== '1') {
        prevPageBtn.dataset.bound = '1';
        prevPageBtn.addEventListener('click', () => {
            if (currentPage <= 1) return;
            currentPage -= 1;
            render();
        });
    }

    if (nextPageBtn && nextPageBtn.dataset.bound !== '1') {
        nextPageBtn.dataset.bound = '1';
        nextPageBtn.addEventListener('click', () => {
            const cityFilter = getActiveValue(cityInput, citySelect);
            const vibeFilter = getActiveValue(vibeInput, vibeSelect);
            const totalPosts = getFilteredPosts({ cityFilter, vibeFilter }).length;
            const totalPages = Math.max(1, Math.ceil(totalPosts / pageSize));
            if (currentPage >= totalPages) return;
            currentPage += 1;
            render();
        });
    }

    render();
}

function initBlogVibeGuide() {
    const toggleBtn = document.querySelector('#toggle-vibe-guide-btn');
    if (!toggleBtn) return;
    if (toggleBtn.dataset.bound === '1') return;
    toggleBtn.dataset.bound = '1';

    toggleBtn.textContent = '👓 Learn about the Vibes 👓';

    toggleBtn.addEventListener('click', () => {
        const sourceDefinitions = (VIBE_DEFINITIONS_FROM_YAML && Object.keys(VIBE_DEFINITIONS_FROM_YAML).length)
            ? VIBE_DEFINITIONS_FROM_YAML
            : VIBE_DEFINITIONS;

        const vibeEntries = Object.entries(sourceDefinitions)
            .map(([key, def]) => ({
                key,
                icon: def?.icon || '•',
                label: def?.label || toTitleCase(String(key || '').replaceAll('_', ' ')),
                definition: def?.definition || '',
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        const guideCard = document.createElement('article');
        guideCard.className = 'card vibe-guide-article';

        const heading = document.createElement('h2');
        heading.className = 'card-title';
        heading.textContent = 'All vibe descriptions';
        guideCard.appendChild(heading);

        const intro = document.createElement('p');
        intro.className = 'excerpt';
        intro.textContent = 'A quick overview of every vibe used across the posts.';
        guideCard.appendChild(intro);

        const guideList = document.createElement('div');
        guideList.className = 'vibe-guide-list';

        vibeEntries.forEach((entry) => {
            const item = document.createElement('article');
            item.className = 'vibe-guide-item';

            const title = document.createElement('h3');
            title.className = 'vibe-guide-item-title';
            title.textContent = `${entry.icon} ${entry.label}`;

            const description = document.createElement('p');
            description.className = 'vibe-guide-item-desc';
            description.textContent = entry.definition;

            item.appendChild(title);
            item.appendChild(description);
            guideList.appendChild(item);
        });

        guideCard.appendChild(guideList);
        openModalWithCard(guideCard);
    });
}

function toTitleCase(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtmlAttr(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function fetchAndRenderGrids() {
    fetch(toSitePath('posts/places/posts-places.json'))
        .then(r => r.json())
        .then(data => {
            postsData = data;
            _sortedPostsCache = null; // invalidate sort cache on fresh data
            buildPostRouteMap(postsData);
            // Detect and render preview grid (index.html)
            if (document.querySelector('#preview-grid')) {
                populatePostGrid({ containerSelector: '#preview-grid', limit: 3 });
            }
            // Detect and render all-posts grid (blog.html)
            if (document.querySelector('#all-posts-grid')) {
                initBlogFilters();
            }
            // ensure modal wiring is applied after initial render
            initArticleModal();

            // index.html quick actions
            initIndexQuickActions();
        })
        .catch(err => {
            console.error('Failed to load posts:', err);
        });
}

function initIndexQuickActions() {
    const surpriseBtn = document.querySelector('#surprise-me-btn');
    if (!surpriseBtn) return;

    if (surpriseBtn.dataset.bound === '1') return;
    surpriseBtn.dataset.bound = '1';

    surpriseBtn.addEventListener('click', () => {
        const posts = getSortedPosts();
        if (!posts.length) return;
        const randomPost = posts[Math.floor(Math.random() * posts.length)];
        window.location.href = getPostUrl(randomPost);
    });
}

function buildPostCardForModal(post) {
    const article = document.createElement('article');
    article.className = 'card';
    article._post = post;

    const h2 = document.createElement('h2');
    h2.className = 'card-title';
    h2.textContent = getPostDisplayTitle(post);
    article.appendChild(h2);

    const meta = document.createElement('time');
    meta.className = 'meta';
    meta.textContent = post.city || '';
    article.appendChild(meta);

    const p = document.createElement('p');
    p.className = 'excerpt';
    p.textContent = post.short_description || post.description || '';
    article.appendChild(p);

    const full = document.createElement('div');
    full.className = 'full-text';
    full.hidden = true;
    const shortDesc = post.short_description || '';
    const longDesc = post.description || '';
    if (shortDesc && longDesc && shortDesc.trim() !== longDesc.trim()) {
        full.innerHTML = `<p class="short-desc">${shortDesc}</p><p class="long-desc">${longDesc}</p>`;
    } else if (shortDesc) {
        full.innerHTML = `<p class="short-desc">${shortDesc}</p>`;
    } else if (longDesc) {
        full.innerHTML = `<p class="long-desc">${longDesc}</p>`;
    }
    article.appendChild(full);

    return article;
}

function getPostIndexInSortedList(post) {
    if (!post) return -1;
    const sorted = getSortedPosts();
    if (!sorted.length) return -1;

    return sorted.findIndex((candidate) => {
        const sameCreated = String(candidate?.created_on || '') === String(post?.created_on || '');
        const sameTitle = String(candidate?.title || '') === String(post?.title || '');
        return sameCreated && sameTitle;
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initAdsConsent();
        initCityMenu();
        initThemeToggle();
        vibeConfigReady.finally(fetchAndRenderGrids);
    });
} else {
    initAdsConsent();
    initCityMenu();
    initThemeToggle();
    vibeConfigReady.finally(fetchAndRenderGrids);
}


// ---- Modal state: single overlay instance + single ESC handler ----
// Keeping one reference means closeModal() always tears down the current modal
// completely (including the ESC listener), so nothing leaks between opens.
let _modalOverlay = null;
let _modalEscHandler = null;

function closeModal() {
    if (_modalEscHandler) {
        document.removeEventListener('keydown', _modalEscHandler);
        _modalEscHandler = null;
    }
    if (_modalOverlay) {
        // Setting src='' lets the browser release decoded image memory immediately.
        _modalOverlay.querySelectorAll('img').forEach(img => { img.src = ''; });
        if (document.body.contains(_modalOverlay)) {
            document.body.removeChild(_modalOverlay);
        }
        _modalOverlay = null;
    }
}

function initArticleModal() {
    // Dedicated post pages are already a full article view; do not attach card-level
    // delegation there because it can intercept slider/button interactions.
    if (document.body.classList.contains('post-detail-page')) return;

    // One-time delegation on body — no per-card listeners, no re-run on grid re-renders.
    if (document.body.dataset.modalDelegated === '1') return;
    document.body.dataset.modalDelegated = '1';

    document.body.addEventListener('click', (e) => {
        // Ignore clicks that originate inside an open modal
        if (e.target.closest('.modal-content')) return;
        // Let native interactions on controls and links work as expected.
        if (e.target.closest('button, a, input, select, textarea, label')) return;
        const card = e.target.closest('.card, .review-card');
        if (!card) return;
        const targetUrl = card.dataset?.postUrl;
        if (targetUrl) {
            window.location.href = targetUrl;
            return;
        }

        const post = card._post;
        if (post) openPostModal(post);
    });

    document.body.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('.modal-content')) return;
        const card = e.target.closest('.card, .review-card');
        if (!card) return;
        const targetUrl = card.dataset?.postUrl;
        if (targetUrl) {
            e.preventDefault();
            window.location.href = targetUrl;
            return;
        }

        const post = card._post;
        if (!post) return;
        e.preventDefault();
        openPostModal(post);
    });
}

if (typeof window !== 'undefined') {
    window.getPostUrl = getPostUrl;
}

// openModalWithCard: kept for backwards-compat (vibe guide passes a DOM element with no _post).
// Data-backed cards are routed to openPostModal; DOM-only cards use _openDomElementModal.
function openModalWithCard(cardOrElement) {
    const post = cardOrElement._post;
    if (post) {
        openPostModal(post);
        return;
    }
    _openDomElementModal(cardOrElement);
}

// Used by initBlogVibeGuide which builds a full article DOM element without post data.
function _openDomElementModal(contentEl) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay fade-in';
    _modalOverlay = overlay;

    const modal = document.createElement('div');
    modal.className = 'modal-content slide-in';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.cssText = 'position:absolute;top:8px;right:12px;font-size:1.4rem;background:none;border:none;cursor:pointer;color:var(--text-secondary);';
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (evt) => { if (evt.target === overlay) closeModal(); });
    _modalEscHandler = (evt) => { if (evt.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', _modalEscHandler);

    modal.appendChild(closeBtn);
    modal.appendChild(contentEl);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// Core modal renderer — builds all content from post data directly.
// No cloneNode: avoids duplicating hidden DOM nodes from grid cards.
// Uses closeModal() for all close paths so the ESC handler is always cleaned up.
function openPostModal(post) {
    closeModal();
    if (DEBUG) console.time('Modal Render Time');

    modalOpenCount++;
    log(`Modal opened ${modalOpenCount} times this session`, 'color: orange;');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay fade-in';
    _modalOverlay = overlay;

    const modal = document.createElement('div');
    modal.className = 'modal-content slide-in';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.cssText = `
        position:absolute;
        top:8px;
        right:12px;
        font-size:1.4rem;
        background:none;
        border:none;
        cursor:pointer;
        color:var(--text-secondary);
    `;
    closeBtn.addEventListener('click', closeModal);

    // Image slider — only renders nav arrows when more than one image exists.
    // img.src is cleared by closeModal() so decoded pixel data is freed immediately.
    if (post.images && post.images.length > 0) {
        const slider = document.createElement('div');
        slider.className = 'image-slider';
        let idx = 0;
        const imgEl = document.createElement('img');
        imgEl.src = toSitePath(post.images[0]);
        imgEl.alt = getPostDisplayTitle(post);
        imgEl.className = 'slider-img';
        imgEl.loading = 'lazy';
        imgEl.decoding = 'async';
        imgEl.setAttribute('fetchpriority', 'low');
        imgEl.width = 800;
        imgEl.height = 500;
        slider.appendChild(imgEl);

        if (post.images.length > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'slider-control prev';
            prevBtn.setAttribute('aria-label', 'Previous image');
            prevBtn.textContent = '<';
            const nextBtn = document.createElement('button');
            nextBtn.className = 'slider-control next';
            nextBtn.setAttribute('aria-label', 'Next image');
            nextBtn.textContent = '>';
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                idx = (idx - 1 + post.images.length) % post.images.length;
                imgEl.src = toSitePath(post.images[idx]);
            });
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                idx = (idx + 1) % post.images.length;
                imgEl.src = toSitePath(post.images[idx]);
            });
            slider.appendChild(prevBtn);
            slider.appendChild(nextBtn);
        }
        modal.appendChild(slider);
    }

    // Article body — built fresh from post data, never cloned from the grid card.
    const article = document.createElement('article');
    article.className = 'card';

    const h2 = document.createElement('h2');
    h2.className = 'card-title';
    h2.textContent = getPostDisplayTitle(post);
    article.appendChild(h2);

    const timeMeta = document.createElement('time');
    timeMeta.className = 'meta';
    timeMeta.textContent = post.city || '';
    article.appendChild(timeMeta);

    // Full description rendered only here, on-demand — not pre-baked in grid cards.
    const shortDesc = post.short_description || '';
    const longDesc = post.description || '';
    if (shortDesc || longDesc) {
        const fullDiv = document.createElement('div');
        fullDiv.className = 'full-text';
        if (shortDesc && longDesc && shortDesc.trim() !== longDesc.trim()) {
            const pShort = document.createElement('p');
            pShort.className = 'short-desc';
            pShort.textContent = shortDesc;
            fullDiv.appendChild(pShort);
            const pLong = document.createElement('p');
            pLong.className = 'long-desc';
            pLong.textContent = longDesc;
            fullDiv.appendChild(pLong);
        } else {
            const pDesc = document.createElement('p');
            pDesc.className = shortDesc ? 'short-desc' : 'long-desc';
            pDesc.textContent = shortDesc || longDesc;
            fullDiv.appendChild(pDesc);
        }
        article.appendChild(fullDiv);
    }

    // Footer: address (left) + vibe chips (right)
    const postVibes = getPostVibes(post);
    const metaRow = document.createElement('div');
    metaRow.className = 'modal-meta-row';

    const addrText = post.adress || post.address || '';
    if (addrText) {
        const addrEl = document.createElement('div');
        addrEl.className = 'modal-footer-left';
        addrEl.textContent = addrText;
        metaRow.appendChild(addrEl);
    }

    if (postVibes.length) {
        const vibeEl = document.createElement('div');
        vibeEl.className = 'modal-footer-right';
        postVibes.forEach((v) => {
            const chip = document.createElement('span');
            chip.className = 'modal-vibe-chip';
            const iconSpan = document.createElement('span');
            iconSpan.className = 'vibe-icon';
            iconSpan.textContent = getVibeIcon(v);
            chip.appendChild(iconSpan);
            const vibeLabel = document.createElement('span');
            vibeLabel.textContent = getVibeLabel(v);
            chip.appendChild(vibeLabel);
            vibeEl.appendChild(chip);
        });
        metaRow.appendChild(vibeEl);
    }

    if (metaRow.children.length) article.appendChild(metaRow);

    // Previous / next article navigation
    const sortedPosts = getSortedPosts();
    const currentIndex = getPostIndexInSortedList(post);
    if (sortedPosts.length > 1 && currentIndex !== -1) {
        const nav = document.createElement('div');
        nav.className = 'modal-article-nav';

        const prevIndex = (currentIndex - 1 + sortedPosts.length) % sortedPosts.length;
        const nextIndex = (currentIndex + 1) % sortedPosts.length;
        const prevPost = sortedPosts[prevIndex];
        const nextPost = sortedPosts[nextIndex];

        const prevNavBtn = document.createElement('button');
        prevNavBtn.type = 'button';
        prevNavBtn.className = 'btn modal-nav-btn';
        prevNavBtn.textContent = '\u2190 Previous article';
        prevNavBtn.setAttribute('aria-label', `Open previous article: ${getPostDisplayTitle(prevPost)}`);
        prevNavBtn.addEventListener('click', (e) => { e.stopPropagation(); openPostModal(prevPost); });

        const nextNavBtn = document.createElement('button');
        nextNavBtn.type = 'button';
        nextNavBtn.className = 'btn modal-nav-btn';
        nextNavBtn.textContent = `Next article \u2192`;
        nextNavBtn.setAttribute('aria-label', `Open next article: ${getPostDisplayTitle(nextPost)}`);
        nextNavBtn.addEventListener('click', (e) => { e.stopPropagation(); openPostModal(nextPost); });

        nav.appendChild(prevNavBtn);
        nav.appendChild(nextNavBtn);
        article.appendChild(nav);
    }

    // SEO internal links
    if (post.city || postVibes.length) {
        const seoWrap = document.createElement('div');
        seoWrap.className = 'modal-seo-links';
        const cityText = post.city ? String(post.city) : 'Dutch cities';
        const primaryVibe = getPostPrimaryVibe(post);
        const vibeText = primaryVibe ? getVibeLabel(primaryVibe) : 'best';
        const cityPageHref = toSitePath(getCityPagePath(post.city));
        seoWrap.innerHTML = `
            <p>Explore more:</p>
            <a href="${toSitePath('blog.html')}">Best places and vibes in the Netherlands</a>
            <a href="${cityPageHref}">Best places in ${cityText}</a>
            <a href="${toSitePath('blog.html')}">More ${vibeText} places</a>
            <a href="${toSitePath('index.html#city-vibe-map')}">Interactive city vibe map</a>
        `;
        article.appendChild(seoWrap);
    }

    modal.appendChild(closeBtn);
    modal.appendChild(article);

    overlay.addEventListener('click', (evt) => {
        if (evt.target === overlay) {
            log('Modal closed via overlay click', 'color: red;');
            closeModal();
        }
    });

    // Single ESC handler stored in _modalEscHandler so closeModal() can always remove it.
    _modalEscHandler = (evt) => {
        if (evt.key === 'Escape') {
            log('Modal closed via Escape key', 'color: red;');
            closeModal();
        }
    };
    document.addEventListener('keydown', _modalEscHandler);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (DEBUG) console.timeEnd('Modal Render Time');
}
