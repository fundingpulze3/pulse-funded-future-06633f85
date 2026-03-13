import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, RefreshCw, Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface UserAccount {
  purchaseId: string;
  userId: string;
  userName: string;
  email: string;
  challengeName: string;
  challengeId: string;
  accountSize: number;
  stepType: string;
  status: string;
  mt5Login: string | null;
  credentialId: string | null;
}

const PHASES = [
  { value: "pending", label: "Pending", color: "bg-yellow-50 text-yellow-700" },
  { value: "active", label: "Active (Phase 1)", color: "bg-blue-50 text-blue-700" },
  { value: "phase2", label: "Phase 2", color: "bg-cyan-50 text-cyan-700" },
  { value: "funded", label: "Funded", color: "bg-green-50 text-green-700" },
  { value: "breached", label: "Breached", color: "bg-red-50 text-red-700" },
  { value: "completed", label: "Completed", color: "bg-purple-50 text-purple-700" },
];

const UserPhaseManager = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [noCredsAlert, setNoCredsAlert] = useState(false);
  const [pendingCredsUsers, setPendingCredsUsers] = useState<UserAccount[]>([]);
  const [uploadDialog, setUploadDialog] = useState<UserAccount | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { fetchAccounts(); }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const [purchasesRes, profilesRes, challengesRes, credsRes] = await Promise.all([
      supabase.from("challenge_purchases").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, display_name, email"),
      supabase.from("challenges").select("id, name, account_size, step_type"),
      supabase.from("trading_credentials").select("id, mt5_login, challenge_id, assigned_to, purchase_id, is_assigned"),
    ]);

    const profiles = profilesRes.data || [];
    const challenges = challengesRes.data || [];
    const creds = credsRes.data || [];
    const purchases = purchasesRes.data || [];

    const mapped: UserAccount[] = purchases.map(p => {
      const profile = profiles.find(pr => pr.user_id === p.user_id);
      const challenge = challenges.find(c => c.id === p.challenge_id);
      const cred = creds.find(c => c.assigned_to === p.user_id && c.challenge_id === p.challenge_id);
      return {
        purchaseId: p.id,
        userId: p.user_id,
        userName: profile?.display_name || profile?.email?.split("@")[0] || "Unknown",
        email: profile?.email || "",
        challengeName: challenge?.name || "Unknown",
        challengeId: p.challenge_id,
        accountSize: challenge?.account_size || 0,
        stepType: challenge?.step_type || "",
        status: p.status,
        mt5Login: cred?.mt5_login || null,
        credentialId: cred?.id || null,
      };
    });

    setAccounts(mapped);

    // Check for users without credentials
    const noCreds = mapped.filter(a => !a.mt5Login && a.status !== "breached" && a.status !== "pending");
    setPendingCredsUsers(noCreds);

    // Check if credential pool is empty for any challenge
    const unassignedCreds = creds.filter(c => !c.is_assigned);
    if (unassignedCreds.length === 0 && noCreds.length > 0) {
      setNoCredsAlert(true);
    }

    setLoading(false);
  };

  const changePhase = async (account: UserAccount, newStatus: string) => {
    setUpdating(account.purchaseId);
    const oldStatus = account.status;

    // Update purchase status
    const { error } = await supabase
      .from("challenge_purchases")
      .update({ status: newStatus })
      .eq("id", account.purchaseId);

    if (error) {
      toast.error(error.message);
      setUpdating(null);
      return;
    }

    // Log status change to history
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("account_status_history").insert({
      purchase_id: account.purchaseId,
      user_id: account.userId,
      old_status: oldStatus,
      new_status: newStatus,
      changed_by: session?.user?.id || null,
    } as any);

    // Auto-assign credentials if moving to active phase and no creds assigned
    if ((newStatus === "active" || newStatus === "phase2" || newStatus === "funded") && !account.mt5Login) {
      const { data: availableCred } = await supabase
        .from("trading_credentials")
        .select("*")
        .eq("is_assigned", false)
        .eq("challenge_id", account.challengeId)
        .limit(1)
        .single();

      if (availableCred) {
        await supabase
          .from("trading_credentials")
          .update({
            is_assigned: true,
            assigned_to: account.userId,
            purchase_id: account.purchaseId,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", availableCred.id);
        toast.success(`Credentials auto-assigned: MT5 ${availableCred.mt5_login}`);
      } else {
        setNoCredsAlert(true);
        toast.warning("No available credentials in pool! Please add more.");
      }
    }

    // Auto-generate certificate for passed phases
    if (newStatus === "completed" || newStatus === "phase2" || newStatus === "funded") {
      const certType = newStatus === "phase2" ? "phase1_passed" : newStatus === "funded" ? "phase2_passed" : "funded";
      const certTitle = newStatus === "phase2" ? "Phase 1 Passed" : newStatus === "funded" ? "Phase 2 Passed" : "Funded Account";

      await supabase.from("user_certificates").insert({
        user_id: account.userId,
        certificate_type: certType,
        account_number: account.mt5Login,
        title: certTitle,
        description: `${account.userName} - ${account.challengeName}`,
        credential_id: account.credentialId,
        purchase_id: account.purchaseId,
        stats: { accountSize: account.accountSize, userName: account.userName },
      });
      toast.success(`Certificate "${certTitle}" issued to ${account.userName}`);
    }

    toast.success(`Phase updated to ${newStatus}`);
    setUpdating(null);
    fetchAccounts();
  };

  const handleStatementUpload = async (account: UserAccount, file: File) => {
    setUploading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Not authenticated"); setUploading(false); return; }

    const formData = new FormData();
    formData.append("file", file);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-mt5-statement`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: formData }
      );
      const result = await res.json();

      if (result.success) {
        toast.success(result.message || "Statement processed - certificate issued!");
        // If passed, auto-assign new credentials for next phase
        if (result.certificateType === "phase1_passed") {
          // Move to phase 2 and assign new creds
          await changePhase(account, "phase2");
        }
      } else {
        toast.error(result.message || result.error || "Statement processing failed");
      }
    } catch (err) {
      toast.error(String(err));
    }

    setUploading(false);
    setUploadDialog(null);
    fetchAccounts();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-5 h-5 border-2 border-[hsl(0,0%,30%)] border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* No credentials alert */}
      {noCredsAlert && (
        <div className="bg-red-50 rounded-xl p-4 flex items-start gap-3 border border-red-200">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">No Credentials Available!</p>
            <p className="text-xs text-red-600 mt-1">
              {pendingCredsUsers.length} user(s) are waiting for credentials. Please add more credentials in the Credentials Manager, then click Refresh.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="outline" className="text-xs border-red-300 text-red-700 hover:bg-red-100" onClick={() => { fetchAccounts(); setNoCredsAlert(false); }}>
                <RefreshCw size={12} className="mr-1" /> Refresh & Auto-Assign
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Users without creds */}
      {pendingCredsUsers.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm font-semibold text-amber-800 mb-2">Users Waiting for Credentials ({pendingCredsUsers.length})</p>
          <div className="space-y-1">
            {pendingCredsUsers.map(u => (
              <div key={u.purchaseId} className="flex items-center justify-between text-xs text-amber-700">
                <span>{u.userName} — {u.challengeName} ({u.status})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(0,0%,92%)] flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[hsl(0,0%,10%)]">User Accounts ({accounts.length})</h3>
          <Button size="sm" variant="outline" onClick={fetchAccounts} className="text-xs rounded-lg border-[hsl(0,0%,88%)]">
            <RefreshCw size={12} className="mr-1" /> Refresh
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[hsl(0,0%,45%)] border-b border-[hsl(0,0%,92%)]">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Challenge</th>
                <th className="px-4 py-3 font-medium">MT5 Login</th>
                <th className="px-4 py-3 font-medium">Phase / Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(account => {
                const phase = PHASES.find(p => p.value === account.status) || PHASES[0];
                return (
                  <tr key={account.purchaseId} className="border-b border-[hsl(0,0%,95%)] last:border-0 hover:bg-[hsl(0,0%,98%)] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[hsl(0,0%,10%)]">{account.userName}</p>
                      <p className="text-[10px] text-[hsl(0,0%,50%)]">{account.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-[hsl(0,0%,20%)]">{account.challengeName}</p>
                      <p className="text-[10px] text-[hsl(0,0%,50%)]">{account.stepType}</p>
                    </td>
                    <td className="px-4 py-3">
                      {account.mt5Login ? (
                        <code className="text-xs bg-[hsl(0,0%,95%)] px-2 py-0.5 rounded font-mono">{account.mt5Login}</code>
                      ) : (
                        <span className="text-xs text-[hsl(0,0%,60%)]">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={account.status}
                        onChange={(e) => changePhase(account, e.target.value)}
                        disabled={updating === account.purchaseId}
                        className={`text-xs rounded-lg border px-2 py-1.5 font-medium ${phase.color} border-transparent cursor-pointer`}
                      >
                        {PHASES.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                      {updating === account.purchaseId && <Loader2 size={12} className="inline ml-2 animate-spin text-[hsl(0,0%,50%)]" />}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setUploadDialog(account)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[hsl(0,0%,95%)] hover:bg-[hsl(0,0%,90%)] text-xs font-medium text-[hsl(0,0%,30%)] transition-colors"
                        title="Upload MT5 statement for this user"
                      >
                        <Upload size={12} /> Statement
                      </button>
                    </td>
                  </tr>
                );
              })}
              {accounts.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No user accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Statement Dialog */}
      <Dialog open={!!uploadDialog} onOpenChange={() => setUploadDialog(null)}>
        <DialogContent className="bg-white border-[hsl(0,0%,90%)] rounded-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[hsl(0,0%,5%)] flex items-center gap-2">
              <FileText size={18} /> Upload Statement for {uploadDialog?.userName}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[hsl(0,0%,50%)]">
            Upload an MT5 HTML statement. If the user passes, credentials will be auto-assigned and a certificate will be issued.
          </p>
          <label className="mt-4 flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[hsl(0,0%,0%)] text-white text-sm font-medium cursor-pointer hover:bg-[hsl(0,0%,15%)] transition-colors">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? "Processing..." : "Select HTML Statement"}
            <input
              type="file"
              accept=".html,.htm"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && uploadDialog) handleStatementUpload(uploadDialog, file);
                if (e.target) e.target.value = "";
              }}
            />
          </label>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserPhaseManager;
