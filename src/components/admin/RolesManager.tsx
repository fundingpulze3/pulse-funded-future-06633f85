import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface RolesManagerProps {
  profiles: any[];
  userRoles: Record<string, string>;
  onRoleChange: (userId: string, newRole: string) => Promise<void>;
}

const AVAILABLE_ROLES = ["admin", "employee", "moderator", "user"];
const HIDDEN_ROLES = ["administrator"];

const RolesManager = ({ profiles, userRoles, onRoleChange }: RolesManagerProps) => {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState("admin");
  const [assigning, setAssigning] = useState(false);

  const usersWithRoles = profiles.filter(p => userRoles[p.user_id] && userRoles[p.user_id] !== "user" && !HIDDEN_ROLES.includes(userRoles[p.user_id]));

  const handleAssignRole = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) { toast.error("Enter an email address"); return; }
    const profile = profiles.find(p => p.email?.toLowerCase() === trimmedEmail);
    if (!profile) { toast.error("No user found with that email"); return; }
    if (userRoles[profile.user_id] === selectedRole) { toast.info("User already has this role"); return; }
    setAssigning(true);
    await onRoleChange(profile.user_id, selectedRole);
    setEmail("");
    setAssigning(false);
  };

  const handleRemoveRole = async (userId: string) => {
    // Prevent removing administrator role
    if (userRoles[userId] === "administrator") {
      toast.error("Cannot modify the administrator role");
      return;
    }
    if (!confirm("Remove this user's role?")) return;
    await onRoleChange(userId, "none");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-display font-semibold text-[hsl(0,0%,5%)]">Role Management</h2>
        <p className="text-xs text-[hsl(0,0%,50%)] mt-0.5">Assign roles to users by their email address.</p>
      </div>
      <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-[hsl(0,0%,40%)]" />
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Assign Role</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input type="email" placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} className="flex-1 bg-[hsl(0,0%,97%)] border-[hsl(0,0%,88%)] rounded-lg" onKeyDown={e => e.key === "Enter" && handleAssignRole()} />
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="rounded-lg bg-[hsl(0,0%,97%)] border border-[hsl(0,0%,88%)] px-3 py-2 text-sm min-w-[140px]">
            {AVAILABLE_ROLES.map(r => (<option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>))}
          </select>
          <Button onClick={handleAssignRole} disabled={assigning || !email.trim()} className="bg-[hsl(0,0%,0%)] text-[hsl(0,0%,100%)] hover:bg-[hsl(0,0%,15%)] rounded-lg text-xs font-medium whitespace-nowrap">
            {assigning ? "Assigning..." : "Assign Role"}
          </Button>
        </div>
      </div>
      <div className="bg-[hsl(0,0%,100%)] rounded-xl border border-[hsl(0,0%,90%)] overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(0,0%,92%)] flex items-center gap-2">
          <ShieldCheck size={16} className="text-[hsl(0,0%,40%)]" />
          <h3 className="text-sm font-display font-semibold text-[hsl(0,0%,10%)]">Users with Roles</h3>
          <span className="ml-auto text-xs text-[hsl(0,0%,50%)]">{usersWithRoles.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[hsl(0,0%,97%)] text-[hsl(0,0%,45%)] text-[11px] uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Name</th>
              <th className="text-left px-5 py-3 font-medium">Email</th>
              <th className="text-left px-5 py-3 font-medium">Role</th>
              <th className="text-left px-5 py-3 font-medium">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-[hsl(0,0%,95%)]">
              {usersWithRoles.map(p => (
                <tr key={p.user_id} className="hover:bg-[hsl(0,0%,98%)] transition-colors">
                  <td className="px-5 py-3 font-medium text-[hsl(0,0%,10%)]">{p.display_name || "—"}</td>
                  <td className="px-5 py-3 text-[hsl(0,0%,45%)]">{p.email}</td>
                  <td className="px-5 py-3"><span className="text-xs px-2.5 py-1 rounded-full bg-[hsl(0,0%,92%)] text-[hsl(0,0%,20%)] font-medium capitalize">{userRoles[p.user_id]}</span></td>
                  <td className="px-5 py-3"><button onClick={() => handleRemoveRole(p.user_id)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button></td>
                </tr>
              ))}
              {usersWithRoles.length === 0 && (<tr><td colSpan={4} className="px-5 py-10 text-center text-[hsl(0,0%,60%)]">No roles assigned yet.</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RolesManager;