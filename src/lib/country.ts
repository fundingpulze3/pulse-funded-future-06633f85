/** Country helpers — ISO-2 code ⇄ flag emoji, plus IP-based detection. */

export const flagEmoji = (code?: string | null): string => {
  const c = (code || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🏳️";
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

const NAME_TO_CODE: Record<string, string> = {
  india: "IN", "united states": "US", usa: "US", us: "US", "united kingdom": "GB", uk: "GB",
  canada: "CA", australia: "AU", germany: "DE", france: "FR", spain: "ES", italy: "IT",
  netherlands: "NL", poland: "PL", portugal: "PT", brazil: "BR", mexico: "MX", argentina: "AR",
  "south africa": "ZA", nigeria: "NG", kenya: "KE", egypt: "EG", morocco: "MA", turkey: "TR",
  "united arab emirates": "AE", uae: "AE", "saudi arabia": "SA", qatar: "QA", kuwait: "KW",
  pakistan: "PK", bangladesh: "BD", "sri lanka": "LK", nepal: "NP", singapore: "SG",
  malaysia: "MY", indonesia: "ID", philippines: "PH", vietnam: "VN", thailand: "TH",
  japan: "JP", china: "CN", "south korea": "KR", "hong kong": "HK", taiwan: "TW",
  "new zealand": "NZ", ireland: "IE", sweden: "SE", norway: "NO", denmark: "DK",
  finland: "FI", switzerland: "CH", austria: "AT", belgium: "BE", greece: "GR",
  romania: "RO", czechia: "CZ", "czech republic": "CZ", hungary: "HU", ukraine: "UA",
  russia: "RU", israel: "IL", colombia: "CO", chile: "CL", peru: "PE",
};

/** Accepts "IN", "India" or "🇮🇳 India" and returns an ISO-2 code when possible. */
export const toCountryCode = (input?: string | null): string | null => {
  const v = (input || "").trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return NAME_TO_CODE[v.toLowerCase()] ?? null;
};

export type DetectedCountry = { code: string; name: string; suspicious: boolean };

const UNKNOWN: DetectedCountry = { code: "XX", name: "Unknown (VPN/Proxy)", suspicious: true };

/** Best-effort IP geolocation. Falls back to a "fake / unknown" bucket. */
export const detectCountry = async (): Promise<DetectedCountry> => {
  const providers = [
    async () => {
      const r = await fetch("https://ipwho.is/?fields=success,country,country_code,security");
      const j = await r.json();
      if (!j?.success || !j?.country_code) return null;
      const sec = j.security || {};
      const suspicious = Boolean(sec.vpn || sec.proxy || sec.tor || sec.hosting);
      return { code: String(j.country_code).toUpperCase(), name: String(j.country), suspicious };
    },
    async () => {
      const r = await fetch("https://ipapi.co/json/");
      const j = await r.json();
      if (!j?.country_code) return null;
      return { code: String(j.country_code).toUpperCase(), name: String(j.country_name || j.country_code), suspicious: false };
    },
  ];

  for (const p of providers) {
    try {
      const res = await p();
      if (res) return res.suspicious ? { ...res, name: `${res.name} (VPN)` } : res;
    } catch { /* try next */ }
  }
  return UNKNOWN;
};
