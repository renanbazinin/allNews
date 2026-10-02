// Run before the stylesheet so a saved dark theme never flashes light.
(() => {
    const key = 'allnews.theme.v1';
    const choices = ['system', 'light', 'dark'];
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    let preference = 'system';
    try {
        const stored = JSON.parse(localStorage.getItem(key));
        if (choices.includes(stored)) preference = stored;
    } catch { /* Device theme remains available when storage is blocked. */ }

    function applyTheme() {
        const dark = preference === 'dark' || (preference === 'system' && systemTheme.matches);
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#171b19' : '#f5f3ed');
    }
    applyTheme();
    systemTheme.addEventListener('change', applyTheme);

    document.addEventListener('DOMContentLoaded', () => {
        const selector = document.getElementById('theme-select');
        if (!selector) return;
        selector.value = preference;
        selector.addEventListener('change', () => {
            if (!choices.includes(selector.value)) return;
            preference = selector.value;
            applyTheme();
            try {
                localStorage.setItem(key, JSON.stringify(preference));
            } catch {
                const feedback = document.getElementById('reading-feedback');
                if (feedback) feedback.textContent = 'Theme changed for this session. Your device could not save the preference.';
            }
        });
    });
})();
