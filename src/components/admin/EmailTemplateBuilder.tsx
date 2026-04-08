import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Eye, Save, ArrowUp, ArrowDown, Type, Image as ImageIcon,
  Square, Minus, Link2, Layout, Code, GripVertical, Upload, Pencil, Copy,
  Heading1, AlignLeft, MousePointer, Layers, Palette, FileText,
} from "lucide-react";
import { toast } from "sonner";

const LIGHT_FIELD_CLASS = "bg-[hsl(0,0%,100%)] border-[hsl(0,0%,82%)] text-[hsl(0,0%,5%)] placeholder:text-[hsl(0,0%,55%)]";
const LIGHT_DIALOG_CLASS = "bg-[hsl(0,0%,100%)] border-[hsl(0,0%,88%)] text-[hsl(0,0%,5%)]";
const LIGHT_SELECT_CLASS = "bg-[hsl(0,0%,100%)] border-[hsl(0,0%,82%)] text-[hsl(0,0%,5%)]";
const MAX_EMAIL_ASSET_SIZE = 5 * 1024 * 1024;

const buildEmailAssetPath = (file: File) => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "asset";

  return `email-builder/${Date.now()}-${uid()}-${baseName}.${ext}`;
};

// ---- Block Types ----
type BlockType = "header" | "logo" | "text" | "heading" | "button" | "image" | "divider" | "spacer" | "social" | "footer";

