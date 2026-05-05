import React from "react";

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

/**
 * Global Error Boundary — catches ANY React render crash and shows
 * a recovery screen instead of a white screen of death.
 */
export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        this.setState({ errorInfo });
        console.error("🔴 ErrorBoundary caught:", error, errorInfo);
        
        // Try to log to Firestore for remote debugging
        try {
            // Fire-and-forget fetch to avoid importing firebase here
            fetch("https://firestore.googleapis.com/v1/projects/im-smrti/databases/(default)/documents/debug_logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fields: { 
                    type: { stringValue: "REACT_CRASH" },
                    message: { stringValue: error.message },
                    stack: { stringValue: (error.stack || "").substring(0, 2000) },
                    componentStack: { stringValue: (errorInfo.componentStack || "").substring(0, 2000) },
                    url: { stringValue: window.location.href },
                    timestamp: { stringValue: new Date().toISOString() },
                }})
            }).catch(() => {});
        } catch (_) {
            // Silently fail — we never want the error reporter to crash
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: "100dvh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "2rem",
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    color: "#e2e8f0",
                    textAlign: "center",
                }}>
                    <div style={{
                        width: "80px", height: "80px", borderRadius: "24px",
                        background: "linear-gradient(135deg, #ef4444, #f97316)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "36px", marginBottom: "1.5rem",
                        boxShadow: "0 20px 40px rgba(239,68,68,0.3)"
                    }}>
                        ⚠️
                    </div>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 900, marginBottom: "0.5rem" }}>
                        Something went wrong
                    </h1>
                    <p style={{ color: "#94a3b8", maxWidth: "320px", lineHeight: 1.6, marginBottom: "1.5rem" }}>
                        The app encountered an unexpected error. This has been logged automatically.
                    </p>
                    
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null, errorInfo: null });
                            }}
                            style={{
                                padding: "14px 28px", borderRadius: "16px",
                                background: "linear-gradient(135deg, #10b981, #059669)",
                                color: "white", fontWeight: 800, fontSize: "0.95rem",
                                border: "none", cursor: "pointer",
                                boxShadow: "0 8px 24px rgba(16,185,129,0.3)"
                            }}
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => {
                                window.location.href = "/";
                            }}
                            style={{
                                padding: "14px 28px", borderRadius: "16px",
                                background: "rgba(255,255,255,0.1)",
                                color: "white", fontWeight: 800, fontSize: "0.95rem",
                                border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
                            }}
                        >
                            Go Home
                        </button>
                    </div>

                    {/* Debug info — only shown in dev or if user expands */}
                    <details style={{ 
                        marginTop: "2rem", maxWidth: "400px", width: "100%",
                        textAlign: "left", color: "#64748b", fontSize: "0.75rem"
                    }}>
                        <summary style={{ cursor: "pointer", marginBottom: "0.5rem" }}>
                            Technical Details
                        </summary>
                        <pre style={{
                            background: "rgba(0,0,0,0.3)", padding: "1rem",
                            borderRadius: "12px", overflow: "auto",
                            maxHeight: "200px", whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                        }}>
                            {this.state.error?.message}
                            {"\n\n"}
                            {this.state.error?.stack?.substring(0, 1000)}
                        </pre>
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}
