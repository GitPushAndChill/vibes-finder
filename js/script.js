// ===============================
// Debug Configuration
// ===============================
const DEBUG = true;

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
// Script Loaded Timestamp
// ===============================
const currentDate = new Date();
const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');
log(`Script loaded at (UTC): ${formattedDate}`, 'color: green; font-weight: bold;');

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
        const response = await fetch('content/vibes.yml', { cache: 'no-cache' });
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

function getSortedPosts() {
    if (!Array.isArray(postsData)) return [];
    return postsData
        .slice()
        .sort((a, b) => {
            const aTime = Date.parse(a?.created_on || '') || 0;
            const bTime = Date.parse(b?.created_on || '') || 0;
            return bTime - aTime;
        });
}

function populatePostGrid({ containerSelector, limit, cityFilter = '', vibeFilter = '' }) {
    const container = document.querySelector(containerSelector);
    if (!container || !postsData) return;
    container.innerHTML = '';

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
    if (typeof limit === 'number') {
        posts = posts.slice(0, limit);
    }

    posts.forEach(post => {
        const article = document.createElement('article');
        article.className = 'card';
        article._post = post;

        const h2 = document.createElement('h2');
        h2.className = 'card-title';
        h2.textContent = post.title;
        article.appendChild(h2);

        const meta = document.createElement('time');
        meta.className = 'meta';
        meta.textContent = post.city + (post.place ? ', ' + post.place : '');
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

    initBlogVibeGuide();

    const cityInput = document.querySelector('#city-filter');
    const vibeInput = document.querySelector('#vibe-filter');
    const citySelect = document.querySelector('#city-select');
    const vibeSelect = document.querySelector('#vibe-select');
    const cityOptions = document.querySelector('#city-options');
    const vibeOptions = document.querySelector('#vibe-options');

    if (!cityInput || !vibeInput || !cityOptions || !vibeOptions) {
        // filters not present; just render the grid
        populatePostGrid({ containerSelector: '#all-posts-grid' });
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
        if (selectEl) return selectEl.value;
        return inputEl.value;
    };

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
        populatePostGrid({
            containerSelector: '#all-posts-grid',
            cityFilter: getActiveValue(cityInput, citySelect),
            vibeFilter: getActiveValue(vibeInput, vibeSelect),
        });
        initArticleModal();
    };

    cityInput.addEventListener('input', () => {
        syncSelectToInput(cityInput, citySelect);
        render();
    });
    vibeInput.addEventListener('input', () => {
        syncSelectToInput(vibeInput, vibeSelect);
        render();
    });

    if (citySelect) {
        citySelect.addEventListener('change', () => {
            syncInputToSelect(cityInput, citySelect);
            render();
        });
    }
    if (vibeSelect) {
        vibeSelect.addEventListener('change', () => {
            syncInputToSelect(vibeInput, vibeSelect);
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
    fetch('posts/places/posts-places.json')
        .then(r => r.json())
        .then(data => {
            postsData = data;
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
        const card = buildPostCardForModal(randomPost);
        openModalWithCard(card);
    });
}

function buildPostCardForModal(post) {
    const article = document.createElement('article');
    article.className = 'card';
    article._post = post;

    const h2 = document.createElement('h2');
    h2.className = 'card-title';
    h2.textContent = post.title || '';
    article.appendChild(h2);

    const meta = document.createElement('time');
    meta.className = 'meta';
    meta.textContent = (post.city || '') + (post.place ? ', ' + post.place : '');
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
        vibeConfigReady.finally(fetchAndRenderGrids);
    });
} else {
    vibeConfigReady.finally(fetchAndRenderGrids);
}

function initArticleModal() {
    log('Initializing article modal system...', 'color: green;');

    const cards = document.querySelectorAll('.card, .review-card');
    log(`Found ${cards.length} cards`, 'color: blue;');

    if (cards.length === 0) {
        warn('No cards found on page.');
    }

    const openCardModal = (card) => {
        const title = card.querySelector('h2, h3');
        if (title) {
            log(`Opening article: ${title.textContent.trim()}`, 'color: blue; font-weight: bold;');
        } else {
            warn('No title found inside card.');
        }

        openModalWithCard(card);
    };

    cards.forEach(card => {
        if (card.dataset.modalBound === '1') return;
        card.dataset.modalBound = '1';
        card.style.cursor = 'pointer';
        if (!card.hasAttribute('tabindex')) {
            card.tabIndex = 0;
        }

        card.addEventListener('click', () => {
            log('Card clicked', 'color: purple;');
            openCardModal(card);
        });

        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openCardModal(card);
            }
        });
    });
}

