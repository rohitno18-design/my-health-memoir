import re

with open(r'c:\Users\rohit\.gemini\antigravity\scratch\my-health-memoir\src\pages\AIChatPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 2. Clean up TOOL_DECLARATIONS
tools_to_remove = ["search_documents", "get_recent_documents", "summarize_documents", "prepare_doctor_visit"]
for tool in tools_to_remove:
    pattern = r'\{\s*name:\s*"' + tool + r'".*?\},(?=\n\s*\{|\n\];)'
    code = re.sub(pattern, '', code, flags=re.DOTALL)

# 3. Clean up executeTool cases
for case in tools_to_remove:
    pattern = r'case "' + case + r'": \{.*?\}'
    code = re.sub(pattern, '', code, flags=re.DOTALL)

# 4. Add states and useEffect for action modals
state_injection = """
    const [actionModal, setActionModal] = useState<"doctor" | "explain" | "prescription" | null>(null);
    const [actionFolders, setActionFolders] = useState<any[]>([]);
    const [actionEvents, setActionEvents] = useState<any[]>([]);
    const [actionTargetId, setActionTargetId] = useState<string>("");

    useEffect(() => {
        if (!user || !actionModal) return;
        const fetchModalData = async () => {
            const fSnap = await getDocs(query(collection(db, "folders"), where("userId", "==", user.uid)));
            setActionFolders(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            
            const eSnap = await getDocs(query(collection(db, "life_events"), where("userId", "==", user.uid)));
            setActionEvents(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            const dSnap = await getDocs(query(collection(db, "documents"), where("userId", "==", user.uid)));
            setAvailableDocs(dSnap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));
        };
        fetchModalData();
    }, [user, actionModal]);

    const handleAgentAction = async (type: string, targetId?: string, targetType?: 'folder' | 'event' | 'document') => {
        if (!user) return;
        let promptText = "";
        let displayContent = "";

        if (type === "compare_labs") {
            const docs = availableDocs
                .filter(d => (d.category || "").toLowerCase().includes("labreport") || (d.category || "").toLowerCase().includes("lab report") || (d.category || "").toLowerCase().includes("lab"))
                .sort((a, b) => {
                    const t1 = (a.createdAt as any)?.seconds || 0;
                    const t2 = (b.createdAt as any)?.seconds || 0;
                    return t2 - t1;
                })
                .slice(0, 3);
            const mapped = docs.map(d => `Date: ${d.docDate || "Unknown"}, Name: ${d.name}, Summary: ${d.aiSummary || "N/A"}`).join('\\n');
            promptText = `Act as a medical assistant. Here are the summaries of my last 3 lab reports:\n\n${mapped}\n\nPlease compare the trends, tell me what improved, what worsened, and any red flags.`;
            displayContent = "Action: Compare Recent Labs";
        } else if (type === "doctor") {
            let docs: any[] = [];
            if (targetType === "folder") {
                docs = availableDocs.filter((d: any) => d.folderId === targetId);
            } else if (targetType === "event") {
                const event = actionEvents.find(e => e.id === targetId);
                if (event && event.documentIds) {
                    docs = availableDocs.filter(d => event.documentIds.includes(d.id));
                }
            }
            const mapped = docs.map(d => `Date: ${d.docDate || "Unknown"}, Name: ${d.name}, Summary: ${d.aiSummary || "N/A"}`).join('\\n');
            promptText = `I have a doctor's visit coming up. Here is my medical history for this issue based on my documents:\n\n${mapped}\n\nPlease give me a short summary of the situation and the 5 most critical questions I should ask the doctor.`;
            displayContent = "Action: Prepare for Doctor Visit";
        } else if (type === "explain") {
            const doc = availableDocs.find(d => d.id === targetId);
            if (!doc) return;
            promptText = `Break this complex medical report down into a simple summary that anyone can understand, and highlight any red flags:\n\nName: ${doc.name}\nSummary: ${doc.aiSummary || "N/A"}`;
            displayContent = `Action: Explain Document (${doc.name})`;
        } else if (type === "prescription") {
            const doc = availableDocs.find(d => d.id === targetId);
            if (!doc) return;
            promptText = `Look at this prescription and make a simple daily schedule of what medicines I need to take morning, afternoon, and night:\n\nName: ${doc.name}\nSummary: ${doc.aiSummary || "N/A"}`;
            displayContent = `Action: Extract Prescription Schedule (${doc.name})`;
        }

        setActionModal(null);
        setIsLoading(true);

        const tempMsg: any = {
            id: 'temp-' + Date.now(),
            role: 'user',
            content: promptText,
            displayContent,
            timestamp: Timestamp.now()
        };
        setMessages(prev => [...prev, tempMsg]);

        geminiHistoryRef.current.push({ role: 'user', parts: [{ text: promptText }] });

        let activeChatId = currentChatId;
        if (!activeChatId) {
            const chatRef = doc(collection(db, "users", user.uid, "chats"));
            await setDoc(chatRef, {
                title: displayContent,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                messageCount: 0,
            });
            activeChatId = chatRef.id;
            setCurrentChatId(activeChatId);
            internalNavigateRef.current = true;
            navigate(`/ai-chat/${activeChatId}`, { replace: true });
        }

        await addDoc(collection(db, "users", user.uid, "chats", activeChatId, "messages"), {
            role: 'user',
            content: promptText,
            displayContent,
            timestamp: serverTimestamp()
        });
        await updateDoc(doc(db, "users", user.uid, "chats", activeChatId), {
            updatedAt: serverTimestamp(),
            messageCount: increment(1),
        });

        await runAgentLoop(activeChatId);
        setIsLoading(false);
    };
"""

code = code.replace("const [loadingHistory, setLoadingHistory] = useState(!isNewChat);", 
                    "const [loadingHistory, setLoadingHistory] = useState(!isNewChat);\n" + state_injection)

# 5. Agent Actions UI
agent_ui = """
                {!loadingHistory && messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800 mb-6">
                            Agent Actions
                        </h2>
                        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                            <button onClick={() => {
                                getDocs(query(collection(db, "documents"), where("userId", "==", user?.uid))).then(snap => {
                                    setAvailableDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Document)));
                                    handleAgentAction("compare_labs");
                                });
                            }} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl p-5 hover:border-primary/40 shadow-sm text-left transition-all">
                                <div className="text-2xl mb-2">📊</div>
                                <div className="font-bold text-slate-700">Compare Recent Labs</div>
                            </button>
                            <button onClick={() => setActionModal("doctor")} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl p-5 hover:border-primary/40 shadow-sm text-left transition-all">
                                <div className="text-2xl mb-2">👨‍⚕️</div>
                                <div className="font-bold text-slate-700">Prepare for Doctor</div>
                            </button>
                            <button onClick={() => setActionModal("explain")} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl p-5 hover:border-primary/40 shadow-sm text-left transition-all">
                                <div className="text-2xl mb-2">🧠</div>
                                <div className="font-bold text-slate-700">Explain Document</div>
                            </button>
                            <button onClick={() => setActionModal("prescription")} className="bg-white/60 backdrop-blur-md border border-white/60 rounded-2xl p-5 hover:border-primary/40 shadow-sm text-left transition-all">
                                <div className="text-2xl mb-2">📝</div>
                                <div className="font-bold text-slate-700">Extract Prescription</div>
                            </button>
                        </div>
                    </div>
                )}
"""

code = re.sub(r'\{\!loadingHistory && messages\.length === 0 && \!isLoading && \(\s*<div className="flex flex-col items-center justify-center.*?</div>\s*\)\}', agent_ui, code, flags=re.DOTALL)

# 6. Use msg.displayContent || msg.content
code = code.replace(
    """{msg.role === "model" ? (
                                    <div className="prose prose-sm prose-slate max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                                        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    msg.content
                                )}""",
    """{msg.role === "model" ? (
                                    <div className="prose prose-sm prose-slate max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                                        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    // @ts-ignore
                                    msg.displayContent || msg.content
                                )}"""
)

# 7. Add Modals UI before closing div of AIChatPage
modals_ui = """
            {actionModal === "doctor" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-2">Prepare for Doctor</h3>
                        <p className="text-sm text-slate-500 mb-4">Select the folder or event you are visiting the doctor for.</p>
                        <select value={actionTargetId} onChange={e => setActionTargetId(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 mb-4 outline-none">
                            <option value="">Select Target...</option>
                            <optgroup label="Folders">
                                {actionFolders.map(f => <option key={f.id} value={`folder_${f.id}`}>{f.name || f.title || f.id}</option>)}
                            </optgroup>
                            <optgroup label="Events">
                                {actionEvents.map(e => <option key={e.id} value={`event_${e.id}`}>{e.title}</option>)}
                            </optgroup>
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setActionModal(null)} className="px-5 py-2 text-slate-500 font-bold">Cancel</button>
                            <button onClick={() => {
                                if (!actionTargetId) return;
                                const type = actionTargetId.startsWith("folder_") ? "folder" : "event";
                                const id = actionTargetId.replace(/^(folder_|event_)/, "");
                                handleAgentAction("doctor", id, type as any);
                            }} className="px-5 py-2 bg-primary text-white rounded-xl font-bold">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {actionModal === "explain" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-2">Explain Document</h3>
                        <p className="text-sm text-slate-500 mb-4">Select the document you want explained.</p>
                        <select value={actionTargetId} onChange={e => setActionTargetId(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 mb-4 outline-none">
                            <option value="">Select Document...</option>
                            {availableDocs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setActionModal(null)} className="px-5 py-2 text-slate-500 font-bold">Cancel</button>
                            <button onClick={() => {
                                if (!actionTargetId) return;
                                handleAgentAction("explain", actionTargetId);
                            }} className="px-5 py-2 bg-primary text-white rounded-xl font-bold">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {actionModal === "prescription" && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl">
                        <h3 className="text-xl font-bold mb-2">Extract Prescription</h3>
                        <p className="text-sm text-slate-500 mb-4">Select a prescription document.</p>
                        <select value={actionTargetId} onChange={e => setActionTargetId(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 mb-4 outline-none">
                            <option value="">Select Document...</option>
                            {availableDocs.filter(d => d.category === 'documents.cat_prescription' || d.category === 'Prescription').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setActionModal(null)} className="px-5 py-2 text-slate-500 font-bold">Cancel</button>
                            <button onClick={() => {
                                if (!actionTargetId) return;
                                handleAgentAction("prescription", actionTargetId);
                            }} className="px-5 py-2 bg-primary text-white rounded-xl font-bold">Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            <DocumentViewerModal 
"""

code = code.replace("<DocumentViewerModal ", modals_ui)

with open(r'c:\Users\rohit\.gemini\antigravity\scratch\my-health-memoir\src\pages\AIChatPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
