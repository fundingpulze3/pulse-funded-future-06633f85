/**
 * Generates a certificate image by overlaying the user's name, date, and optional
 * profit share onto a background template image using HTML Canvas.
 * Returns a Blob of the resulting PNG.
 */

interface CertificateConfig {
  backgroundUrl: string;
  userName: string;
  date: string; // e.g. "March 17, 2026"
  profitShare?: string; // e.g. "$1,250.00" — only for payout type
  certificateType: string;
}

// Text placement configs per certificate type (relative to canvas dimensions).
// Coordinates are normalized 0..1 of canvas width/height — measured against
// the actual template artwork (2000×1347): name slot is centered in the right
// glassy box; date sits just above the "Date" underline at the bottom-left.
const LAYOUT: Record<string, {
  nameX: number; nameY: number; nameFontSize: number;
  dateX?: number; dateY?: number; dateFontSize?: number;
  profitX?: number; profitY?: number; profitFontSize?: number;
}> = {
  phase1_passed: {
    nameX: 0.71, nameY: 0.51, nameFontSize: 0.052,
    dateX: 0.26, dateY: 0.87, dateFontSize: 0.020,
  },
  phase2_passed: {
    nameX: 0.71, nameY: 0.51, nameFontSize: 0.052,
    dateX: 0.26, dateY: 0.87, dateFontSize: 0.020,
  },
  // Payout cert has TWO slots: profit share (top) + name (bottom)
  payout: {
    profitX: 0.77, profitY: 0.46, profitFontSize: 0.052,
    nameX: 0.77, nameY: 0.665, nameFontSize: 0.044,
    dateX: 0.26, dateY: 0.87, dateFontSize: 0.020,
  },
  funded: {
    nameX: 0.71, nameY: 0.51, nameFontSize: 0.052,
    dateX: 0.26, dateY: 0.87, dateFontSize: 0.020,
  },
  max_allocation: {
    nameX: 0.71, nameY: 0.51, nameFontSize: 0.052,
    dateX: 0.26, dateY: 0.87, dateFontSize: 0.020,
  },
};

const DEFAULT_LAYOUT: typeof LAYOUT[string] = {
  nameX: 0.71, nameY: 0.51, nameFontSize: 0.050,
  dateX: 0.26, dateY: 0.87, dateFontSize: 0.020,
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Preload Copperplate Gothic font via FontFace API — try multiple sources */
let fontLoaded = false;
async function ensureCopperplateFont(): Promise<void> {
  if (fontLoaded) return;

  const sources = [
    "url(/fonts/CopperplateGothicBold.ttf) format('truetype')",
    "url(https://cdn.jsdelivr.net/gh/AmazingStuff-dot-dev/fonts@main/CopperplateGothicBold.woff2) format('woff2')",
    "url(https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-jHgTYo.ttf) format('truetype')",
  ];

  for (const src of sources) {
    try {
      const font = new FontFace("Copperplate Gothic", src);
      await font.load();
      document.fonts.add(font);
      fontLoaded = true;
      return;
    } catch {
      // Try next source
    }
  }

  console.warn("All Copperplate Gothic font sources failed, using system fallback");
}

export async function generateCertificateImage(config: CertificateConfig): Promise<Blob> {
  const { backgroundUrl, userName, date, profitShare, certificateType } = config;
  const layout = LAYOUT[certificateType] || DEFAULT_LAYOUT;

  const bg = await loadImage(backgroundUrl);
  await ensureCopperplateFont();
  const canvas = document.createElement("canvas");
  canvas.width = bg.naturalWidth;
  canvas.height = bg.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw background
  ctx.drawImage(bg, 0, 0);

  const w = canvas.width;
  const h = canvas.height;

  // Helper to draw text with outline; auto-shrinks font so text fits within maxWidth.
  const drawText = (
    text: string,
    x: number,
    y: number,
    fontSizePx: number,
    fontFamily: string,
    weight: string,
    fill: string,
    maxWidthPx: number,
  ) => {
    let size = fontSizePx;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Shrink until it fits (min 55% of original)
    const minSize = Math.max(10, Math.round(fontSizePx * 0.55));
    ctx.font = `${weight} ${size}px ${fontFamily}`;
    while (ctx.measureText(text).width > maxWidthPx && size > minSize) {
      size -= 1;
      ctx.font = `${weight} ${size}px ${fontFamily}`;
    }
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(2, Math.round(h * 0.002));
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  };

  const nameFamily = `"Copperplate Gothic", "Copperplate", "Copperplate Gothic Bold", serif`;

  // Draw user name — constrained to the glass box width (~38% of canvas width around the name X)
  const nameSize = Math.round(layout.nameFontSize * h);
  const nameMaxWidth = w * 0.38;
  drawText(userName.trim(), w * layout.nameX, h * layout.nameY, nameSize, nameFamily, "bold", "#ffffff", nameMaxWidth);

  // Draw date
  if (layout.dateX !== undefined && layout.dateY !== undefined) {
    const dateSize = Math.round((layout.dateFontSize || 0.018) * h);
    drawText(date, w * layout.dateX, h * layout.dateY, dateSize, nameFamily, "normal", "#c8d8e8", w * 0.30);
  }

  // Draw profit share (payout certificates)
  if (profitShare && layout.profitX !== undefined && layout.profitY !== undefined) {
    const profitSize = Math.round((layout.profitFontSize || 0.032) * h);
    drawText(profitShare, w * layout.profitX, h * layout.profitY, profitSize, nameFamily, "bold", "#ffffff", w * 0.38);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      "image/png",
      1.0
    );
  });
}

/**
 * Generates a certificate image, uploads it to Supabase storage,
 * and returns the public URL.
 */
export async function generateAndUploadCertificate(
  supabase: any,
  config: CertificateConfig & { certId: string }
): Promise<string | null> {
  try {
    const blob = await generateCertificateImage(config);
    const fileName = `${config.certId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(fileName, blob, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Certificate upload error:", uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("certificates")
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error("Certificate generation error:", err);
    return null;
  }
}
