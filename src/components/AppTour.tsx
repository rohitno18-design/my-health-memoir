import { useState, useEffect } from "react";
import { Joyride, STATUS, type Step } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AppTourProps {
  runOverride?: boolean;
  onFinish?: () => void;
}

export default function AppTour({ runOverride, onFinish }: AppTourProps) {
  const { user } = useAuth();
  const [run, setRun] = useState(false);

  useEffect(() => {
    // If explicitly told to run (e.g. from a help button), start immediately.
    if (runOverride) {
      setRun(true);
      return;
    }

    // Otherwise, check if user has seen it before
    const checkFirstTime = async () => {
      if (!user) return;
      try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (!data.hasSeenTour) {
            setRun(true);
          }
        }
      } catch (err) {
        console.error("Failed to check tour status:", err);
      }
    };
    checkFirstTime();
  }, [user, runOverride]);

  const steps: Step[] = [
    {
      target: "body",
      content: (
        <div className="text-left">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Welcome to I M Smrti! 👋</h3>
          <p className="text-slate-600">Let's take a quick tour to see how you can easily manage and understand your medical documents.</p>
        </div>
      ),
      placement: "center",
      skipBeacon: true,
    },
    {
      target: ".tour-upload-btn",
      content: (
        <div className="text-left">
          <h3 className="text-lg font-bold text-slate-800 mb-2">1. Upload Documents</h3>
          <p className="text-slate-600">Start by securely uploading your lab reports, prescriptions, or bills here.</p>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: ".tour-ai-chat",
      content: (
        <div className="text-left">
          <h3 className="text-lg font-bold text-slate-800 mb-2">2. AI Assistant</h3>
          <p className="text-slate-600">Our AI will automatically summarize your documents. You can also chat with it to ask any questions about your health records!</p>
        </div>
      ),
      skipBeacon: true,
    },
    {
      target: ".tour-emergency",
      content: (
        <div className="text-left">
          <h3 className="text-lg font-bold text-slate-800 mb-2">3. Medical ID & Emergency</h3>
          <p className="text-slate-600">Set up your medical ID so paramedics can quickly access your life-saving information using a QR code in an emergency.</p>
        </div>
      ),
      skipBeacon: true,
    },
  ];

  const handleJoyrideCallback = async (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (onFinish) onFinish();

      if (user) {
        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, { hasSeenTour: true });
        } catch (err) {
          console.error("Failed to update tour status:", err);
        }
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideCallback}
      styles={{
        tooltipContainer: {
          textAlign: "left"
        }
      }}
    />
  );
}
