import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Plus, User, Users, Loader2, Pencil, Trash2, X, CheckCircle2, Camera, AlertTriangle, FileText, Activity } from "lucide-react";
import { LifeTimeline } from "@/components/LifeTimeline";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export interface LifeEvent {
    id: string;
    patientId: string;
    title: string;
    category: 'visit' | 'diagnosis' | 'procedure' | 'milestone' | 'note';
    date: string; // ISO format
    description?: string;
    documentIds: string[]; // Links to existing documents
    createdAt: any;
}

export interface Patient {
    id: string;
    userId?: string;
    photoURL?: string;
    // Basic Info
    name: string;
    gender: string;
    dob: string;
    maritalStatus: string;
    occupation: string;
    language: string;
    relationship: string;
    // Identification
    aadhaar: string;
    abha: string;
    // Measurements
    height: string;
    weight: string;
    // Contact
    phone: string;
    secondaryPhone: string;
    emergencyContact: string;
    address: string;
    city: string;
    state: string;
    pin: string;
    // Family
    fatherName: string;
    fatherPhone: string;
    fatherEmail: string;
    spouseName: string;
    spousePhone: string;
    spouseEmail: string;
    // Medical
    bloodGroup: string;
    allergies: string;
    conditions: string;
    medications: string;
    familyHistory: string;
    surgicalHistory: string;
    vaccinations: string;
    // Lifestyle & Insurance
    smoking: string;
    alcohol: string;
    tobacco: string;
    insuranceProvider: string;
    policyNumber: string;
}

const emptyForm: Omit<Patient, "id"> = {
    photoURL: "",
    name: "", gender: "Male", dob: "", maritalStatus: "Single", occupation: "", language: "English", relationship: "Self",
    aadhaar: "", abha: "",
    height: "", weight: "",
    phone: "", secondaryPhone: "", emergencyContact: "", address: "", city: "", state: "", pin: "",
    fatherName: "", fatherPhone: "", fatherEmail: "",
    spouseName: "", spousePhone: "", spouseEmail: "",
    bloodGroup: "", allergies: "", conditions: "", medications: "", familyHistory: "", surgicalHistory: "", vaccinations: "",
    smoking: "No", alcohol: "No", tobacco: "No",
    insuranceProvider: "", policyNumber: "",
};

function calcAge(dob: string): number | string {
    if (!dob) return "—";
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return "—";
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

function Toast({ message }: { message: string }) {
    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-2xl shadow-xl text-sm font-medium w-max max-w-[90vw] animate-in slide-in-from-top-5">
            <CheckCircle2 size={16} />
            {message}
        </div>
    );
}

