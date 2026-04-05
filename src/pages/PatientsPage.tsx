import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Plus, User, Users, Loader2, Pencil, Trash2, X, CheckCircle2, Camera, AlertTriangle, Activity } from "lucide-react";
import { LifeTimeline } from "@/components/LifeTimeline";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
    const { t } = useTranslation();
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
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
            <select
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-4 py-3.5 rounded-[1.25rem] bg-[#171f33] border border-white/5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold shadow-inner cursor-pointer"
            >
                {options.map(opt => <option key={opt} value={opt} className="bg-[#0b1326] text-white py-2">{opt}</option>)}
            </select>
        </div>
    );

    const renderTextarea = (label: string, key: keyof typeof form, placeholder?: string) => (
        <div key={key} className="col-span-full">
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
            <textarea
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={2}
                className="w-full px-4 py-3.5 rounded-[1.25rem] bg-[#171f33] border border-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold shadow-inner resize-none"
            />
        </div>
    );

    return (
        <div className="relative min-h-screen bg-[#0b1326] text-white">
            <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />
            <div className="max-w-3xl mx-auto px-6 py-8 pb-32 relative z-10 w-full animate-in fade-in duration-500 space-y-6">
            
            {toastMessage && <Toast message={toastMessage} />}

            <div className="flex items-center justify-between pt-6">
                <div>
                    <h1 className="text-3xl font-black font-lexend tracking-tighter">{t("nav.family")}</h1>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Manage Profiles</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center justify-center size-12 bg-emerald-500 text-[#0b1326] rounded-2xl font-black shadow-lg hover:bg-emerald-600 transition-colors active:scale-95"
                >
                    <Plus size={24} />
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
            ) : patients.length === 0 ? (
                <div className="bg-[#171f33] text-center py-20 rounded-[2.5rem] border border-white/5 shadow-inner content-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                        <Users size={28} className="text-slate-500" />
                    </div>
                    <h3 className="font-bold text-white mb-1">{t("patients.noProfiles")}</h3>
                    <p className="text-[11px] font-medium text-slate-400 max-w-[200px] mx-auto mb-6">
                        {t("patients.emptyDesc")}
                    </p>
                    <button onClick={openCreate} className="text-xs text-emerald-500 font-bold hover:underline bg-emerald-500/10 px-4 py-2 rounded-xl">
                        {t("patients.createFirst")}
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {patients.map(p => (
                        <div key={p.id}
                            onClick={() => navigate(`/documents?patientId=${p.id}`)}
                            className="bg-[#171f33] rounded-[1.5rem] p-4 flex items-center gap-4 cursor-pointer border border-white/5 hover:border-emerald-500/30 hover:shadow-2xl transition-all group active:scale-[0.98]">
                            <div className="w-14 h-14 rounded-[1rem] bg-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10 shadow-inner">
                                {p.photoURL ? (
                                    <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xl font-bold text-slate-400">
                                        {p.name?.[0]?.toUpperCase() ?? <User size={24} />}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-base truncate">{p.name}</p>
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mt-0.5 mb-2">
                                    {p.relationship}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400 font-medium">
                                    <span className="bg-slate-800 px-2 py-0.5 rounded-lg">{calcAge(p.dob)} {t("patients.yrs")}</span>
                                    {p.bloodGroup && <span className="bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-lg font-bold">{p.bloodGroup}</span>}
                                    {p.gender && <span className="bg-slate-800 px-2 py-0.5 rounded-lg">{p.gender}</span>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div
                                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                                    className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-emerald-500 hover:text-[#0b1326] transition-all shadow-sm"
                                    title="Edit Patient"
                                >
                                    <Pencil size={15} />
                                </div>
                                <div
                                    onClick={(e) => { e.stopPropagation(); setTimelinePatient(p); }}
                                    className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-emerald-500 hover:text-[#0b1326] transition-all shadow-sm"
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
                <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowModal(false)}>
                    <div
                        className="w-full max-w-2xl bg-[#0b1326] text-white rounded-t-[2.5rem] sm:rounded-[2.5rem] flex flex-col max-h-[92vh] sm:max-h-[85vh] shadow-[0_0_100px_rgba(16,185,129,0.1)] animate-in slide-in-from-bottom-5 duration-300 border border-emerald-500/20 relative overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header & Tabs Container */}
                        <div className="relative z-10 w-full border-b border-white/5 bg-[#171f33]/80 backdrop-blur-xl">
                            <div className="flex items-center justify-between p-6 pb-2">
                                <div>
                                    <h2 className="text-2xl font-black font-lexend tracking-tighter text-white">{editingId ? t("patients.editProfile") : t("patients.newProfile")}</h2>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Health Record</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="size-10 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
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
                                            "py-3 text-[13px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-b-[3px]",
                                            activeTab === tab ? "border-emerald-500 text-emerald-500" : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
                                        )}
                                    >
                                        {tab === "Misc" ? t("patients.tabs.misc") : tab === "Basic" ? t("patients.tabs.basic") : tab === "Contact" ? t("patients.tabs.contact") : t("patients.tabs.medical")}
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
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{t("patients.photo")}</p>
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                    <Trash2 size={18} /> {t("patients.delete")}
                                </button>
                            ) : <div></div>}
                            <button
                                type="submit"
                                form="patient-form"
                                disabled={saving}
                                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 active:scale-95 transition-all"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                {editingId ? t("patients.save") : t("patients.create")}
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
                        <h2 className="text-xl font-bold text-center mb-2">{t("patients.deleteTitle")}</h2>
                        <p className="text-sm text-center text-muted-foreground mb-6">
                            {t("patients.deleteDesc")}
                        </p>
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 text-center">{t("patients.typeDelete")}</label>
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
                                {t("patients.cancel")}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleteConfirmText !== "DELETE" || saving}
                                className="flex-1 py-3 bg-destructive text-destructive-foreground rounded-xl text-sm font-bold shadow-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : t("patients.delete")}
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
        </div>
    );
}
