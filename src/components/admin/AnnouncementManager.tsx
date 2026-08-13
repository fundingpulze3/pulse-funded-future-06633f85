import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/db/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Megaphone } from "lucide-react";

const AnnouncementManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [bgColor, setBgColor] = useState("#6366f1");
  const [textColor, setTextColor] = useState("#ffffff");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("announcement_bar")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        setId(data.id);
        setMessage(data.message || "");
        setIsActive(data.is_active);
        setBgColor(data.bg_color || "#6366f1");
        setTextColor(data.text_color || "#ffffff");
        setLinkUrl(data.link_url || "");
        setLinkText(data.link_text || "");
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const save = async () => {
    setSaving(true);
    const payload = {
      message,
      is_active: isActive,
      bg_color: bgColor,
      text_color: textColor,
      link_url: linkUrl || null,
      link_text: linkText || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (id) {
      ({ error } = await supabase.from("announcement_bar").update(payload).eq("id", id));
    } else {
      const res = await supabase.from("announcement_bar").insert(payload).select().single();
      error = res.error;
      if (res.data) setId(res.data.id);
    }

    if (error) toast.error(error.message);
    else toast.success("Announcement updated!");
    setSaving(false);
  };

  if (loading) return <p className="text-sm text-[hsl(0,0%,50%)]">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)] flex items-center gap-2">
          <Megaphone size={20} /> Announcement Bar
        </h2>
        <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">
          This banner appears at the top of the homepage and dashboard for all visitors.
        </p>
      </div>

      {/* Preview */}
      <div
        className="rounded-lg py-2.5 px-4 text-center text-sm font-medium"
        style={{ backgroundColor: bgColor, color: textColor }}
      >
        {message || "Your announcement will appear here..."}{" "}
        {linkText && <span className="underline font-semibold">{linkText}</span>}
      </div>

      <div className="grid gap-4 max-w-xl">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Active</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div>
          <Label className="text-xs text-[hsl(0,0%,45%)]">Message</Label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Haven't purchased yet? Use code HELLO & Get 20% OFF!"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[hsl(0,0%,45%)]">Background Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-[hsl(0,0%,45%)]">Text Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-[hsl(0,0%,45%)]">Link URL (optional)</Label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs text-[hsl(0,0%,45%)]">Link Text (optional)</Label>
            <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Shop Now" className="mt-1" />
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="w-fit bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)]">
          {saving ? "Saving..." : "Save Announcement"}
        </Button>
      </div>
    </div>
  );
};

export default AnnouncementManager;