export function PatientsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Omit<Patient, "id">>(emptyForm);
    const [saving, setSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"Basic" | "Contact" | "Medical" | "Misc">("Basic");

    // Photo state
    const [photoUploading, setPhotoUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Delete Modal
    const [deleteModal, setDeleteModal] = useState<string | null>(null); // holds the ID of patient to delete
    const [deleteConfirmText, setDeleteConfirmText] = useState("");

    // Timeline
    const [timelinePatient, setTimelinePatient] = useState<Patient | null>(null);

    const fetchPatients = async () => {
        if (!user) return;
        const q = query(collection(db, "patients"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        setPatients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Patient)));
    };

    useEffect(() => {
        if (!user) return;
        fetchPatients().finally(() => setLoading(false));
    }, [user]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const openCreate = () => {
        setForm(emptyForm);
        setEditingId(null);
        setActiveTab("Basic");
        setShowModal(true);
    };

    const openEdit = (p: Patient) => {
        setForm({
            photoURL: p.photoURL || "",
            name: p.name || "", gender: p.gender || "Male", dob: p.dob || "", maritalStatus: p.maritalStatus || "Single", occupation: p.occupation || "", language: p.language || "English", relationship: p.relationship || "Self",
            aadhaar: p.aadhaar || "", abha: p.abha || "",
            height: p.height || "", weight: p.weight || "",
            phone: p.phone || "", secondaryPhone: p.secondaryPhone || "", emergencyContact: p.emergencyContact || "", address: p.address || "", city: p.city || "", state: p.state || "", pin: p.pin || "",
            fatherName: p.fatherName || "", fatherPhone: p.fatherPhone || "", fatherEmail: p.fatherEmail || "",
            spouseName: p.spouseName || "", spousePhone: p.spousePhone || "", spouseEmail: p.spouseEmail || "",
            bloodGroup: p.bloodGroup || "", allergies: p.allergies || "", conditions: p.conditions || "", medications: p.medications || "", familyHistory: p.familyHistory || "", surgicalHistory: p.surgicalHistory || "", vaccinations: p.vaccinations || "",
            smoking: p.smoking || "No", alcohol: p.alcohol || "No", tobacco: p.tobacco || "No",
            insuranceProvider: p.insuranceProvider || "", policyNumber: p.policyNumber || "",
        });
        setEditingId(p.id);
        setActiveTab("Basic");
        setShowModal(true);
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;
        e.target.value = "";
        setPhotoUploading(true);
        try {
            const fileName = `patient_${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `documents/${user.uid}/patient-photos/${fileName}`);
            const task = uploadBytesResumable(storageRef, file);
            await task;
            const url = await getDownloadURL(task.snapshot.ref);
            setForm(prev => ({ ...prev, photoURL: url }));
        } catch (err) {
            console.error(err);
            alert("Failed to upload photo");
        } finally {
            setPhotoUploading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, "patients", editingId), { ...form });
                showToast("Patient updated successfully!");
            } else {
                await addDoc(collection(db, "patients"), { ...form, userId: user.uid, createdAt: serverTimestamp() });
                showToast("Patient added successfully!");
            }
            await fetchPatients();
            setShowModal(false);
        } catch (err) {
            console.error(err);
            alert("Failed to save patient. Please check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal || deleteConfirmText !== "DELETE") return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, "patients", deleteModal));
            showToast("Patient deleted successfully");
            await fetchPatients();
            setDeleteModal(null);
            setDeleteConfirmText("");
            if (editingId === deleteModal) setShowModal(false);
        } catch (err) {
            console.error(err);
            alert("Failed to delete patient. Ensure you have network connectivity.");
        } finally {
            setSaving(false);
        }
    };

    // Form builder helper
    const renderInput = (label: string, key: keyof typeof form, placeholder?: string, type: string = "text", required: boolean = false) => (
        <div key={key}>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">{label} {required && <span className="text-destructive">*</span>}</label>
            <input
                type={type}
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                required={required}
                className="w-full px-4 py-3.5 rounded-[1.25rem] border border-white/40 bg-white/40 backdrop-blur-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-sm"
            />
        </div>
    );

    const renderSelect = (label: string, key: keyof typeof form, options: string[]) => (
        <div key={key}>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">{label}</label>
            <select
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-4 py-3.5 rounded-[1.25rem] border border-white/40 bg-white/40 backdrop-blur-md text-slate-800 focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-sm cursor-pointer"
            >
                {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>
    );

    const renderTextarea = (label: string, key: keyof typeof form, placeholder?: string) => (
        <div key={key} className="col-span-full">
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">{label}</label>
            <textarea
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={2}
                className="w-full px-4 py-3.5 rounded-[1.25rem] border border-white/40 bg-white/40 backdrop-blur-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white/80 focus:ring-2 focus:ring-primary/20 transition-all font-semibold shadow-sm resize-none"
            />
        </div>
    );

    return (
        <div className="pb-6 w-full max-w-2xl mx-auto overflow-x-hidden space-y-6">
            <div className="fixed top-0 left-0 right-0 h-[50vh] soft-gradient-bg -z-10 pointer-events-none"></div>
            {toastMessage && <Toast message={toastMessage} />}

            <div className="flex items-center justify-between px-5 pt-6">
                <div>
                    <h1 className="text-xl font-bold">Patient Profiles</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage comprehensive health records</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium shadow-sm hover:bg-primary/90 transition-colors active:scale-95"
                >
                    <Plus size={16} /> Add Profile
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
            ) : patients.length === 0 ? (
                <div className="glass-card text-center py-16 rounded-[2rem] mx-5 border border-white/40 shadow-sm content-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users size={28} className="text-primary/70" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">No profiles yet</h3>
                    <p className="text-sm text-muted-foreground max-w-[200px] mx-auto mb-6">
                        Add yourself or family members to start tracking complete medical histories.
                    </p>
                    <button onClick={openCreate} className="text-sm text-primary font-medium hover:underline bg-primary/5 px-4 py-2 rounded-xl">
                        + Create First Profile
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-3 px-5">
                    {patients.map(p => (
                        <div key={p.id}
                            onClick={() => navigate(`/documents?patientId=${p.id}`)}
                            className="glass-card rounded-[1.5rem] p-4 flex items-center gap-4 cursor-pointer border border-white/40 hover:border-primary/40 hover:shadow-md transition-all group active:scale-[0.98]">
                            <div className="w-14 h-14 rounded-[1rem] bg-orange-50/70 flex items-center justify-center flex-shrink-0 overflow-hidden border border-orange-100 shadow-inner">
                                {p.photoURL ? (
                                    <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xl font-bold text-orange-600">
                                        {p.name?.[0]?.toUpperCase() ?? <User size={24} />}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-base truncate">{p.name}</p>
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5 mb-2">
                                    {p.relationship}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                    <span className="bg-secondary/70 border border-border/50 px-2 py-0.5 rounded-lg font-medium">{calcAge(p.dob)} yrs</span>
                                    {p.bloodGroup && <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-lg font-bold">{p.bloodGroup}</span>}
                                    {p.gender && <span className="bg-secondary/70 border border-border/50 px-2 py-0.5 rounded-lg font-medium">{p.gender}</span>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div
                                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                                    className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                    title="Edit Patient"
                                >
                                    <Pencil size={15} />
                                </div>
                                <div
                                    onClick={(e) => { e.stopPropagation(); navigate(`/documents?patientId=${p.id}`); }}
                                    className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    title="View Documents"
                                >
                                    <FileText size={15} />
                                </div>
                                <div
                                    onClick={(e) => { e.stopPropagation(); setTimelinePatient(p); }}
                                    className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                    title="Life Timeline"
                                >
                                    <Activity size={15} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowModal(false)}>
                    <div
                        className="w-full max-w-2xl glass-card rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col max-h-[92vh] sm:max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-300 border border-white/50 relative overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="absolute top-0 right-0 size-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                        <div className="absolute bottom-0 left-0 size-48 bg-primary/10 rounded-full blur-3xl pointer-events-none -z-10"></div>

                        {/* Header & Tabs Container */}
                        <div className="relative z-10 w-full border-b border-white/40 bg-white/40 backdrop-blur-xl">
                            <div className="flex items-center justify-between p-6 pb-2">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{editingId ? "Edit Patient Profile" : "New Patient Profile"}</h2>
                                    <p className="text-sm font-semibold text-slate-500 mt-1">Comprehensive health record</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="size-10 rounded-full bg-white/50 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm transition-all border border-white/60">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex px-6 overflow-x-auto hide-scrollbar scroll-smooth gap-6">
                                {(["Basic", "Contact", "Medical", "Misc"] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "py-3 text-[15px] font-bold whitespace-nowrap transition-all border-b-[3px]",
                                            activeTab === tab ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300"
                                        )}
                                    >
                                        {tab === "Misc" ? "Family & Lifestyle" : tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Form scrollable area */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <form id="patient-form" onSubmit={handleSave} className="space-y-6">

                                {/* BASIC INTERFACE */}
                                <div className={cn("space-y-6", activeTab !== "Basic" && "hidden")}>
                                    {/* Photo Upload */}
                                    <div className="flex flex-col items-center mb-2">
                                        <div className="relative group cursor-pointer mb-2" onClick={() => fileRef.current?.click()}>
                                            <div className="w-24 h-24 rounded-3xl bg-secondary border border-border overflow-hidden flex items-center justify-center shadow-inner">
                                                {form.photoURL ? (
                                                    <img src={form.photoURL} alt="Patient" className="w-full h-full object-cover" />
                                                ) : (
                                                    <User size={36} className="text-muted-foreground/50" />
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera size={24} className="text-white" />
                                                </div>
                                                {photoUploading && (
                                                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                                        <Loader2 size={24} className="animate-spin text-primary" />
                                                    </div>
                                                )}
                                            </div>
                                            <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handlePhotoChange} />
                                        </div>
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Profile Photo</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {renderInput("Full Name", "name", "e.g. Priya Sharma", "text", true)}
                                        {renderInput("Date of Birth", "dob", "", "date", true)}
                                        {renderSelect("Gender", "gender", ["Male", "Female", "Other"])}
                                        {renderSelect("Relationship", "relationship", ["Self", "Spouse", "Child", "Parent", "Sibling", "Other"])}
                                        {renderSelect("Marital Status", "maritalStatus", ["Single", "Married", "Divorced", "Widowed"])}
                                        {renderInput("Occupation", "occupation", "e.g. Teacher, Engineer")}
                                        {renderSelect("Preferred Language", "language", ["English", "Hindi", "Marathi", "Gujarati", "Tamil", "Telugu", "Bengali", "Other"])}
                                    </div>

                                    <div className="pt-2 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">Identification</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {renderInput("Aadhaar Number", "aadhaar", "12-digit Aadhaar")}
                                            {renderInput("ABHA Health ID", "abha", "e.g. 91-0000-0000-0000")}
                                        </div>
                                    </div>
                                </div>

                                {/* CONTACT & MEASUREMENTS */}
                                <div className={cn("space-y-6", activeTab !== "Contact" && "hidden")}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {renderInput("Phone Number", "phone", "Primary phone")}
                                        {renderInput("Secondary Phone", "secondaryPhone", "Alternate phone")}
                                        {renderInput("Emergency Contact", "emergencyContact", "Name & Phone")}
                                    </div>
                                    <div className="pt-2 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">Address</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="col-span-1 sm:col-span-2">
                                                {renderInput("House/Street Address", "address", "")}
                                            </div>
                                            {renderInput("City / District", "city", "e.g. Bhopal")}
                                            {renderInput("State", "state", "e.g. MP")}
                                            {renderInput("PIN Code", "pin", "6-digit PIN")}
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">Physical Measurements</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {renderInput("Height (cm)", "height", "e.g. 175")}
                                            {renderInput("Weight (kg)", "weight", "e.g. 70")}
                                        </div>
                                    </div>
                                </div>

                                {/* MEDICAL INFO */}
                                <div className={cn("space-y-6", activeTab !== "Medical" && "hidden")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {renderSelect("Blood Group", "bloodGroup", ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])}
                                        {renderInput("Allergies", "allergies", "e.g. Penicillin, Peanuts")}
                                        {renderTextarea("Chronic Conditions", "conditions", "e.g. Diabetes, Hypertension")}
                                        {renderTextarea("Current Medications", "medications", "e.g. Metformin 500mg, Amlodipine 5mg")}
                                        {renderTextarea("Medical History / Past Illnesses", "familyHistory", "Include family history if relevant (e.g. Father - Diabetes)")}
                                        {renderTextarea("Surgical History", "surgicalHistory", "e.g. Appendectomy 2018")}
                                        {renderTextarea("Vaccination Records", "vaccinations", "e.g. COVID-19 (Covaxin), Hep B")}
                                    </div>
                                </div>

                                {/* MISC / FAMILY / LIFESTYLE */}
                                <div className={cn("space-y-6", activeTab !== "Misc" && "hidden")}>
                                    <h3 className="text-sm font-bold">Lifestyle Habits</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {renderSelect("Smoking", "smoking", ["No", "Occasionally", "Regularly", "Former"])}
                                        {renderSelect("Alcohol", "alcohol", ["No", "Occasionally", "Regularly", "Former"])}
                                        {renderSelect("Tobacco/Pan", "tobacco", ["No", "Occasionally", "Regularly", "Former"])}
                                    </div>

                                    <div className="pt-4 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">Insurance Details</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {renderInput("Insurance Provider", "insuranceProvider", "e.g. Star Health")}
                                            {renderInput("Policy Number", "policyNumber", "Policy/Card number")}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">Family Members</h3>
                                        <div className="space-y-4">
                                            <div className="bg-secondary/30 p-4 rounded-2xl border border-border">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Father / Guardian</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {renderInput("Name", "fatherName", "Father's name")}
                                                    {renderInput("Phone", "fatherPhone", "Contact number")}
                                                </div>
                                            </div>
                                            <div className="bg-secondary/30 p-4 rounded-2xl border border-border">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Spouse (If applicable)</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {renderInput("Name", "spouseName", "Spouse's name")}
                                                    {renderInput("Phone", "spousePhone", "Contact number")}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Footer actions */}
                        <div className="p-4 border-t border-white/30 bg-primary/5 rounded-b-[2.5rem] flex items-center justify-between gap-3 relative z-10">
                            {editingId ? (
                                <button
                                    type="button"
                                    onClick={() => setDeleteModal(editingId)}
                                    className="py-3 px-4 bg-destructive/10 text-destructive rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-destructive/20 transition-colors"
                                >
                                    <Trash2 size={18} /> Delete
                                </button>
                            ) : <div></div>}
                            <button
                                type="submit"
                                form="patient-form"
                                disabled={saving}
                                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 active:scale-95 transition-all"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                {editingId ? "Save Changes" : "Create Profile"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-sm glass-card rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/50 relative overflow-hidden">
                        <div className="absolute top-0 right-0 size-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
                        <div className="w-16 h-16 bg-red-100/80 rounded-[1rem] border border-red-200 flex items-center justify-center mx-auto mb-5 shadow-sm">
                            <AlertTriangle size={28} className="text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold text-center mb-2">Delete Patient?</h2>
                        <p className="text-sm text-center text-muted-foreground mb-6">
                            This action cannot be undone. All medical records associated with this profile will be permanently lost.
                        </p>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 text-center">Type DELETE to confirm</label>
                            <input
                                type="text"
                                value={deleteConfirmText}
                                onChange={e => setDeleteConfirmText(e.target.value)}
                                placeholder="DELETE"
                                className="w-full px-4 py-3.5 rounded-[1.25rem] border border-red-200/50 bg-red-50/50 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-red-500/50 text-red-600 transition-all shadow-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteModal(null)}
                                className="flex-1 py-3 bg-secondary rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleteConfirmText !== "DELETE" || saving}
                                className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Life Timeline Modal */}
            {timelinePatient && (
                <LifeTimeline patient={timelinePatient} onClose={() => setTimelinePatient(null)} />
            )}
        </div>
    );
}
