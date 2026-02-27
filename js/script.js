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

// Wait for DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArticleModal);
} else {
    initArticleModal();
}

function initArticleModal() {
    log('Initializing article modal system...', 'color: green;');

    const readButtons = document.querySelectorAll('.read-btn');
    log(`Found ${readButtons.length} read buttons`, 'color: blue;');

    if (readButtons.length === 0) {
        warn('No read buttons found on page.');
    }

    readButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            log('Read button clicked', 'color: purple;');

            const card = e.currentTarget.closest('.card, .review-card');
            if (!card) {
                warn('No card found for clicked button.');
                return;
            }

            const title = card.querySelector('h2, h3');
            if (title) {
                log(`Opening article: ${title.textContent.trim()}`, 'color: blue; font-weight: bold;');
            } else {
                warn('No title found inside card.');
            }

            openModalWithCard(card);
        });
    });
}

function openModalWithCard(card) {
    if (DEBUG) console.time('Modal Render Time');

    modalOpenCount++;
    log(`Modal opened ${modalOpenCount} times this session`, 'color: orange;');

    // clone the card's markup; we will show it in overlay
    const clone = card.cloneNode(true);

    const btn = clone.querySelector('.read-btn');
    if (btn) {
        btn.remove();
    } else {
        warn('Cloned card has no read button to remove.');
    }

    // reveal any hidden full-text in the clone
    const full = clone.querySelector('.full-text');
    if (full) {
        full.removeAttribute('hidden');
        full.style.display = 'block';
    } else {
        warn('No full-text section found in card.');
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-content';

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

    modal.appendChild(closeBtn);
    modal.appendChild(clone);

    // close when clicking outside content
    overlay.addEventListener('click', (evt) => {
        if (evt.target === overlay) {
            document.body.removeChild(overlay);
            log('Modal closed via overlay click', 'color: red;');
        }
    });

    // escape key support
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
