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

// Text placement configs per certificate type (relative to canvas dimensions)
// Coordinates are percentages of canvas width/height
const LAYOUT: Record<string, {
  nameX: number; nameY: number; nameFontSize: number;
  dateX?: number; dateY?: number; dateFontSize?: number;
  profitX?: number; profitY?: number; profitFontSize?: number;
}> = {
  phase1_passed: {
    nameX: 0.58, nameY: 0.52, nameFontSize: 0.035,
    dateX: 0.155, dateY: 0.94, dateFontSize: 0.018,
  },
  phase2_passed: {
    nameX: 0.58, nameY: 0.52, nameFontSize: 0.035,
    dateX: 0.155, dateY: 0.94, dateFontSize: 0.018,
  },
  payout: {
    profitX: 0.62, profitY: 0.44, profitFontSize: 0.032,
    nameX: 0.62, nameY: 0.65, nameFontSize: 0.032,
    dateX: 0.155, dateY: 0.94, dateFontSize: 0.018,
  },
  funded: {
    nameX: 0.62, nameY: 0.52, nameFontSize: 0.035,
    dateX: 0.155, dateY: 0.94, dateFontSize: 0.018,
  },
  max_allocation: {
    nameX: 0.58, nameY: 0.52, nameFontSize: 0.035,
  },
};

const DEFAULT_LAYOUT: typeof LAYOUT[string] = {
  nameX: 0.58, nameY: 0.52, nameFontSize: 0.035,
  dateX: 0.155, dateY: 0.94, dateFontSize: 0.018,
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

export async function generateCertificateImage(config: CertificateConfig): Promise<Blob> {
  const { backgroundUrl, userName, date, profitShare, certificateType } = config;
  const layout = LAYOUT[certificateType] || DEFAULT_LAYOUT;

  const bg = await loadImage(backgroundUrl);
  const canvas = document.createElement("canvas");
  canvas.width = bg.naturalWidth;
  canvas.height = bg.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw background
  ctx.drawImage(bg, 0, 0);

  const w = canvas.width;
  const h = canvas.height;

  // Helper to draw text with outline for visibility
  const drawText = (text: string, x: number, y: number, font: string, fill: string) => {
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Dark outline for contrast
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(2, Math.round(h * 0.002));
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    // Fill
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  };

  // Draw user name
  const nameSize = Math.round(layout.nameFontSize * h);
  drawText(userName, w * layout.nameX, h * layout.nameY, `bold ${nameSize}px Arial, sans-serif`, "#ffffff");

  // Draw date
  if (layout.dateX !== undefined && layout.dateY !== undefined) {
    const dateSize = Math.round((layout.dateFontSize || 0.018) * h);
    drawText(date, w * layout.dateX, h * layout.dateY, `${dateSize}px Arial, sans-serif`, "#c8d8e8");
  }

  // Draw profit share (payout certificates)
  if (profitShare && layout.profitX !== undefined && layout.profitY !== undefined) {
    const profitSize = Math.round((layout.profitFontSize || 0.032) * h);
    drawText(profitShare, w * layout.profitX, h * layout.profitY, `bold ${profitSize}px Arial, sans-serif`, "#ffffff");
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
