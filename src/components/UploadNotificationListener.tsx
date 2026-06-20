import { useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { FileText, ArrowRight } from "lucide-react";

export function UploadNotificationListener() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const analyzingDocs = new Set<string>();
    
    // Listen to all documents for the user
    const q = query(collection(db, "documents"), where("userId", "==", user.uid));
    
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        const docId = change.doc.id;

        if (isInitialLoad) {
          // On initial load, just populate the analyzing set if there are any
          if (data.status === "analyzing") {
            analyzingDocs.add(docId);
          }
          return;
        }

        // Handle changes after initial load
        if (change.type === "added" || change.type === "modified") {
          if (data.status === "analyzing") {
            analyzingDocs.add(docId);
          } else if (data.status === "completed" && analyzingDocs.has(docId)) {
            // It transitioned from analyzing -> completed!
            analyzingDocs.delete(docId);

            // Show Toast Notification
            toast.custom((t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-sm w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 overflow-hidden`}
              >
                <div className="flex-1 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                      <div className="size-10 rounded-full bg-brand-gradient flex items-center justify-center text-white shadow-glow-sm">
                        <FileText size={20} />
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        Summary Ready!
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Your document "{data.name}" has been successfully analyzed by AI.
                      </p>
                      <button
                        onClick={() => {
                          toast.dismiss(t.id);
                          navigate(`/documents?viewDoc=${docId}`);
                        }}
                        className="mt-3 flex items-center gap-1.5 text-sm font-bold text-brand-indigo hover:text-indigo-800 transition-colors"
                      >
                        View Summary <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-slate-100">
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            ), {
              duration: 8000,
              position: "top-center"
            });
          }
        }
      });
      
      isInitialLoad = false;
    });

    return () => unsubscribe();
  }, [user, navigate]);

  return null;
}
