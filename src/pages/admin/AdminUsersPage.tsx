import { useState, useEffect } from "react";
import { collection, getDocs, getDoc, setDoc, query, orderBy, doc, updateDoc, deleteDoc, getCountFromServer, where } from "firebase/firestore";
import { createUserWithEmailAndPassword, sendSignInLinkToEmail } from "firebase/auth";
import { auth, adminAuth, db } from "@/lib/firebase";
import { Loader2, ArrowLeft, Search, ShieldAlert, Key, X, CheckSquare, Square, Trash2, Plus, Activity, FileText, Users, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserRecord {
    id: string;
    displayName: string | null;
    email: string | null;
    phoneNumber: string | null;
    role: string;
    emailVerified: boolean;
    suspended?: boolean;
    createdAt: any;
}

export function AdminUsersPage() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    
    // New States
    const [activeTab, setActiveTab] = useState<"all" | "admins" | "suspended">("all");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUserForm, setNewUserForm] = useState({ email: "", password: "", name: "" });

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

    // Telemetry & Audit States
    const [userModalTab, setUserModalTab] = useState<"overview" | "activity">("overview");
    const [userMetrics, setUserMetrics] = useState({ patients: 0, documents: 0, aiChats: 0 });
    const [userActivity, setUserActivity] = useState<any[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // Fetch Counters
    useEffect(() => {
        if (selectedUser) {
            setUserModalTab("overview");
            Promise.all([
                getCountFromServer(query(collection(db, "patients"), where("userId", "==", selectedUser.id))),
                getCountFromServer(query(collection(db, "documents"), where("userId", "==", selectedUser.id))),
                getCountFromServer(query(collection(db, "audit_logs"), where("userId", "==", selectedUser.id), where("action", "==", "AI_CHAT_STARTED")))
            ]).then(([pSnap, dSnap, aSnap]) => {
                setUserMetrics({
                    patients: pSnap.data().count,
                    documents: dSnap.data().count,
                    aiChats: aSnap.data().count
                });
            }).catch(e => console.error("Error fetching metrics:", e));
        }
    }, [selectedUser]);

    // Fetch Activity Logs
    useEffect(() => {
        if (selectedUser && userModalTab === "activity") {
            setLoadingActivity(true);
            getDocs(query(collection(db, "audit_logs"), where("userId", "==", selectedUser.id), orderBy("timestamp", "desc")))
                .then(snap => {
                    setUserActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                })
                .catch(e => console.error("Error fetching activity:", e))
                .finally(() => setLoadingActivity(false));
        }
    }, [selectedUser, userModalTab]);

    // Derived Data
    const filteredUsers = users.filter(u => {
        const matchesSearch = (u.displayName?.toLowerCase().includes(search.toLowerCase()) || "") ||
                              (u.email?.toLowerCase().includes(search.toLowerCase()) || "");
        if (!matchesSearch) return false;
        
        if (activeTab === "admins") return u.role === "admin";
        if (activeTab === "suspended") return u.suspended === true;
        return u.suspended !== true; // "all" tab hides suspended users by default
    });

    const toggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredUsers.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredUsers.map(u => u.id)));
        }
    };

    // Actions
    const toggleRole = async (userId: string, currentRole: string) => {
        const newRole = currentRole === "admin" ? "patient" : "admin";
        if (!confirm(`Are you sure you want to make this user an ${newRole}?`)) return;
        
        setActionLoading(true);
        try {
            await updateDoc(doc(db, "users", userId), { role: newRole });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
        } catch (error) {
            alert("Failed to update role");
        } finally {
            setActionLoading(false);
        }
    };

    const handleBulkSuspend = async (suspend: boolean) => {
        if (!confirm(`Are you sure you want to ${suspend ? 'suspend' : 'restore'} ${selectedIds.size} users?`)) return;
        setActionLoading(true);
        try {
            const promises = Array.from(selectedIds).map(id => updateDoc(doc(db, "users", id), { suspended: suspend }));
            await Promise.all(promises);
            await fetchUsers();
            setSelectedIds(new Set());
        } catch (e) {
            alert("Bulk action failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handlePermanentDelete = async () => {
        if (!confirm(`DANGER: Are you sure you want to PERMANENTLY destroy ${selectedIds.size} accounts and their medical data?`)) return;
        setActionLoading(true);
        try {
            // Note: In a true prod app, we'd delete `documents` subcollections here too
            const promises = Array.from(selectedIds).map(id => deleteDoc(doc(db, "users", id)));
            await Promise.all(promises);
            await fetchUsers();
            setSelectedIds(new Set());
        } catch (e) {
            alert("Deletion failed.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleSendMagicLink = async (email: string | null) => {
        if (!email) return alert("User has no email");
        try {
            setActionLoading(true);
            await sendSignInLinkToEmail(auth, email, {
                url: window.location.origin + '/login',
                handleCodeInApp: true,
            });
            alert(`Magic link sent to ${email}`);
        } catch (e: any) {
            alert("Failed: " + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateSilentUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading(true);
        try {
            // Check for duplicate email first
            const existingLookup = await getDoc(doc(db, "user_lookup", "email_" + btoa(newUserForm.email)));
            if (existingLookup.exists()) {
                alert("A user with this email already exists. Duplicate email not allowed.");
                setActionLoading(false);
                return;
            }

            // Use admin instance so primary session isn't killed
            const { user } = await createUserWithEmailAndPassword(adminAuth, newUserForm.email, newUserForm.password);
            
            // Create their database record manually
            await updateDoc(doc(db, "users", user.uid), {
                email: newUserForm.email,
                displayName: newUserForm.name,
                role: "patient",
                createdAt: new Date()
            });

            // Create lookup entry for uniqueness enforcement
            await setDoc(doc(db, "user_lookup", "email_" + btoa(newUserForm.email)), { uid: user.uid, email: newUserForm.email });
            
            // Log out the secondary instance to maintain clean state
            await adminAuth.signOut();

            setShowCreateModal(false);
            setNewUserForm({ email: "", password: "", name: "" });
            await fetchUsers();
            alert("User created successfully");
        } catch (err: any) {
             alert(err.message);
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
                <div className="flex-1 min-w-0 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">User CRM</h1>
                        <p className="text-xs text-muted-foreground">{users.length} total accounts</p>
                    </div>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow hover:opacity-90 transition-opacity"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>

            {/* Search & Tabs */}
            <div className="space-y-4">
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
                
                <div className="flex gap-2 border-b border-border pb-2">
                    {[
                        { id: "all", label: "Active" },
                        { id: "admins", label: "Admins" },
                        { id: "suspended", label: "Suspended" }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as any); setSelectedIds(new Set()); }}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                activeTab === tab.id 
                                ? "bg-foreground text-background" 
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="bg-primary text-primary-foreground rounded-xl p-3 flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-sm font-bold ml-2">{selectedIds.size} Selected</span>
                    <div className="flex gap-2">
                        {activeTab === "suspended" ? (
                            <>
                                <button onClick={() => handleBulkSuspend(false)} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                                    Restore
                                </button>
                                <button onClick={handlePermanentDelete} className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1">
                                    <Trash2 size={14} /> Destroy
                                </button>
                            </>
                        ) : (
                            <button onClick={() => handleBulkSuspend(true)} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1">
                                <ShieldAlert size={14} /> Suspend
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* List */}
            <div className="space-y-3">
                {filteredUsers.length > 0 && (
                    <div className="flex items-center gap-2 px-2 pb-1" onClick={toggleSelectAll}>
                        {selectedIds.size === filteredUsers.length ? (
                            <CheckSquare size={18} className="text-primary cursor-pointer" />
                        ) : (
                             <Square size={18} className="text-muted-foreground cursor-pointer" />
                        )}
                        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider cursor-pointer">Select All</span>
                    </div>
                )}
                
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        No users found in this view.
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <div 
                            key={user.id} 
                            onClick={() => setSelectedUser(user)}
                            className={`bg-card border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/30 transition-all shadow-sm ${
                                selectedIds.has(user.id) ? 'border-primary ring-1 ring-primary' : 'border-border/50'
                            }`}
                        >
                            <div onClick={(e) => toggleSelect(user.id, e)} className="p-1">
                                {selectedIds.has(user.id) ? (
                                    <CheckSquare size={20} className="text-primary" />
                                ) : (
                                    <Square size={20} className="text-muted-foreground" />
                                )}
                            </div>
                            
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${user.suspended ? 'bg-red-100' : user.role === 'admin' ? 'bg-amber-100' : 'bg-primary/10'}`}>
                                <span className={`text-sm font-bold ${user.suspended ? 'text-red-700' : user.role === 'admin' ? 'text-amber-700' : 'text-primary'}`}>
                                    {(user.displayName?.trim() || user.email?.trim() || "U").charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className={`font-semibold truncate ${user.suspended ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{user.displayName ?? "No Name"}</h3>
                                    {user.role === "admin" && !user.suspended && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                                            Admin
                                        </span>
                                    )}
                                    {user.suspended && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wider">
                                            Suspended
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email ?? user.phoneNumber ?? "No contact info"}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                     <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
                     <div className="bg-background w-full max-w-sm rounded-3xl p-6 relative z-10 shadow-2xl">
                         <h2 className="text-xl font-bold mb-4">Create Patient Account</h2>
                         <form onSubmit={handleCreateSilentUser} className="space-y-4">
                             <div>
                                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                                 <input required type="text" value={newUserForm.name} onChange={e => setNewUserForm(f => ({...f, name: e.target.value}))} className="w-full mt-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Rahul Sharma" />
                             </div>
                             <div>
                                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                                 <input required type="email" value={newUserForm.email} onChange={e => setNewUserForm(f => ({...f, email: e.target.value}))} className="w-full mt-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="rahul@example.com" />
                             </div>
                             <div>
                                 <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Temp Password</label>
                                 <input required type="text" value={newUserForm.password} onChange={e => setNewUserForm(f => ({...f, password: e.target.value}))} className="w-full mt-1 px-3 py-2 bg-muted rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="Set a temporary password" />
                             </div>
                             <div className="flex gap-3 mt-6">
                                 <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl font-bold bg-secondary text-secondary-foreground">Cancel</button>
                                 <button type="submit" disabled={actionLoading} className="flex-1 py-3 rounded-xl font-bold bg-primary text-primary-foreground">{actionLoading ? "Saving..." : "Create App"}</button>
                             </div>
                         </form>
                     </div>
                </div>
            )}

            {/* User Detail Slide-Up */}
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
                             <div className={`w-16 h-16 rounded-full flex items-center justify-center ${selectedUser.suspended ? 'bg-red-100' : 'bg-primary/10'}`}>
                                <span className={`text-2xl font-bold ${selectedUser.suspended ? 'text-red-700' : 'text-primary'}`}>
                                    {(selectedUser.displayName?.trim() || selectedUser.email?.trim() || "U").charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">{selectedUser.displayName ?? "Unnamed Patient"}</h2>
                                <p className="text-sm text-muted-foreground truncate w-48">ID: {selectedUser.id}</p>
                            </div>
                        </div>

                        <div className="flex gap-2 border-b border-border pb-2 mb-6">
                            <button
                                onClick={() => setUserModalTab("overview")}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${userModalTab === "overview" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setUserModalTab("activity")}
                                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${userModalTab === "activity" ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                            >
                                Activity Feed
                            </button>
                        </div>

                        {userModalTab === "overview" ? (
                            <>
                                {/* Telemetry Stats */}
                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    <div className="bg-primary/5 p-3 rounded-2xl flex flex-col items-center justify-center border border-primary/10">
                                        <Users size={18} className="text-primary mb-1" />
                                        <span className="text-xl font-extrabold text-foreground">{userMetrics.patients}</span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Patients</span>
                                    </div>
                                    <div className="bg-emerald-500/5 p-3 rounded-2xl flex flex-col items-center justify-center border border-emerald-500/10">
                                        <FileText size={18} className="text-emerald-600 mb-1" />
                                        <span className="text-xl font-extrabold text-foreground">{userMetrics.documents}</span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Docs</span>
                                    </div>
                                    <div className="bg-violet-500/5 p-3 rounded-2xl flex flex-col items-center justify-center border border-violet-500/10">
                                        <MessageSquare size={18} className="text-violet-600 mb-1" />
                                        <span className="text-xl font-extrabold text-foreground">{userMetrics.aiChats}</span>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI Prompts</span>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Email</p>
                                        <p className="font-medium text-sm">{selectedUser.email || "Not set"} {selectedUser.emailVerified && <span className="text-emerald-600 text-[10px] ml-2 font-bold uppercase tracking-wider">Verified</span>}</p>
                                    </div>
                                    
                                    <div className="bg-muted/30 p-3 rounded-xl border border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Account Role</p>
                                            <p className="font-medium text-sm capitalize">{selectedUser.role}</p>
                                        </div>
                                        {!selectedUser.suspended && (
                                            <button
                                                onClick={() => toggleRole(selectedUser.id, selectedUser.role)}
                                                disabled={actionLoading}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                                                    selectedUser.role === 'admin' 
                                                        ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                }`}
                                            >
                                                {actionLoading ? "Updating..." : selectedUser.role === 'admin' ? "Revoke Admin" : "Make Admin"}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => handleSendMagicLink(selectedUser.email)}
                                        disabled={actionLoading || selectedUser.suspended}
                                        className="flex items-center justify-center gap-2 w-full py-3 bg-secondary text-secondary-foreground rounded-xl font-semibold text-sm hover:bg-secondary/80 disabled:opacity-50"
                                    >
                                        <Key size={16} /> Magic Link
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            const suspend = !selectedUser.suspended;
                                            if (!confirm(`Are you sure you want to ${suspend ? 'suspend' : 'restore'} this user?`)) return;
                                            setActionLoading(true);
                                            try {
                                                await updateDoc(doc(db, "users", selectedUser.id), { suspended: suspend });
                                                setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, suspended: suspend } : u));
                                                setSelectedUser(null);
                                            } catch (e) {
                                                alert("Action failed.");
                                            } finally {
                                                setActionLoading(false);
                                            }
                                        }}
                                        disabled={actionLoading}
                                        className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 ${
                                            selectedUser.suspended 
                                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                                        }`}
                                    >
                                        <ShieldAlert size={16} /> {selectedUser.suspended ? 'Restore Account' : 'Suspend Account'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                {loadingActivity ? (
                                    <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
                                ) : userActivity.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground text-sm">No activity recorded yet.</div>
                                ) : (
                                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px before:h-full before:w-0.5 before:bg-border">
                                        {userActivity.map((log: any) => (
                                            <div key={log.id} className="relative flex items-start gap-4">
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-muted-foreground shadow-sm shrink-0 z-10">
                                                    <Activity size={14} />
                                                </div>
                                                <div className="flex-1 bg-muted/30 p-3.5 rounded-2xl border border-border/50">
                                                    <div className="font-bold text-foreground text-sm tracking-tight">{log.action.replace(/_/g, " ")}</div>
                                                    <div className="text-muted-foreground text-xs mt-0.5">{log.details}</div>
                                                    <div className="text-primary/70 text-[10px] uppercase font-bold tracking-wider mt-2">
                                                        {log.timestamp ? new Date(log.timestamp.toDate()).toLocaleString() : "Just now"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

