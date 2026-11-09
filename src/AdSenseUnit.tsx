import { useEffect, useRef } from "react";

const clientId = (import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined)?.trim();
const slotId = (import.meta.env.VITE_ADSENSE_DETAIL_SLOT_ID as string | undefined)?.trim();
const hasValidConfig = Boolean(clientId?.startsWith("ca-pub-") && slotId && /^\d+$/.test(slotId));

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1" ||
    host === "0.0.0.0"
  ) return true;

  const octets = host.split(".").map(part => /^\d+$/.test(part) ? Number(part) : -1);
  if (octets.length !== 4 || octets.some(part => part < 0 || part > 255)) return false;
  const [first, second] = octets;
  return first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}

const isLocalOrigin = typeof window === "undefined" || isLocalHostname(window.location.hostname);
const canServeAd = import.meta.env.PROD && !isLocalOrigin && hasValidConfig;

let adsenseReady: Promise<void> | undefined;
let invalidConfigReported = false;

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

function loadAdSense(client: string) {
  if (adsenseReady) return adsenseReady;

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;

  adsenseReady = new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => {
      adsenseReady = undefined;
      reject(new Error("Google AdSense could not be loaded."));
    };
    document.head.append(script);
  });

  return adsenseReady;
}

export function AdSenseUnit() {
  const pushed = useRef(false);
  const slot = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || isLocalOrigin) return;
    if (!clientId && !slotId) return;
    if (!hasValidConfig) {
      if (!invalidConfigReported) {
        console.error("AdSense requires a ca-pub client ID and a numeric detail-slot ID.");
        invalidConfigReported = true;
      }
      return;
    }
    if (pushed.current || !clientId) return;

    let active = true;
    let observer: ResizeObserver | undefined;
    // En skjult plass (arket på telefon står som en stripe, innholdet er display:none) har bredde 0, og AdSense
    // gir da opp for godt («No slot size for availableWidth=0»). Vent til plassen faktisk har bredde.
    const push = () => {
      if (!active || pushed.current) return;
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      pushed.current = true;
    };
    void loadAdSense(clientId)
      .then(() => {
        const element = slot.current;
        if (!active || !element) return;
        if (element.offsetWidth > 0 || typeof ResizeObserver === "undefined") { push(); return; }
        observer = new ResizeObserver(() => {
          if (element.offsetWidth === 0) return;
          observer?.disconnect();
          push();
        });
        observer.observe(element);
      })
      .catch(error => {
        if (active) console.error(error);
      });

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, []);

  return (
    <section
      aria-label={canServeAd ? "Advertisement" : "Advertisement preview"}
      className="border-y border-rule py-3"
    >
      <p className="mb-2 px-6 text-xs font-semibold tracking-wide uppercase text-ink-soft">
        {canServeAd ? "Advertisement" : "Advertisement preview"}
      </p>
      {canServeAd ? (
        <ins
          ref={slot}
          className="adsbygoogle mx-auto block h-[100px] w-full max-w-[320px]"
          style={{ display: "block", width: "min(320px, 100%)", height: "100px" }}
          data-ad-client={clientId}
          data-ad-slot={slotId}
        />
      ) : (
        <div className="mx-auto grid min-h-[100px] w-full max-w-[320px] place-items-center border border-dashed border-rule bg-paper px-4 py-5 text-center">
          <p className="text-sm leading-snug text-ink-soft">
            Responsive display ad
            <span className="mt-1 block text-xs">Shown on the live site only</span>
          </p>
        </div>
      )}
    </section>
  );
}
