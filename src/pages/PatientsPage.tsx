import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { logUserAction } from "@/lib/audit";
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, deleteDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Plus, User, Users, Loader2, Pencil, Trash2, X, CheckCircle2, Camera, AlertTriangle, FileText, Activity } from "lucide-react";
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
    // Emergency / SOS
    organDonor: string;
    ice1Name: string;
    ice1Phone: string;
    ice2Name: string;
    ice2Phone: string;
    ice3Name: string;
    ice3Phone: string;
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
    organDonor: "No",
    ice1Name: "", ice1Phone: "",
    ice2Name: "", ice2Phone: "",
    ice3Name: "", ice3Phone: "",
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
    const [activeTab, setActiveTab] = useState<"Basic" | "Contact" | "Medical" | "SOS" | "Misc">("Basic");

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
            organDonor: p.organDonor || "No",
            ice1Name: p.ice1Name || "", ice1Phone: p.ice1Phone || "",
            ice2Name: p.ice2Name || "", ice2Phone: p.ice2Phone || "",
            ice3Name: p.ice3Name || "", ice3Phone: p.ice3Phone || "",
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
        let patientIdToUse = editingId;
        try {
            // Step 1: Save patient profile
            if (editingId) {
                await updateDoc(doc(db, "patients", editingId), { ...form, userId: user.uid });
                patientIdToUse = editingId;
                await logUserAction(user.uid, "PROFILE_UPDATED", `Updated patient profile: ${form.name}`, { patientId: editingId });
            } else {
                const newDoc = await addDoc(collection(db, "patients"), {
                    ...form,
                    userId: user.uid,
                    createdAt: serverTimestamp()
                });
                patientIdToUse = newDoc.id;
                await logUserAction(user.uid, "PATIENT_ADDED", `Added new patient: ${form.name}`, { patientId: newDoc.id });
            }
        } catch (err: any) {
            console.error("Patient save error:", err);
            alert(`Failed to save patient profile: ${err?.message || "Permission denied. Please try logging out and back in."}`);
            setSaving(false);
            return;
        }

        // Step 2: Sync emergency info (non-blocking — if this fails, patient is still saved)
        try {
            if (patientIdToUse) {
                // Build ICE contacts from 3 separate fields
                const iceContacts = [
                    { name: form.ice1Name, phone: form.ice1Phone, relation: "Emergency Contact 1" },
                    { name: form.ice2Name, phone: form.ice2Phone, relation: "Emergency Contact 2" },
                    { name: form.ice3Name, phone: form.ice3Phone, relation: "Emergency Contact 3" },
                ].filter(c => c.name.trim() !== "");

                await setDoc(doc(db, "emergency_info", patientIdToUse), {
                    patientName: form.name || "Patient",
                    photoURL: form.photoURL || "",
                    gender: form.gender || "",
                    dob: form.dob || "",
                    bloodType: form.bloodGroup || "",
                    organDonor: form.organDonor === "Yes",
                    allergies: form.allergies ? form.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
                    conditions: form.conditions ? form.conditions.split(",").map(s => s.trim()).filter(Boolean) : [],
                    medications: form.medications ? form.medications.split(",").map(s => s.trim()).filter(Boolean) : [],
                    iceContacts,
                    notifiedOnSOS: true,
                    userId: user.uid,
                    lastUpdated: serverTimestamp(),
                }, { merge: true });
            }
        } catch (err: any) {
            // Emergency sync failed but patient was saved — warn but don't block
            console.warn("Emergency info sync failed (patient was still saved):", err);
        }

        await fetchPatients();
        setShowModal(false);
        showToast(editingId ? t("patients.msgUpdated") : t("patients.msgAdded"));
        setSaving(false);
    };

    const confirmDelete = async () => {
        if (!deleteModal || deleteConfirmText !== "DELETE") return;
        setSaving(true);
        try {
            await deleteDoc(doc(db, "patients", deleteModal));
            showToast(t("patients.deleteSuccess"));
            await fetchPatients();
            setDeleteModal(null);
            setDeleteConfirmText("");
            if (editingId === deleteModal) setShowModal(false);
        } catch (err) {
            console.error(err);
            alert(t("patients.deleteError"));
        } finally {
            setSaving(false);
        }
    };

    // Form builder helper
    const renderInput = (label: string, key: keyof typeof form, placeholder?: string, type: string = "text", required: boolean = false) => (
        <div key={key}>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{label} {required && <span className="text-rose-500">*</span>}</label>
            <input
                type={type}
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                required={required}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all font-medium text-sm"
            />
        </div>
    );

    const renderSelect = (label: string, key: keyof typeof form, options: { label: string, value: string }[]) => (
        <div key={key}>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{label}</label>
            <select
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all font-medium text-sm cursor-pointer"
            >
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        </div>
    );

    const renderTextarea = (label: string, key: keyof typeof form, placeholder?: string) => (
        <div key={key} className="col-span-full">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">{label}</label>
            <textarea
                value={form[key]}
                onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all font-medium text-sm resize-none"
            />
        </div>
    );

    return (
        <div className="pb-6 w-full max-w-lg mx-auto overflow-x-hidden space-y-6 px-5 pt-5">
            {toastMessage && <Toast message={toastMessage} />}

            <div className="flex items-center justify-between pt-6">
                <div>
                    <h1 className="text-xl font-bold">{t("patients.title")}</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("patients.subtitle")}</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium shadow-sm hover:bg-primary/90 transition-colors active:scale-95"
                >
                    <Plus size={16} /> {t("patients.add")}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
            ) : patients.length === 0 ? (
                <div className="glass-card text-center py-16 rounded-[2rem] mx-5 border border-white/40 shadow-sm content-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Users size={28} className="text-primary/70" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{t("patients.noProfiles")}</h3>
                    <p className="text-sm text-muted-foreground max-w-[200px] mx-auto mb-6">
                        {t("patients.emptyDesc")}
                    </p>
                    <button onClick={openCreate} className="text-sm text-primary font-medium hover:underline bg-primary/5 px-4 py-2 rounded-xl">
                        {t("patients.createFirst")}
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
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
                                    <span className="bg-secondary/70 border border-border/50 px-2 py-0.5 rounded-lg font-medium">{calcAge(p.dob)} {t("patients.yrs")}</span>
                                    {p.bloodGroup && <span className="bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-lg font-bold">{p.bloodGroup}</span>}
                                    {p.gender && <span className="bg-secondary/70 border border-border/50 px-2 py-0.5 rounded-lg font-medium">{p.gender}</span>}
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div
                                    onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                                    className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all shadow-sm"
                                    title={t("common.edit")}
                                >
                                    <Pencil size={15} />
                                </div>
                                <div
                                    onClick={(e) => { e.stopPropagation(); navigate(`/documents?patientId=${p.id}`); }}
                                    className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                    title={t("account.myDocs")}
                                >
                                    <FileText size={15} />
                                </div>
                                <div
                                    onClick={(e) => { e.stopPropagation(); setTimelinePatient(p); }}
                                    className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                    title={t("patients.lifeTimeline")}
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
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowModal(false)}>
                    <div
                        className="w-full max-w-2xl bg-white rounded-t-[2rem] sm:rounded-[2rem] flex flex-col max-h-[92vh] sm:max-h-[85vh] shadow-2xl animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-300 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >

                        {/* Header & Tabs Container */}
                        <div className="w-full border-b border-slate-100 bg-white">
                            <div className="flex items-center justify-between px-5 pt-5 pb-3">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">{editingId ? t("patients.editProfile") : t("patients.newProfile")}</h2>
                                    <p className="text-xs font-medium text-slate-400 mt-0.5">{t("patients.formRecord")}</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-all active:scale-95">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex px-5 overflow-x-auto no-scrollbar gap-1">
                                {(["Basic", "Contact", "Medical", "SOS", "Misc"] as const).map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "py-3 px-3 text-sm font-bold whitespace-nowrap transition-all border-b-2",
                                            activeTab === tab ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-400 hover:text-slate-700"
                                        )}
                                    >
                                        {tab === "Misc" ? t("patients.tabMisc") : tab === "SOS" ? "🆘 " + t("patients.tabSOS") : tab === "Basic" ? t("patients.tabBasic") : tab === "Contact" ? t("patients.tabContact") : t("patients.tabMedical")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Form scrollable area */}
                        <div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50 custom-scrollbar">
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
                                        {renderInput(t("account.fullName"), "name", "e.g. Priya Sharma", "text", true)}
                                        {renderInput(t("account.dob"), "dob", "", "date", true)}
                                        {renderSelect(t("account.gender"), "gender", [
                                            { label: t("patients.genMale"), value: "Male" },
                                            { label: t("patients.genFemale"), value: "Female" },
                                            { label: t("patients.genOther"), value: "Other" }
                                        ])}
                                        {renderSelect(t("patients.relationship"), "relationship", [
                                            { label: t("patients.relSelf"), value: "Self" },
                                            { label: t("patients.relSpouse"), value: "Spouse" },
                                            { label: t("patients.relChild"), value: "Child" },
                                            { label: t("patients.relParent"), value: "Parent" },
                                            { label: t("patients.relSibling"), value: "Sibling" },
                                            { label: t("patients.relOther"), value: "Other" }
                                        ])}
                                        {renderSelect(t("patients.maritalStatus"), "maritalStatus", [
                                            { label: t("patients.msSingle"), value: "Single" },
                                            { label: t("patients.msMarried"), value: "Married" },
                                            { label: t("patients.msDivorced"), value: "Divorced" },
                                            { label: t("patients.msWidowed"), value: "Widowed" }
                                        ])}
                                        {renderInput(t("patients.occupation"), "occupation", "e.g. Teacher, Engineer")}
                                        {renderSelect(t("patients.prefLang"), "language", [
                                            { label: "English", value: "English" },
                                            { label: "Hindi", value: "Hindi" },
                                            { label: "Marathi", value: "Marathi" },
                                            { label: "Gujarati", value: "Gujarati" },
                                            { label: "Tamil", value: "Tamil" },
                                            { label: "Telugu", value: "Telugu" },
                                            { label: "Bengali", value: "Bengali" },
                                            { label: t("common.other"), value: "Other" }
                                        ])}
                                    </div>

                                    <div className="pt-2 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">{t("patients.identification")}</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {renderInput(t("patients.aadhaar"), "aadhaar", "12-digit Aadhaar")}
                                            {renderInput(t("patients.abha"), "abha", "e.g. 91-0000-0000-0000")}
                                        </div>
                                    </div>
                                </div>

                                {/* CONTACT & MEASUREMENTS */}
                                <div className={cn("space-y-6", activeTab !== "Contact" && "hidden")}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {renderInput(t("account.phoneNum"), "phone", "Primary phone")}
                                        {renderInput(t("patients.secondaryPhone"), "secondaryPhone", "Alternate phone")}
                                        {renderInput(t("patients.emergencyContact"), "emergencyContact", "Name & Phone")}
                                    </div>
                                    <div className="pt-2 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">{t("patients.address")}</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="col-span-1 sm:col-span-2">
                                                {renderInput(t("patients.streetAddr"), "address", "")}
                                            </div>
                                            {renderInput(t("patients.city"), "city", "e.g. Bhopal")}
                                            {renderInput(t("patients.state"), "state", "e.g. MP")}
                                            {renderInput(t("patients.pin"), "pin", "6-digit PIN")}
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">{t("patients.physical")}</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {renderInput(t("patients.height"), "height", "e.g. 175")}
                                            {renderInput(t("patients.weight"), "weight", "e.g. 70")}
                                        </div>
                                    </div>
                                </div>

                                {/* MEDICAL INFO */}
                                <div className={cn("space-y-6", activeTab !== "Medical" && "hidden")}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {renderSelect(t("account.bloodGroup"), "bloodGroup", [
                                            { label: t("common.notSpecified"), value: "" },
                                            { label: "A+", value: "A+" },
                                            { label: "A-", value: "A-" },
                                            { label: "B+", value: "B+" },
                                            { label: "B-", value: "B-" },
                                            { label: "AB+", value: "AB+" },
                                            { label: "AB-", value: "AB-" },
                                            { label: "O+", value: "O+" },
                                            { label: "O-", value: "O-" }
                                        ])}
                                        {renderInput(t("emergency.allergies"), "allergies", "e.g. Penicillin, Peanuts")}
                                        {renderTextarea(t("emergency.conditions"), "conditions", "e.g. Diabetes, Hypertension")}
                                        {renderTextarea(t("emergency.medications"), "medications", "e.g. Metformin 500mg, Amlodipine 5mg")}
                                        {renderTextarea(t("patients.medHistory"), "familyHistory", "Include family history if relevant (e.g. Father - Diabetes)")}
                                        {renderTextarea(t("patients.surgicalHistory"), "surgicalHistory", "e.g. Appendectomy 2018")}
                                        {renderTextarea(t("patients.vaccination"), "vaccinations", "e.g. COVID-19 (Covaxin), Hep B")}
                                    </div>
                                </div>

                                {/* EMERGENCY / SOS */}
                                <div className={cn("space-y-5", activeTab !== "SOS" && "hidden")}>
                                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3">
                                        <span className="text-rose-500 text-lg">🆘</span>
                                        <p className="text-xs text-rose-600 font-medium leading-relaxed">
                                            {t("patients.emergencyNotice")}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {renderSelect(t("account.bloodGroup"), "bloodGroup", [
                                            { label: t("common.notSpecified"), value: "" },
                                            { label: "A+", value: "A+" },
                                            { label: "A-", value: "A-" },
                                            { label: "B+", value: "B+" },
                                            { label: "B-", value: "B-" },
                                            { label: "AB+", value: "AB+" },
                                            { label: "AB-", value: "AB-" },
                                            { label: "O+", value: "O+" },
                                            { label: "O-", value: "O-" }
                                        ])}
                                        {renderSelect(t("emergency.organDonor"), "organDonor", [
                                            { label: t("patients.no"), value: "No" },
                                            { label: t("patients.yes"), value: "Yes" }
                                        ])}
                                    </div>
                                    <div className="space-y-4">
                                        {renderInput(t("emergency.allergies"), "allergies", "e.g. Penicillin, Peanuts (comma separated)")}
                                        {renderTextarea(t("emergency.conditions"), "conditions", "e.g. Diabetes Type 2, Hypertension")}
                                        {renderTextarea(t("emergency.medications"), "medications", "e.g. Metformin 500mg, Amlodipine 5mg")}
                                    </div>

                                    {/* ICE Contacts — 3 rows */}
                                    <div className="pt-2 border-t border-slate-200">
                                        <h3 className="text-sm font-black text-slate-800 mb-1">{t("emergency.iceTitle")}</h3>
                                        <p className="text-xs text-slate-400 mb-4">{t("emergency.iceDesc")}</p>
                                        <div className="space-y-3">
                                            {([1, 2, 3] as const).map((n) => (
                                                <div key={n} className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t("emergency.contactNum", { num: n })}</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                        {renderInput(t("account.fullName"), `ice${n}Name` as keyof typeof form, "e.g. Suresh Thakur")}
                                                        {renderInput(t("account.phoneNum"), `ice${n}Phone` as keyof typeof form, "e.g. 9876543210", "tel")}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* MISC / FAMILY / LIFESTYLE */}
                                <div className={cn("space-y-6", activeTab !== "Misc" && "hidden")}>
                                    <h3 className="text-sm font-bold">{t("patients.lifestyle")}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {renderSelect(t("patients.smoking"), "smoking", [
                                            { label: t("patients.freqNo"), value: "No" },
                                            { label: t("patients.freqOccasionally"), value: "Occasionally" },
                                            { label: t("patients.freqRegularly"), value: "Regularly" },
                                            { label: t("patients.freqFormer"), value: "Former" }
                                        ])}
                                        {renderSelect(t("patients.alcohol"), "alcohol", [
                                            { label: t("patients.freqNo"), value: "No" },
                                            { label: t("patients.freqOccasionally"), value: "Occasionally" },
                                            { label: t("patients.freqRegularly"), value: "Regularly" },
                                            { label: t("patients.freqFormer"), value: "Former" }
                                        ])}
                                        {renderSelect(t("patients.tobacco"), "tobacco", [
                                            { label: t("patients.freqNo"), value: "No" },
                                            { label: t("patients.freqOccasionally"), value: "Occasionally" },
                                            { label: t("patients.freqRegularly"), value: "Regularly" },
                                            { label: t("patients.freqFormer"), value: "Former" }
                                        ])}
                                    </div>

                                    <div className="pt-4 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">{t("patients.insuranceTitle")}</h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {renderInput(t("patients.insuranceTitle"), "insuranceProvider", "e.g. Star Health")}
                                            {renderInput(t("patients.policyNum"), "policyNumber", "Policy/Card number")}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-border/50">
                                        <h3 className="text-sm font-bold mb-4">{t("patients.familyTitle")}</h3>
                                        <div className="space-y-4">
                                            <div className="bg-secondary/30 p-4 rounded-2xl border border-border">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">{t("patients.fatherGuardian")}</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {renderInput(t("patients.name"), "fatherName", "Father's name")}
                                                    {renderInput(t("patients.phone"), "fatherPhone", "Contact number")}
                                                </div>
                                            </div>
                                            <div className="bg-secondary/30 p-4 rounded-2xl border border-border">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">{t("patients.spouse")}</h4>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {renderInput(t("patients.name"), "spouseName", "Spouse's name")}
                                                    {renderInput(t("patients.phone"), "spousePhone", "Contact number")}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Footer actions */}
                        <div className="px-5 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
                            {editingId ? (
                                <button
                                    type="button"
                                    onClick={() => setDeleteModal(editingId)}
                                    className="flex items-center gap-1.5 py-2.5 px-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold hover:bg-rose-100 transition-colors active:scale-95"
                                >
                                    <Trash2 size={15} /> {t("patients.delete")}
                                </button>
                            ) : <div></div>}
                            <button
                                type="submit"
                                form="patient-form"
                                disabled={saving}
                                className="flex-1 max-w-[200px] py-3 bg-emerald-500 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 active:scale-[0.98] transition-all"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                {editingId ? t("patients.save") : t("patients.create")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModal && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
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
    );
}
