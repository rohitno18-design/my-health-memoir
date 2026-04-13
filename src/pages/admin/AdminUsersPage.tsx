import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, ArrowLeft, Search, ShieldAlert, Key, MoreVertical, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserRecord {
    id: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    role: string;
    emailVerified: boolean;
    createdAt: any;
}

export function AdminUsersPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
            setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as UserRecord)));
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(u => 
        (u.displayName?.toLowerCase().includes(search.toLowerCase()) || "") ||
        (u.email?.toLowerCase().includes(search.toLowerCase()) || "")
    );

    const toggleRole = async (userId: string, currentRole: string) => {
        const newRole = currentRole === "admin" ? "patient" : "admin";
        if (!confirm(`Are you sure you want to make this user an ${newRole}?`)) return;
        
        setActionLoading(true);
        try {
            await updateDoc(doc(db, "users", userId), { role: newRole });
            await fetchUsers();
            setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
        } catch (error) {
            alert("Failed to update role");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && users.length === 0) {
        return (
            <div className="flex justify-center py-32">
                <Loader2 size={32} className="animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="py-6 space-y-6 pb-32 px-4 relative max-w-lg mx-auto w-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <button
                    onClick={() => navigate("/admin")}
                    className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:bg-muted transition-all shadow-sm"
                >
                    <ArrowLeft size={20} className="text-foreground" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold tracking-tight">User CRM</h1>
                    <p className="text-xs text-muted-foreground">{users.length} total accounts</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
            </div>

            {/* List */}
            <div className="space-y-3">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        No users found.
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <div 
                            key={user.id} 
                            onClick={() => setSelectedUser(user)}
                            className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/30 transition-all shadow-sm"
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${user.role === 'admin' ? 'bg-amber-100' : 'bg-primary/10'}`}>
                                <span className={`text-lg font-bold ${user.role === 'admin' ? 'text-amber-700' : 'text-primary'}`}>
                                    {(user.displayName ?? user.email ?? "U")[0].toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-foreground truncate">{user.displayName ?? "No Name"}</h3>
                                    {user.role === "admin" && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email ?? user.phoneNumber ?? "No contact info"}</p>
                            </div>
                            <MoreVertical size={18} className="text-muted-foreground" />
                        </div>
                    ))
                )}
            </div>

            {/* User Detail Slide-Up / Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
                    <div className="bg-background w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 relative z-10 shadow-2xl animate-in slide-in-from-bottom-5">
                        <button 
                            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted"
                            onClick={() => setSelectedUser(null)}
                        >
                            <X size={18} />
                        </button>
                        
                        <div className="flex items-center gap-4 mb-6">
                             <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-2xl font-bold text-primary">
                                    {(selectedUser.displayName ?? selectedUser.email ?? "U")[0].toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{selectedUser.displayName ?? "Unnamed Patient"}</h2>
                                <p className="text-sm text-muted-foreground">ID: {selectedUser.id}</p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="bg-muted/30 p-3 rounded-xl">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Email</p>
                                <p className="font-medium text-sm">{selectedUser.email || "Not set"} {selectedUser.emailVerified && <span className="text-emerald-600 text-xs ml-2">✓ Verified</span>}</p>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-xl">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Phone</p>
                                <p className="font-medium text-sm">{selectedUser.phoneNumber || "Not set"}</p>
                            </div>
                            <div className="bg-muted/30 p-3 rounded-xl flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Account Role</p>
                                    <p className="font-medium text-sm capitalize">{selectedUser.role}</p>
                                </div>
                                <button
                                    onClick={() => toggleRole(selectedUser.id, selectedUser.role)}
                                    disabled={actionLoading}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                                        selectedUser.role === 'admin' 
                                            ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    }`}
                                >
                                    {actionLoading ? "Updating..." : selectedUser.role === 'admin' ? "Revoke Admin" : "Make Admin"}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button className="flex items-center justify-center gap-2 w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-semibold text-sm hover:bg-secondary/80">
                                <Key size={16} /> Magic Link
                            </button>
                            <button className="flex items-center justify-center gap-2 w-full py-3 bg-red-50 text-red-600 rounded-xl font-semibold text-sm hover:bg-red-100">
                                <ShieldAlert size={16} /> Suspend
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