function openModalWithCard(card) {
    if (DEBUG) console.time('Modal Render Time');

    modalOpenCount++;
    log(`Modal opened ${modalOpenCount} times this session`, 'color: orange;');

    const post = card._post || {};

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay fade-in';

    const modal = document.createElement('div');
    modal.className = 'modal-content slide-in';

    // close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
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
    closeBtn.addEventListener('click', () => {
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            log('Modal closed via button', 'color: red;');
        }
    });

    // add image slider if there are images
    if (post.images && post.images.length > 0) {
        const slider = document.createElement('div');
        slider.className = 'image-slider';
        let idx = 0;
        const imgEl = document.createElement('img');
        imgEl.src = post.images[0];
        imgEl.className = 'slider-img';
        slider.appendChild(imgEl);
        const prevBtn = document.createElement('button');
        prevBtn.className = 'slider-control prev';
        prevBtn.textContent = '<';
        const nextBtn = document.createElement('button');
        nextBtn.className = 'slider-control next';
        nextBtn.textContent = '>';
        prevBtn.addEventListener('click', () => {
            idx = (idx - 1 + post.images.length) % post.images.length;
            imgEl.src = post.images[idx];
        });
        nextBtn.addEventListener('click', () => {
            idx = (idx + 1) % post.images.length;
            imgEl.src = post.images[idx];
        });
        slider.appendChild(prevBtn);
        slider.appendChild(nextBtn);
        modal.appendChild(slider);
    }

    // build content clone after slider
    const clone = card.cloneNode(true);
    const btn = clone.querySelector('.read-btn');
    if (btn) btn.remove();
    const badge = clone.querySelector('.vibe-badge');
    if (badge) badge.remove();
    const full = clone.querySelector('.full-text');
    if (full) {
        full.removeAttribute('hidden');
        full.style.display = 'block';
    }

    // If the expanded content already includes short_description, don't show it twice.
    // (Keep normal card preview unchanged; this only affects the modal clone.)
    const excerpt = clone.querySelector('.excerpt');
    if (excerpt && full && full.querySelector('.short-desc')) {
        excerpt.remove();
    }

    // SEO internal links inside enlarged article (append at very bottom later)
    let seoWrap = null;
    const postVibes = getPostVibes(post);
    if (post && (post.city || postVibes.length)) {
        seoWrap = document.createElement('div');
        seoWrap.className = 'modal-seo-links';

        const cityText = post.city ? String(post.city) : 'Dutch cities';
        const primaryVibe = getPostPrimaryVibe(post);
        const vibeText = primaryVibe ? getVibeLabel(primaryVibe) : 'best';

        seoWrap.innerHTML = `
            <p>Explore more:</p>
            <a href="blog.html">Best places and vibes in the Netherlands</a>
            <a href="blog.html">More ${cityText} city vibes</a>
            <a href="blog.html">More ${vibeText} places</a>
            <a href="index.html#city-vibe-map">Interactive city vibe map</a>
        `;
    }

    modal.appendChild(closeBtn);
    modal.appendChild(clone);

    // modal footer info row: address (left) and vibes (right)
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
            const icon = document.createElement('span');
            icon.className = 'vibe-icon';
            icon.textContent = getVibeIcon(v);
            chip.appendChild(icon);

            const vibeText = document.createElement('span');
            vibeText.textContent = getVibeLabel(v);
            chip.appendChild(vibeText);

            vibeEl.appendChild(chip);
        });
        metaRow.appendChild(vibeEl);
    }

    if (metaRow.children.length) {
        clone.appendChild(metaRow);
    }

    // previous / next article navigation in modal
    const sortedPosts = getSortedPosts();
    const currentIndex = getPostIndexInSortedList(post);
    if (sortedPosts.length > 1 && currentIndex !== -1) {
        const nav = document.createElement('div');
        nav.className = 'modal-article-nav';

        const prevIndex = (currentIndex - 1 + sortedPosts.length) % sortedPosts.length;
        const nextIndex = (currentIndex + 1) % sortedPosts.length;

        const prevPost = sortedPosts[prevIndex];
        const nextPost = sortedPosts[nextIndex];

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'btn modal-nav-btn';
        prevBtn.textContent = '← Previous article';
        prevBtn.setAttribute('aria-label', `Open previous article: ${prevPost?.title || ''}`);

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'btn modal-nav-btn';
        nextBtn.textContent = 'Next article →';
        nextBtn.setAttribute('aria-label', `Open next article: ${nextPost?.title || ''}`);

        const openTargetPost = (targetPost) => {
            if (document.body.contains(overlay)) {
                document.body.removeChild(overlay);
            }
            const targetCard = buildPostCardForModal(targetPost);
            openModalWithCard(targetCard);
        };

        prevBtn.addEventListener('click', () => openTargetPost(prevPost));
        nextBtn.addEventListener('click', () => openTargetPost(nextPost));

        nav.appendChild(prevBtn);
        nav.appendChild(nextBtn);
        clone.appendChild(nav);
    }

    // keep SEO links as the very last block in enlarged article
    if (seoWrap) {
        clone.appendChild(seoWrap);
    }

    // close when clicking outside content
    overlay.addEventListener('click', (evt) => {
        if (evt.target === overlay) {
            document.body.removeChild(overlay);
            log('Modal closed via overlay click', 'color: red;');
        }
    });

    const escHandler = (evt) => {
        if (evt.key === 'Escape' && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', escHandler);
            log('Modal closed via Escape key', 'color: red;');
        }
    };
    document.addEventListener('keydown', escHandler);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (DEBUG) console.timeEnd('Modal Render Time');
}
