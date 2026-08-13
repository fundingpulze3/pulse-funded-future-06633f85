import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db as supabase } from "@/integrations/db/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2, Save } from "lucide-react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

const DashboardSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null; email: string | null } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name, avatar_url, email")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setDisplayName(data.display_name || "");
        }
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to update name");
    else {
      toast.success("Profile updated");
      setProfile(p => p ? { ...p, display_name: displayName } : p);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max file size is 2 MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadErr) {
      toast.error("Upload failed");
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("user_id", user.id);

    setUploading(false);
    if (updateErr) toast.error("Failed to save avatar");
    else {
      toast.success("Avatar updated");
      setProfile(p => p ? { ...p, avatar_url: publicUrl } : p);
    }
  };

  const initials = (profile?.display_name || user?.email || "U")[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[hsl(220,20%,4%)] text-white flex flex-col">
      <DashboardSidebar profile={profile} />
      <div className="flex flex-1">
        <div className="hidden lg:block w-16 shrink-0" />
        <main className="flex-1 p-4 lg:p-8 max-w-2xl mx-auto w-full">
          <h1 className="text-xl font-bold mb-6">Profile Settings</h1>

          {/* Avatar */}
          <div className="flex items-center gap-5 mb-8">
            <div className="relative group">
              <Avatar className="w-20 h-20 border-2 border-[hsl(220,15%,15%)]">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="Avatar" />
                ) : (
                  <AvatarFallback className="bg-[hsl(207,90%,77%)]/20 text-[hsl(207,90%,77%)] text-2xl font-bold">
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
              </label>
            </div>
            <div>
              <p className="font-medium text-sm">{profile?.display_name || "Trader"}</p>
              <p className="text-xs text-[hsl(220,15%,45%)]">{profile?.email || user?.email}</p>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-[hsl(220,15%,50%)]">Display Name</Label>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-white"
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-[hsl(220,15%,50%)]">Email</Label>
              <Input
                value={user?.email || ""}
                disabled
                className="bg-[hsl(220,15%,8%)] border-[hsl(220,15%,15%)] text-[hsl(220,15%,40%)]"
              />
              <p className="text-[10px] text-[hsl(220,15%,35%)]">Email cannot be changed here.</p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || displayName === profile?.display_name}
              className="bg-[hsl(207,90%,77%)] hover:bg-[hsl(207,90%,72%)] text-black font-medium text-xs gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Changes
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardSettings;
