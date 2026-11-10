// Google Analytics 4 uten informasjonskapsler, som i Table Editor (samme måle-ID): analytics_storage er alltid
// avslått og client_storage 'none', så ingenting lagres på enheten og det trengs ikke noe samtykkebanner.
// Google får bare tellinger. Se https://truben.no/privacy/.
const measurementId = 'G-2FMGEJMS7G';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

let started = false;

// Skriptet lastes når nettleseren er ledig, så det ikke konkurrerer med kartet og appen om nettverket
export function startAnalytics() {
  if (started || !import.meta.env.PROD || isLocalHostname(window.location.hostname)) return;
  started = true;

  window.dataLayer = window.dataLayer || [];
  // gtag.js leser bare kommandoer som er selve arguments-objektet. En vanlig liste (...args) blir stille
  // ignorert, og da ble det aldri sendt en eneste sidevisning.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  } as (...args: unknown[]) => void;
  window.gtag('consent', 'default', { analytics_storage: 'denied' });
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { client_storage: 'none', anonymize_ip: true });

  const load = () => {
    if (document.getElementById('google-analytics-tag')) return;
    const script = document.createElement('script');
    script.id = 'google-analytics-tag';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(load, { timeout: 2000 });
  else setTimeout(load, 1500);
}

type EventValue = string | number | boolean | undefined;

// Egne hendelser for å se hvordan appen brukes. Verdiene er korte og telles, aldri personopplysninger. Før
// skriptet er lastet legges kommandoene i dataLayer, og i dev og på localhost gjør kallet ingenting.
export function trackEvent(name: string, params: Record<string, EventValue> = {}) {
  if (!started || !window.gtag) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    clean[key] = typeof value === 'string' ? value.slice(0, 100) : value;
  }
  window.gtag('event', name, clean);
}
