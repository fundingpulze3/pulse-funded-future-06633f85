import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportUsersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ImportResult {
  email: string;
  status: "success" | "error" | "exists";
  message: string;
}

const ImportUsers = ({ open, onOpenChange, onImportComplete }: ImportUsersProps) => {
  const [emailText, setEmailText] = useState("");
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseEmails = (text: string): string[] => {
    const raw = text
      .split(/[\n,;|\t]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    return [...new Set(raw)];
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      // Try to extract emails from CSV content
      const lines = content.split("\n");
      const emails: string[] = [];
      for (const line of lines) {
        const cells = line.split(",").map(c => c.trim().replace(/^["']|["']$/g, ""));
        for (const cell of cells) {
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell.toLowerCase())) {
            emails.push(cell.toLowerCase());
          }
        }
      }
      setEmailText(prev => prev ? prev + "\n" + emails.join("\n") : emails.join("\n"));
      toast.success(`Found ${emails.length} emails from CSV`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    const emails = parseEmails(emailText);
    if (emails.length === 0) {
      toast.error("No valid emails found");
      return;
    }

    setImporting(true);
    setResults([]);
    setShowResults(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Send in batches of 200 to the edge function
      const BATCH = 200;
      const allResults: ImportResult[] = [];
      for (let i = 0; i < emails.length; i += BATCH) {
        const batch = emails.slice(i, i + BATCH);
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-users`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ emails: batch }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Import failed");
        allResults.push(...(data.results || []));
      }

      setResults(allResults);
      setShowResults(true);

      const successCount = allResults.filter((r) => r.status === "success").length;
      const existsCount = allResults.filter((r) => r.status === "exists").length;
      const errorCount = allResults.filter((r) => r.status === "error").length;

      toast.success(`Import done: ${successCount} created, ${existsCount} existing, ${errorCount} errors`);
      if (successCount > 0) onImportComplete();
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setEmailText("");
    setResults([]);
    setShowResults(false);
    onOpenChange(false);
  };

  const emailCount = parseEmails(emailText).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-display">Import Users</DialogTitle>
        </DialogHeader>

        {!showResults ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[hsl(0,0%,50%)] mb-2">
                Paste emails below (one per line, comma or semicolon separated) or upload a CSV file.
              </p>
              <Textarea
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
                placeholder={"user1@example.com\nuser2@example.com\nuser3@example.com"}
                rows={8}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-[hsl(0,0%,50%)] mt-1">
                {emailCount} valid email{emailCount !== 1 ? "s" : ""} detected
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleCSVUpload}
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs rounded-lg"
              >
                <Upload size={14} className="mr-1.5" /> Upload CSV
              </Button>
              <span className="text-[11px] text-[hsl(0,0%,55%)]">or paste emails above</span>
            </div>

            <p className="text-[11px] text-[hsl(0,0%,55%)] bg-[hsl(0,0%,96%)] rounded-lg p-2.5">
              Users will be created with a random password. They can use "Forgot Password" to set their own password. No limit on number of emails.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 size={13} /> {results.filter(r => r.status === "success").length} created
              </span>
              <span className="flex items-center gap-1 text-[hsl(0,0%,50%)]">
                <FileText size={13} /> {results.filter(r => r.status === "exists").length} existing
              </span>
              <span className="flex items-center gap-1 text-red-500">
                <XCircle size={13} /> {results.filter(r => r.status === "error").length} errors
              </span>
            </div>
            <div className="max-h-60 overflow-auto border border-[hsl(0,0%,90%)] rounded-lg">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[hsl(0,0%,50%)] border-b border-[hsl(0,0%,92%)]">
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-[hsl(0,0%,95%)] last:border-0">
                      <td className="px-3 py-1.5 font-mono">{r.email}</td>
                      <td className="px-3 py-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          r.status === "success" ? "bg-green-50 text-green-700" :
                          r.status === "exists" ? "bg-gray-100 text-gray-600" :
                          "bg-red-50 text-red-600"
                        }`}>
                          {r.status === "success" ? "Created" : r.status === "exists" ? "Already exists" : r.message}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          {!showResults ? (
            <div className="flex gap-2 w-full justify-end">
              <Button variant="outline" size="sm" onClick={handleClose} className="text-xs rounded-lg">Cancel</Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={emailCount === 0 || importing}
                className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg text-xs"
              >
                {importing ? <><Loader2 size={14} className="mr-1.5 animate-spin" /> Importing...</> : `Import ${emailCount} User${emailCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleClose} className="text-xs rounded-lg">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportUsers;
