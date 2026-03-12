const VALID_VARIANTS = new Set(['tech', 'full', 'finance', 'happy', 'taiwan']);

function isValidVariant(value: string | null | undefined): value is string {
  return !!value && VALID_VARIANTS.has(value);
}

export const SITE_VARIANT: string = (() => {
  if (typeof window === 'undefined') return import.meta.env.VITE_VARIANT || 'full';

  const envVariant = import.meta.env.VITE_VARIANT;

  const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  if (isTauri) {
    const stored = localStorage.getItem('worldmonitor-variant');
    if (isValidVariant(stored)) return stored;
    return envVariant || 'full';
  }

  const h = location.hostname;
  if (h.startsWith('tech.')) return 'tech';
  if (h.startsWith('finance.')) return 'finance';
  if (h.startsWith('happy.')) return 'happy';
  if (h.startsWith('taiwan.')) return 'taiwan';

  if (h === 'localhost' || h === '127.0.0.1') {
    if (isValidVariant(envVariant)) return envVariant;
    const stored = localStorage.getItem('worldmonitor-variant');
    if (isValidVariant(stored)) return stored;
    return 'full';
  }

  // Non-production hosts (e.g. ngrok tunnels, staging): honour VITE_VARIANT env
  if (isValidVariant(envVariant)) return envVariant;

  return 'full';
})();
