(function () {
    var storageKey = 'vf-theme';
    var root = document.documentElement;

    function getStoredTheme() {
        try {
            var value = localStorage.getItem(storageKey);
            return value === 'light' || value === 'dark' ? value : null;
        } catch (err) {
            return null;
        }
    }

    var theme = getStoredTheme() || 'dark';
    root.setAttribute('data-theme', theme);
})();
