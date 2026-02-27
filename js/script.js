// Basic JavaScript example

// Get the current date and time
const currentDate = new Date();

// Format date and time in YYYY-MM-DD HH:MM:SS
const formattedDate = currentDate.toISOString().slice(0, 19).replace('T', ' ');

console.log(`Current Date and Time (UTC): ${formattedDate}`);

// --- blog article expansion / modal logic ---
// Wait for DOM ready so articles exist
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArticleModal);
} else {
    initArticleModal();
}

function initArticleModal() {
    const readButtons = document.querySelectorAll('.read-btn');
    readButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // support both blog cards and review cards
            const card = e.currentTarget.closest('.card, .review-card');
            if (!card) return;
            openModalWithCard(card);
        });
    });
}

function openModalWithCard(card) {
    // clone the card's markup; we will show it in overlay
    const clone = card.cloneNode(true);
    const btn = clone.querySelector('.read-btn');
    if (btn) btn.remove();
    // reveal any hidden full-text in the clone
    const full = clone.querySelector('.full-text');
    if (full) {
        full.removeAttribute('hidden');
        full.style.display = 'block';
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-content';

    // close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.style.cssText = 'position:absolute;top:8px;right:12px;font-size:1.4rem;background:none;border:none;cursor:pointer;color:var(--text-secondary);';
    closeBtn.addEventListener('click', () => {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
    });

    modal.appendChild(closeBtn);
    modal.appendChild(clone);

    // close when clicking outside content
    overlay.addEventListener('click', (evt) => {
        if (evt.target === overlay) {
            document.body.removeChild(overlay);
        }
    });

    // escape key
    const escHandler = (evt) => {
        if (evt.key === 'Escape' && document.body.contains(overlay)) {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}
