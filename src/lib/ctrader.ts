export const CTRADER_TOKEN_RE = /^[A-Za-z0-9]{5,20}$/;

/**
 * Accepts either a bare investor token or a full Investor Access URL and
 * returns { token, extracted } where `extracted` is true when a URL was parsed.
 */
export const parseCTraderToken = (input: string): { token: string; extracted: boolean } => {
  const raw = (input || "").trim();
  if (!raw) return { token: "", extracted: false };

  const match = raw.match(/investor\/([A-Za-z0-9]{5,20})/);
  if (match) return { token: match[1], extracted: true };

  // Bare value that still looks like a URL — strip query/hash and take last segment
  if (/[/?#]/.test(raw)) {
    const cleaned = raw.split(/[?#]/)[0].replace(/\/+$/, "");
    const last = cleaned.split("/").pop() || "";
    return { token: last, extracted: true };
  }

  return { token: raw, extracted: false };
};

export const isValidCTraderToken = (token: string) => CTRADER_TOKEN_RE.test(token);

export const ctraderInvestorUrl = (token: string, dark = true) =>
  `https://ct.spotware.com/investor/${token}?lang=en${dark ? "&theme=dark" : ""}`;