interface EmailBlock {
  id: string;
  type: BlockType;
  props: Record<string, string>;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const DEFAULT_BLOCKS: { type: BlockType; label: string; icon: any; defaultProps: Record<string, string> }[] = [
  { type: "header", label: "Header Bar", icon: Layout, defaultProps: { text: "FUNDING PULZE", bgColor: "#000000", textColor: "#ffffff", fontSize: "22" } },
  { type: "logo", label: "Logo Image", icon: ImageIcon, defaultProps: { src: "https://rpshiyvndmnogbhbgmfm.supabase.co/storage/v1/object/public/email-assets/logo.png", alt: "Logo", width: "48", align: "left" } },
  { type: "heading", label: "Heading", icon: Heading1, defaultProps: { text: "Your Heading Here", fontSize: "24", color: "#111111", align: "left" } },
  { type: "text", label: "Text Block", icon: AlignLeft, defaultProps: { text: "Write your email content here. You can customize the text, color, and alignment.", color: "#555555", fontSize: "15", align: "left" } },
  { type: "button", label: "CTA Button", icon: MousePointer, defaultProps: { text: "Click Here →", url: "https://fundingpulze.com", bgColor: "#000000", textColor: "#ffffff", borderRadius: "8", align: "left" } },
  { type: "image", label: "Image", icon: ImageIcon, defaultProps: { src: "", alt: "Image", width: "100" } },
  { type: "divider", label: "Divider", icon: Minus, defaultProps: { color: "#eeeeee", thickness: "1" } },
  { type: "spacer", label: "Spacer", icon: Square, defaultProps: { height: "20" } },
  { type: "social", label: "Social Links", icon: Link2, defaultProps: { instagram: "https://www.instagram.com/funding_pulze", twitter: "https://x.com/fundingpulze", discord: "https://discord.gg/YgWhnxNewG" } },
  { type: "footer", label: "Footer", icon: FileText, defaultProps: { text: "© 2026 Funding Pulze. All rights reserved.", color: "#999999", fontSize: "12" } },
];

// ---- Block to HTML ----
function blockToHtml(block: EmailBlock): string {
  const p = block.props;
  switch (block.type) {
    case "header":
      return `<div style="background:${p.bgColor};padding:30px 40px;text-align:center"><h1 style="color:${p.textColor};font-size:${p.fontSize}px;margin:0;font-family:'Space Grotesk',Arial,sans-serif;letter-spacing:1px">${p.text}</h1></div>`;
    case "logo":
      return `<div style="padding:20px 40px;text-align:${p.align}"><img src="${p.src}" alt="${p.alt}" width="${p.width}" style="border-radius:12px" /></div>`;
    case "heading":
      return `<div style="padding:10px 40px;text-align:${p.align}"><h2 style="color:${p.color};font-size:${p.fontSize}px;margin:0;font-family:'Space Grotesk',Arial,sans-serif;font-weight:bold">${p.text}</h2></div>`;
    case "text":
      return `<div style="padding:5px 40px"><p style="color:${p.color};font-size:${p.fontSize}px;line-height:1.7;margin:0;text-align:${p.align}">${p.text.replace(/\n/g, "<br/>")}</p></div>`;
    case "button":
      return `<div style="padding:15px 40px;text-align:${p.align}"><a href="${p.url}" style="display:inline-block;background:${p.bgColor};color:${p.textColor}!important;text-decoration:none;padding:14px 32px;border-radius:${p.borderRadius}px;font-size:14px;font-weight:600;letter-spacing:0.5px;font-family:Arial,sans-serif">${p.text}</a></div>`;
    case "image":
      return p.src ? `<div style="padding:10px 40px;text-align:center"><img src="${p.src}" alt="${p.alt}" style="max-width:${p.width}%;border-radius:8px" /></div>` : "";
    case "divider":
      return `<div style="padding:10px 40px"><hr style="border:none;border-top:${p.thickness}px solid ${p.color};margin:0" /></div>`;
    case "spacer":
      return `<div style="height:${p.height}px"></div>`;
    case "social":
      return `<div style="padding:15px 40px;text-align:center"><a href="${p.instagram}" style="color:#111;text-decoration:none;font-size:13px;font-weight:500;margin:0 8px">Instagram</a> · <a href="${p.twitter}" style="color:#111;text-decoration:none;font-size:13px;font-weight:500;margin:0 8px">Twitter</a> · <a href="${p.discord}" style="color:#111;text-decoration:none;font-size:13px;font-weight:500;margin:0 8px">Discord</a></div>`;
    case "footer":
      return `<div style="padding:20px 40px;text-align:center;border-top:1px solid #eee"><p style="color:${p.color};font-size:${p.fontSize}px;margin:0;line-height:1.6">${p.text}</p></div>`;
    default:
      return "";
  }
}

function blocksToFullHtml(blocks: EmailBlock[]): string {
  const body = blocks.map(blockToHtml).join("\n");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5}img{max-width:100%;height:auto}</style></head><body><div style="max-width:600px;margin:0 auto;background:#ffffff">${body}</div></body></html>`;
}

// ---- Block Editor Props ----
function BlockPropEditor({ block, onChange }: { block: EmailBlock; onChange: (props: Record<string, string>) => void }) {
  const p = block.props;
  const set = (key: string, val: string) => onChange({ ...p, [key]: val });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const handleImageUpload = async (file: File, key: string) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > MAX_EMAIL_ASSET_SIZE) {
      toast.error("Image must be under 5MB");
      return;
    }

    const path = buildEmailAssetPath(file);
    setUploadingKey(key);

    try {
      const { error } = await supabase.storage.from("email-assets").upload(path, file, {
        upsert: false,
        cacheControl: "3600",
        contentType: file.type,
      });

      if (error) throw error;

      const { data } = supabase.storage.from("email-assets").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not generate image URL");

      set(key, data.publicUrl);
      toast.success("Image uploaded");
    } catch (error: any) {
      toast.error(error?.message || "Upload failed");
    } finally {
      setUploadingKey(null);
    }
  };

  const fields: { key: string; label: string; type?: string; options?: string[] }[] = (() => {
    switch (block.type) {
      case "header": return [{ key: "text", label: "Text" }, { key: "bgColor", label: "Background", type: "color" }, { key: "textColor", label: "Text Color", type: "color" }, { key: "fontSize", label: "Font Size" }];
      case "logo": return [{ key: "src", label: "Logo URL" }, { key: "alt", label: "Alt Text" }, { key: "width", label: "Width (px)" }, { key: "align", label: "Align", options: ["left", "center", "right"] }];
      case "heading": return [{ key: "text", label: "Heading" }, { key: "fontSize", label: "Font Size" }, { key: "color", label: "Color", type: "color" }, { key: "align", label: "Align", options: ["left", "center", "right"] }];
      case "text": return [{ key: "text", label: "Content", type: "textarea" }, { key: "color", label: "Color", type: "color" }, { key: "fontSize", label: "Font Size" }, { key: "align", label: "Align", options: ["left", "center", "right"] }];
      case "button": return [{ key: "text", label: "Button Text" }, { key: "url", label: "Link URL" }, { key: "bgColor", label: "Background", type: "color" }, { key: "textColor", label: "Text Color", type: "color" }, { key: "borderRadius", label: "Radius (px)" }, { key: "align", label: "Align", options: ["left", "center", "right"] }];
      case "image": return [{ key: "src", label: "Image URL" }, { key: "alt", label: "Alt Text" }, { key: "width", label: "Width (%)" }];
      case "divider": return [{ key: "color", label: "Color", type: "color" }, { key: "thickness", label: "Thickness (px)" }];
      case "spacer": return [{ key: "height", label: "Height (px)" }];
      case "social": return [{ key: "instagram", label: "Instagram URL" }, { key: "twitter", label: "Twitter URL" }, { key: "discord", label: "Discord URL" }];
      case "footer": return [{ key: "text", label: "Footer Text", type: "textarea" }, { key: "color", label: "Color", type: "color" }, { key: "fontSize", label: "Font Size" }];
      default: return [];
    }
  })();

  return (
    <div className="space-y-2 p-3 bg-[hsl(0,0%,97%)] rounded-lg border border-[hsl(0,0%,90%)]">
      {(block.type === "logo") && (
        <div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "src"); e.target.value = ""; }} />
          <Button size="sm" variant="outline" disabled={uploadingKey === "src"} onClick={() => logoInputRef.current?.click()} className="text-[10px] mb-1 w-full">
            <Upload size={10} className="mr-1" />{uploadingKey === "src" ? "Uploading..." : "Upload Logo"}
          </Button>
        </div>
      )}
      {(block.type === "image") && (
        <div>
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, "src"); e.target.value = ""; }} />
          <Button size="sm" variant="outline" disabled={uploadingKey === "src"} onClick={() => imgInputRef.current?.click()} className="text-[10px] mb-1 w-full">
            <Upload size={10} className="mr-1" />{uploadingKey === "src" ? "Uploading..." : "Upload Image"}
          </Button>
        </div>
      )}
      {p.src && (block.type === "logo" || block.type === "image") && (
        <div className="rounded-lg border border-[hsl(0,0%,88%)] bg-[hsl(0,0%,100%)] p-2">
          <img src={p.src} alt={p.alt || "Preview"} className="max-h-24 w-full rounded object-contain" loading="lazy" />
        </div>
      )}
      {fields.map(f => (
        <div key={f.key} className="flex items-center gap-2">
          <label className="text-[10px] text-[hsl(0,0%,40%)] w-16 shrink-0">{f.label}</label>
          {f.options ? (
            <select value={p[f.key] || ""} onChange={e => set(f.key, e.target.value)} className={`flex-1 h-7 text-xs rounded border px-2 ${LIGHT_SELECT_CLASS}`} style={{ colorScheme: "light" }}>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : f.type === "textarea" ? (
            <Textarea value={p[f.key] || ""} onChange={e => set(f.key, e.target.value)} rows={3} className={`flex-1 text-xs ${LIGHT_FIELD_CLASS}`} style={{ colorScheme: "light" }} />
          ) : f.type === "color" ? (
            <div className="flex items-center gap-1 flex-1">
              <input type="color" value={p[f.key] || "#000000"} onChange={e => set(f.key, e.target.value)} className="w-7 h-7 rounded border-0 cursor-pointer" />
              <Input value={p[f.key] || ""} onChange={e => set(f.key, e.target.value)} className={`flex-1 h-7 text-xs font-mono ${LIGHT_FIELD_CLASS}`} style={{ colorScheme: "light" }} />
            </div>
          ) : (
            <Input value={p[f.key] || ""} onChange={e => set(f.key, e.target.value)} className={`flex-1 h-7 text-xs ${LIGHT_FIELD_CLASS}`} style={{ colorScheme: "light" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Main Component ----
interface Props {
  onUseTemplate?: (html: string) => void;
  standalone?: boolean;
}

export default function EmailTemplateBuilder({ onUseTemplate, standalone = true }: Props) {
  const [blocks, setBlocks] = useState<EmailBlock[]>([
    { id: uid(), type: "header", props: { ...DEFAULT_BLOCKS[0].defaultProps } },
    { id: uid(), type: "logo", props: { ...DEFAULT_BLOCKS[1].defaultProps } },
    { id: uid(), type: "heading", props: { ...DEFAULT_BLOCKS[2].defaultProps } },
    { id: uid(), type: "text", props: { ...DEFAULT_BLOCKS[3].defaultProps } },
    { id: uid(), type: "button", props: { ...DEFAULT_BLOCKS[4].defaultProps } },
    { id: uid(), type: "footer", props: { ...DEFAULT_BLOCKS[9].defaultProps } },
  ]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");
  const [rawHtml, setRawHtml] = useState("");
  const [showPreview, setShowPreview] = useState(true);

  // Save template state
  const [saveDialog, setSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateCategory, setTemplateCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  // Saved templates list
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplatesList, setShowTemplatesList] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    const { data } = await supabase.from("saved_email_templates").select("*").order("created_at", { ascending: false });
    if (data) setSavedTemplates(data);
    setLoadingTemplates(false);
  };

  const addBlock = (type: BlockType) => {
    const def = DEFAULT_BLOCKS.find(b => b.type === type);
    if (!def) return;
    const newBlock: EmailBlock = { id: uid(), type, props: { ...def.defaultProps } };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const updateBlockProps = (id: string, props: Record<string, string>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, props } : b));
  };

  const getHtml = useCallback(() => {
    return editorMode === "code" ? rawHtml : blocksToFullHtml(blocks);
  }, [blocks, editorMode, rawHtml]);

  const switchToCode = () => {
    setRawHtml(blocksToFullHtml(blocks));
    setEditorMode("code");
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) { toast.error("Template name required"); return; }
    setSaving(true);
    const html = getHtml();
    const payload = {
      name: templateName, description: templateDesc || null,
      html_content: html, category: templateCategory,
    };

    if (editingTemplateId) {
      const { error } = await supabase.from("saved_email_templates").update(payload).eq("id", editingTemplateId);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Template updated");
    } else {
      const { error } = await supabase.from("saved_email_templates").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Template saved");
    }
    setSaveDialog(false); setTemplateName(""); setTemplateDesc(""); setEditingTemplateId(null);
    setSaving(false);
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("saved_email_templates").delete().eq("id", id);
    toast.success("Template deleted");
    fetchTemplates();
  };

  const loadTemplate = (template: any) => {
    setRawHtml(template.html_content);
    setEditorMode("code");
    setShowTemplatesList(false);
    toast.success(`"${template.name}" loaded`);
  };

  const editTemplate = (template: any) => {
    setRawHtml(template.html_content);
    setEditorMode("code");
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDesc(template.description || "");
    setTemplateCategory(template.category || "general");
    setShowTemplatesList(false);
    toast.info(`Editing "${template.name}"`);
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = {
      general: "bg-[hsl(0,0%,92%)] text-[hsl(0,0%,35%)]",
      promotional: "bg-[hsl(45,80%,90%)] text-[hsl(45,70%,30%)]",
      newsletter: "bg-[hsl(200,70%,90%)] text-[hsl(200,60%,30%)]",
      transactional: "bg-[hsl(142,60%,90%)] text-[hsl(142,50%,25%)]",
      announcement: "bg-[hsl(270,60%,92%)] text-[hsl(270,50%,30%)]",
    };
    return map[cat] || map.general;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-[hsl(0,0%,95%)] rounded-lg p-0.5">
            <button onClick={() => setEditorMode("visual")} className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${editorMode === "visual" ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "text-[hsl(0,0%,50%)]"}`}>
              <Layers size={10} className="inline mr-1" />Visual Builder
            </button>
            <button onClick={switchToCode} className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${editorMode === "code" ? "bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]" : "text-[hsl(0,0%,50%)]"}`}>
              <Code size={10} className="inline mr-1" />HTML Code
            </button>
          </div>
          <button onClick={() => setShowPreview(!showPreview)} className={`text-[10px] px-3 py-1.5 rounded-md flex items-center gap-1 ${showPreview ? "bg-[hsl(200,70%,93%)] text-[hsl(200,70%,30%)]" : "bg-[hsl(0,0%,95%)] text-[hsl(0,0%,50%)]"}`}>
            <Eye size={10} />{showPreview ? "Hide Preview" : "Preview"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => { fetchTemplates(); setShowTemplatesList(true); }} className="text-xs">
            <Layers size={12} className="mr-1" />My Templates
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setTemplateName(""); setTemplateDesc(""); setEditingTemplateId(null); setSaveDialog(true); }} className="text-xs">
            <Save size={12} className="mr-1" />Save Template
          </Button>
          {onUseTemplate && (
            <Button size="sm" onClick={() => onUseTemplate(getHtml())} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
              Use in Campaign
            </Button>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className={`grid gap-4 ${showPreview ? (editorMode === "visual" ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1 lg:grid-cols-2") : "grid-cols-1"}`}>
        {editorMode === "visual" ? (
          <>
            {/* Block Palette */}
            <div className="lg:col-span-2 space-y-2">
              <h4 className="text-[10px] font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider">Add Blocks</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {DEFAULT_BLOCKS.map(b => (
                  <button key={b.type} onClick={() => addBlock(b.type)} className="flex items-center gap-1.5 px-2 py-2 rounded-lg border border-[hsl(0,0%,90%)] bg-[hsl(0,0%,100%)] hover:border-[hsl(0,0%,70%)] hover:shadow-sm transition-all text-left">
                    <b.icon size={12} className="text-[hsl(0,0%,40%)] shrink-0" />
                    <span className="text-[10px] font-medium text-[hsl(0,0%,25%)]">{b.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Block List */}
            <div className={`${showPreview ? "lg:col-span-5" : "lg:col-span-10"} space-y-2`}>
              <h4 className="text-[10px] font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider">Email Blocks ({blocks.length})</h4>
              <div className="space-y-1.5 max-h-[600px] overflow-auto pr-1">
                {blocks.map((b, idx) => {
                  const def = DEFAULT_BLOCKS.find(d => d.type === b.type);
                  const Icon = def?.icon || Square;
                  return (
                    <div key={b.id}>
                      <div onClick={() => setSelectedBlockId(selectedBlockId === b.id ? null : b.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${selectedBlockId === b.id ? "border-[hsl(0,0%,0%)] bg-[hsl(0,0%,97%)] shadow-sm" : "border-[hsl(0,0%,90%)] bg-[hsl(0,0%,100%)] hover:border-[hsl(0,0%,75%)]"}`}>
                        <GripVertical size={12} className="text-[hsl(0,0%,70%)] shrink-0" />
                        <Icon size={14} className="text-[hsl(0,0%,40%)] shrink-0" />
                        <span className="text-xs font-medium text-[hsl(0,0%,15%)] flex-1 truncate">
                          {def?.label || b.type}
                          {b.props.text && <span className="text-[hsl(0,0%,55%)] ml-1.5 font-normal">— {b.props.text.slice(0, 30)}{b.props.text.length > 30 ? "…" : ""}</span>}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button onClick={e => { e.stopPropagation(); moveBlock(b.id, -1); }} disabled={idx === 0} className="p-1 rounded hover:bg-[hsl(0,0%,90%)] disabled:opacity-30"><ArrowUp size={10} /></button>
                          <button onClick={e => { e.stopPropagation(); moveBlock(b.id, 1); }} disabled={idx === blocks.length - 1} className="p-1 rounded hover:bg-[hsl(0,0%,90%)] disabled:opacity-30"><ArrowDown size={10} /></button>
                          <button onClick={e => { e.stopPropagation(); removeBlock(b.id); }} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={10} /></button>
                        </div>
                      </div>
                      {selectedBlockId === b.id && (
                        <div className="mt-1 ml-4">
                          <BlockPropEditor block={b} onChange={props => updateBlockProps(b.id, props)} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {blocks.length === 0 && <p className="text-xs text-[hsl(0,0%,55%)] text-center py-8">Click blocks on the left to add them</p>}
              </div>
            </div>

            {/* Live Preview */}
            {showPreview && (
              <div className="lg:col-span-5 space-y-2">
                <h4 className="text-[10px] font-semibold text-[hsl(0,0%,40%)] uppercase tracking-wider">Preview</h4>
                <div className="border border-[hsl(0,0%,88%)] rounded-xl overflow-hidden bg-[hsl(0,0%,96%)]">
                  <div className="px-3 py-1.5 bg-[hsl(0,0%,93%)] border-b border-[hsl(0,0%,88%)] flex items-center gap-2">
                    <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-300" /><div className="w-2 h-2 rounded-full bg-yellow-300" /><div className="w-2 h-2 rounded-full bg-green-300" /></div>
                    <span className="text-[9px] text-[hsl(0,0%,50%)] font-mono">Email Preview</span>
                  </div>
                  <iframe srcDoc={blocksToFullHtml(blocks)} className="w-full h-[500px] border-0" sandbox="allow-same-origin" title="Preview" />
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Code Editor */}
            <div className="space-y-2">
              <Textarea value={rawHtml} onChange={e => setRawHtml(e.target.value)} rows={22} placeholder="Paste or write your HTML email code here..." className="font-mono text-xs leading-relaxed" />
              <p className="text-[10px] text-[hsl(0,0%,55%)]">Full HTML + CSS supported. Links auto-tracked for click analytics.</p>
            </div>
            {showPreview && (
              <div className="space-y-2">
                <div className="border border-[hsl(0,0%,88%)] rounded-xl overflow-hidden bg-[hsl(0,0%,96%)]">
                  <div className="px-3 py-1.5 bg-[hsl(0,0%,93%)] border-b border-[hsl(0,0%,88%)] flex items-center gap-2">
                    <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-red-300" /><div className="w-2 h-2 rounded-full bg-yellow-300" /><div className="w-2 h-2 rounded-full bg-green-300" /></div>
                    <span className="text-[9px] text-[hsl(0,0%,50%)] font-mono">Live Preview</span>
                  </div>
                  <iframe srcDoc={rawHtml} className="w-full h-[500px] border-0" sandbox="allow-same-origin" title="Preview" />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Save Template Dialog */}
      <Dialog open={saveDialog} onOpenChange={setSaveDialog}>
        <DialogContent className={LIGHT_DIALOG_CLASS} style={{ colorScheme: "light" }}>
          <DialogHeader><DialogTitle className="font-display">{editingTemplateId ? "Update Template" : "Save as Template"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs text-[hsl(0,0%,35%)]">Template Name</Label><Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="e.g. Weekly Newsletter v2" className={LIGHT_FIELD_CLASS} style={{ colorScheme: "light" }} /></div>
            <div><Label className="text-xs text-[hsl(0,0%,35%)]">Description (optional)</Label><Input value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} placeholder="Short description" className={LIGHT_FIELD_CLASS} style={{ colorScheme: "light" }} /></div>
            <div>
              <Label className="text-xs text-[hsl(0,0%,35%)]">Category</Label>
              <Select value={templateCategory} onValueChange={setTemplateCategory}>
                <SelectTrigger className={`text-xs ${LIGHT_SELECT_CLASS}`} style={{ colorScheme: "light" }}><SelectValue /></SelectTrigger>
                <SelectContent className={LIGHT_DIALOG_CLASS}>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="transactional">Transactional</SelectItem>
                  <SelectItem value="announcement">Announcement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialog(false)} className="text-xs">Cancel</Button>
            <Button onClick={saveTemplate} disabled={saving} className="text-xs bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)]">
              <Save size={12} className="mr-1" />{saving ? "Saving..." : editingTemplateId ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saved Templates List Dialog */}
      <Dialog open={showTemplatesList} onOpenChange={setShowTemplatesList}>
        <DialogContent className={`${LIGHT_DIALOG_CLASS} max-w-3xl max-h-[80vh] overflow-hidden flex flex-col`} style={{ colorScheme: "light" }}>
          <DialogHeader><DialogTitle className="font-display">Saved Templates</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-auto">
            {loadingTemplates ? (
              <p className="text-xs text-[hsl(0,0%,55%)] text-center py-12">Loading...</p>
            ) : savedTemplates.length === 0 ? (
              <p className="text-xs text-[hsl(0,0%,55%)] text-center py-12">No saved templates yet. Build one and save it!</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
                {savedTemplates.map(t => (
                  <div key={t.id} className="bg-[hsl(0,0%,98%)] border border-[hsl(0,0%,90%)] rounded-xl overflow-hidden hover:border-[hsl(0,0%,70%)] transition-all">
                    {/* Mini preview */}
                    <div className="h-32 overflow-hidden border-b border-[hsl(0,0%,90%)] relative">
                      <iframe srcDoc={t.html_content} className="w-[600px] h-[600px] border-0 pointer-events-none" style={{ transform: "scale(0.35)", transformOrigin: "top left" }} sandbox="" title={t.name} />
                    </div>
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-xs font-semibold text-[hsl(0,0%,10%)] truncate">{t.name}</h4>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${getCategoryColor(t.category)}`}>{t.category}</span>
                      </div>
                      {t.description && <p className="text-[10px] text-[hsl(0,0%,50%)] mb-2 line-clamp-2">{t.description}</p>}
                      <p className="text-[9px] text-[hsl(0,0%,60%)] mb-2">{new Date(t.created_at).toLocaleDateString()}</p>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" onClick={() => loadTemplate(t)} className="text-[10px] h-7 flex-1 bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
                          <Copy size={10} className="mr-1" />Use
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => editTemplate(t)} className="text-[10px] h-7">
                          <Pencil size={10} />
                        </Button>
                        {onUseTemplate && (
                          <Button size="sm" variant="outline" onClick={() => { onUseTemplate(t.html_content); setShowTemplatesList(false); toast.success("Template applied to campaign"); }} className="text-[10px] h-7">
                            <Layout size={10} className="mr-1" />Apply
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => deleteTemplate(t.id)} className="text-[10px] h-7 text-red-500 hover:bg-red-50">
                          <Trash2 size={10} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
