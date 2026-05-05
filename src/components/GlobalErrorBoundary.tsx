import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // TODO: Send to Firebase Crashlytics or Sentry here
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6 pb-32">
          <div className="w-full max-w-sm bg-white rounded-[2rem] p-8 text-center shadow-xl border border-rose-100">
            <div className="size-16 rounded-3xl bg-rose-100 text-rose-500 flex items-center justify-center mx-auto mb-6 shadow-sm border border-rose-200">
              <AlertTriangle size={32} />
            </div>
            
            <h1 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-sm font-medium text-slate-500 mb-4 leading-relaxed">
              We encountered an unexpected error. Please refresh the app to continue.
            </p>
            
            {this.state.error && (
              <div className="bg-slate-100 rounded-xl p-3 mb-6 text-left">
                <p className="text-[11px] font-mono text-rose-700 break-all leading-relaxed">
                  {this.state.error.message}
                </p>
              </div>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3.5 bg-rose-500 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
            >
              <RefreshCw size={16} />
              Reload Application
            </button>
            <div className="mt-4">
                <button
                    onClick={() => { localStorage.clear(); window.location.href = "/"; }}
                    className="text-[10px] uppercase font-bold tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                >
                    Clear Cache &amp; Restart
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
