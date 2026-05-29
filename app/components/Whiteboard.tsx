"use client";

import React, { RefObject } from "react";

export type ChatMessage = {
  author: string;
  note: string;
};

export interface WhiteboardProps {
  whiteboardRef: RefObject<HTMLDivElement | null>;
  selectedReport: any;
  setSelectedReport: (report: any) => void;
  isFetchingReport: boolean;
  isReportUnsealed: boolean;
  selectedReportHistory: ChatMessage[];
  isDecryptingReport: boolean;
  onUnsealReport: () => void;
  successBanner: string | null;
  liveStatus: { text: string; color: string } | null;
  history: ChatMessage[];
  encryptedHistory: string | null;
  isLiveHistoryUnsealed: boolean;
  isDecrypting: boolean;
  onDecryptHistory: () => void;
}

export default function Whiteboard({
  whiteboardRef,
  selectedReport,
  setSelectedReport,
  isFetchingReport,
  isReportUnsealed,
  selectedReportHistory,
  isDecryptingReport,
  onUnsealReport,
  successBanner,
  liveStatus,
  history,
  encryptedHistory,
  isLiveHistoryUnsealed,
  isDecrypting,
  onDecryptHistory,
}: WhiteboardProps) {
  return (
    <div ref={whiteboardRef} className="tusk-whiteboard">
      {selectedReport ? (
        /* ── Archived Report View ── */
        <div className="tusk-report-view">
          {/* Header with back button */}
          <div className="tusk-report-header">
            <button onClick={() => setSelectedReport(null)} className="tusk-btn tusk-btn-ghost">
              ← BACK TO LIVE WORKSPACE
            </button>
            <div style={{ flex: 1 }} />
            <div className="tusk-report-meta">
              <span>BLOB ID: {selectedReport.blobId.slice(0, 10)}…</span>
            </div>
          </div>

          <div className="tusk-report-body-container">
            {isFetchingReport ? (
              <div className="tusk-skeletons">
                <div className="tusk-skeleton-line header" />
                <div className="tusk-skeleton-line" />
                <div className="tusk-skeleton-line" />
                <div className="tusk-skeleton-line half" />
                <div className="tusk-skeleton-line" />
                <div className="tusk-skeleton-line" />
              </div>
            ) : (
              <>
                {/* Blur container */}
                <div className={`tusk-report-content ${!isReportUnsealed ? "blurred" : "unsealed"}`}>
                  <h1 className="tusk-report-title" style={{ color: "var(--purple)" }}>SECURE VIRTUAL MEMORY</h1>
                  <h3 className="tusk-report-subtitle" style={{ borderBottomColor: "var(--purple)" }}>
                    TOPIC: {selectedReport.topic}
                  </h3>

                  {isReportUnsealed ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                      {selectedReportHistory
                        .filter((item) => item.author !== "System_Archive" && item.author !== "SHARED_INBOX_GRANT")
                        .map((item, idx) => {
                          const cleanAuthor = item.author.split("___")[0];
                          const lowerAuthor = cleanAuthor.toLowerCase();
                          const isResearcher = lowerAuthor.includes("researcher");
                          const isRisk = lowerAuthor.includes("risk");
                          const isSystem = lowerAuthor.includes("system");
                          const isArchitect = lowerAuthor.includes("architect");
                          const isRedTeam = lowerAuthor.includes("red");
                          const isBlueTeam = lowerAuthor.includes("blue");

                          const authorColor = isResearcher
                            ? "var(--green)"
                            : isRisk || isRedTeam
                            ? "var(--red)"
                            : isSystem
                            ? "var(--purple)"
                            : isBlueTeam
                            ? "var(--accent-blue)"
                            : "var(--accent-orange)";

                          const displayName = cleanAuthor.replace(/_/g, " ");
                          const roleIcon = isArchitect ? "◆" : isRedTeam ? "⚔" : isBlueTeam ? "🛡" : isResearcher ? "🔬" : isRisk ? "⚠" : "●";

                          return (
                            <p
                              key={idx}
                              className="tusk-report-para"
                              style={{
                                animationDelay: `${idx * 0.1}s`,
                                background: isSystem ? "rgba(168,85,247,0.03)" : "rgba(255,255,255,0.01)",
                                border: "1px solid var(--border-dim)",
                                padding: "1rem 1.25rem",
                                fontFamily: "var(--font-mono)",
                                fontSize: "0.8rem",
                                lineHeight: 1.7,
                              }}
                            >
                              <strong style={{ color: authorColor, textTransform: "uppercase", fontSize: "0.6rem", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>
                                {roleIcon} {displayName}
                              </strong>
                              {item.note}
                            </p>
                          );
                        })}
                    </div>
                  ) : (
                    /* Skeletons represent the layout of the chat report */
                    <div className="tusk-skeletons" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                      <div className="tusk-skeleton-msg" style={{ border: "2px solid var(--border-dim)", padding: "1.25rem" }}>
                        <div className="tusk-skeleton-line" style={{ width: "30%", height: "10px", marginBottom: "0.8rem" }} />
                        <div className="tusk-skeleton-line" style={{ width: "90%", height: "12px", marginBottom: "0.5rem" }} />
                        <div className="tusk-skeleton-line" style={{ width: "65%", height: "12px" }} />
                      </div>
                      <div className="tusk-skeleton-msg" style={{ border: "2px solid var(--border-dim)", padding: "1.25rem" }}>
                        <div className="tusk-skeleton-line" style={{ width: "25%", height: "10px", marginBottom: "0.8rem" }} />
                        <div className="tusk-skeleton-line" style={{ width: "85%", height: "12px", marginBottom: "0.5rem" }} />
                        <div className="tusk-skeleton-line" style={{ width: "45%", height: "12px" }} />
                      </div>
                      <div className="tusk-skeleton-msg" style={{ border: "2px solid var(--border-dim)", padding: "1.25rem" }}>
                        <div className="tusk-skeleton-line" style={{ width: "35%", height: "10px", marginBottom: "0.8rem" }} />
                        <div className="tusk-skeleton-line" style={{ width: "95%", height: "12px", marginBottom: "0.5rem" }} />
                        <div className="tusk-skeleton-line" style={{ width: "80%", height: "12px" }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Lock Overlay */}
                {!isReportUnsealed && (
                  <div className="tusk-lock-overlay">
                    <div className="tusk-lock-card">
                      <div className="tusk-lock-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div className="tusk-lock-title">VIRTUAL MEMORY ENCRYPTED</div>
                      <p className="tusk-lock-desc">
                        {selectedReport.isShared
                          ? "This journal was shared with you. Sign a personal message so Seal key servers can verify your on-chain access, then decrypt locally."
                          : "This executive report is sealed with threshold encryption to Sui Testnet. Verify ownership using your wallet to unseal."}
                      </p>
                      <button
                        onClick={onUnsealReport}
                        disabled={isDecryptingReport}
                        className="tusk-btn tusk-btn-primary"
                        style={{
                          padding: "0.8rem 1.6rem",
                          fontFamily: "var(--font-head)",
                          fontSize: "0.75rem",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          border: "2px solid var(--purple)",
                          background: "var(--purple)",
                          color: "#fff",
                          boxShadow: "0 4px 14px rgba(168,85,247,0.3)",
                        }}
                      >
                        {isDecryptingReport ? (
                          <>
                            <span className="tusk-spinner" style={{ borderColor: "#fff #fff transparent transparent" }} />
                            AUTHORIZING…
                          </>
                        ) : (
                          "🔓 UNSEAL ENCRYPTED VIRTUAL MEMORY"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Live Workspace View ── */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1, minHeight: 0, position: "relative" }}>
          {/* Success banner */}
          {successBanner && (
            <div className="tusk-success">
              <div className="tusk-success-title">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                REPORT ARCHIVED ON-CHAIN
              </div>
              <p className="tusk-success-desc">
                The executive intelligence report has been permanently sealed to the Walrus Testnet decentralized storage network.
              </p>
              <a
                href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${successBanner}`}
                target="_blank"
                rel="noreferrer"
                className="tusk-btn tusk-btn-secondary"
                style={{ padding: "0.7rem 1.5rem" }}
              >
                VIEW VERIFIABLE ARTIFACT →
              </a>
            </div>
          )}

          {/* Live status */}
          {liveStatus && (
            <div className="tusk-status">
              <div
                className="tusk-dot"
                style={{
                  background:
                    liveStatus.color === "green"
                      ? "var(--green)"
                      : liveStatus.color === "red"
                      ? "var(--red)"
                      : "var(--accent-blue)",
                }}
              />
              <span>{liveStatus.text}</span>
            </div>
          )}

          {/* Empty state */}
          {history.length === 0 && !liveStatus && !successBanner && !encryptedHistory && (
            <div className="tusk-empty">
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="var(--border-dim)" strokeWidth="1.5">
                <rect x="6" y="6" width="36" height="36" />
                <line x1="6" y1="24" x2="42" y2="24" />
                <line x1="24" y1="6" x2="24" y2="42" />
                <circle cx="24" cy="24" r="7" strokeDasharray="3 3" />
                <circle cx="24" cy="24" r="2" fill="var(--border-dim)" />
              </svg>
              AGENT WHITEBOARD — EMPTY
              <span style={{
                fontSize: "0.62rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                textTransform: "none",
                letterSpacing: "0",
                fontWeight: 400,
              }}>
                Enter a protocol concept and run agents to begin.
              </span>
            </div>
          )}

          {/* Skeletons or Messages */}
          {encryptedHistory && !isLiveHistoryUnsealed ? (
            /* Sealed state skeletons */
            <div className="tusk-skeletons blurred" style={{ display: "flex", flexDirection: "column", gap: "1.25rem", flex: 1 }}>
              <div className="tusk-skeleton-msg" style={{ border: "2px solid var(--border-dim)", padding: "1.25rem", background: "var(--bg-ice)" }}>
                <div className="tusk-skeleton-line" style={{ width: "30%", height: "10px", marginBottom: "0.8rem" }} />
                <div className="tusk-skeleton-line" style={{ width: "90%", height: "12px", marginBottom: "0.5rem" }} />
                <div className="tusk-skeleton-line" style={{ width: "65%", height: "12px" }} />
              </div>
              <div className="tusk-skeleton-msg" style={{ border: "2px solid var(--border-dim)", padding: "1.25rem", background: "var(--bg-ice)" }}>
                <div className="tusk-skeleton-line" style={{ width: "25%", height: "10px", marginBottom: "0.8rem" }} />
                <div className="tusk-skeleton-line" style={{ width: "85%", height: "12px", marginBottom: "0.5rem" }} />
                <div className="tusk-skeleton-line" style={{ width: "45%", height: "12px" }} />
              </div>
              <div className="tusk-skeleton-msg" style={{ border: "2px solid var(--border-dim)", padding: "1.25rem", background: "var(--bg-ice)" }}>
                <div className="tusk-skeleton-line" style={{ width: "35%", height: "10px", marginBottom: "0.8rem" }} />
                <div className="tusk-skeleton-line" style={{ width: "95%", height: "12px", marginBottom: "0.5rem" }} />
                <div className="tusk-skeleton-line" style={{ width: "80%", height: "12px" }} />
              </div>
            </div>
          ) : (
            history.length > 0 && (
              <div className="tusk-messages-container unsealed" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {history
                  .filter((item) => item.author !== "System_Archive" && item.author !== "SHARED_INBOX_GRANT")
                  .map((item, idx) => {
                    const cleanAuthor = item.author.split("___")[0];
                    const lowerAuthor = cleanAuthor.toLowerCase();

                    const isResearcher = lowerAuthor.includes("researcher");
                    const isRisk = lowerAuthor.includes("risk");
                    const isSystem = lowerAuthor.includes("system");
                    const isArchitect = lowerAuthor.includes("architect");
                    const isRedTeam = lowerAuthor.includes("red");
                    const isBlueTeam = lowerAuthor.includes("blue");

                    const authorColor = isResearcher
                      ? "var(--green)"
                      : isRisk || isRedTeam
                      ? "var(--red)"
                      : isSystem
                      ? "var(--purple)"
                      : isBlueTeam
                      ? "var(--accent-blue)"
                      : "var(--accent-orange)";

                    const displayName = cleanAuthor.replace(/_/g, " ");
                    const roleIcon = isArchitect ? "◆" : isRedTeam ? "⚔" : isBlueTeam ? "🛡" : isResearcher ? "🔬" : isRisk ? "⚠" : "●";

                    return (
                      <div key={idx} className={`tusk-msg${isSystem ? " tusk-msg-system" : ""}`}>
                        <div className="tusk-msg-author" style={{ color: authorColor }}>
                          <span style={{ marginRight: "0.4rem", fontSize: "0.8rem" }}>{roleIcon}</span>
                          {displayName}
                          <span style={{
                            marginLeft: "0.5rem",
                            fontSize: "0.55rem",
                            color: "var(--text-muted)",
                            fontWeight: 400,
                            letterSpacing: "0.05em",
                            textTransform: "none",
                          }}>#{String(idx + 1).padStart(2, "0")}</span>
                        </div>
                        <div className="tusk-msg-note">{item.note}</div>
                      </div>
                    );
                  })}
              </div>
            )
          )}

          {/* Lock Overlay for live history */}
          {encryptedHistory && !isLiveHistoryUnsealed && (
            <div className="tusk-lock-overlay" style={{ background: "transparent" }}>
              <div className="tusk-lock-card">
                <div className="tusk-lock-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="tusk-lock-title">VIRTUAL MEMORY ENCRYPTED</div>
                <p className="tusk-lock-desc">
                  This workspace history is sealed with threshold encryption to Sui Testnet. Verify ownership using your wallet to unseal.
                </p>
                <button
                  onClick={onDecryptHistory}
                  disabled={isDecrypting}
                  className="tusk-btn tusk-btn-primary"
                  style={{
                    padding: "0.8rem 1.6rem",
                    fontFamily: "var(--font-head)",
                    fontSize: "0.75rem",
                    fontWeight: 900,
                    letterSpacing: "0.08em",
                    border: "2px solid var(--purple)",
                    background: "var(--purple)",
                    color: "#fff",
                    boxShadow: "0 4px 14px rgba(168,85,247,0.3)",
                  }}
                >
                  {isDecrypting ? (
                    <>
                      <span className="tusk-spinner" style={{ borderColor: "#fff #fff transparent transparent" }} />
                      AUTHORIZING…
                    </>
                  ) : (
                    "UNSEAL ENCRYPTED VIRTUAL MEMORY"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
