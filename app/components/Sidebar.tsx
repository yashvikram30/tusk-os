"use client";

import React from "react";

export interface SidebarProps {
  walletAddress: string;
  workspaceId: string;
  archivedReports: any[];
  sharedReports: any[];
  selectedReport: any;
  isRebuilding: boolean;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onSelectReport: (report: any) => void;
  onRebuildFromBlockchain: () => void;
  onSwitchWalletAccount: () => void;
  onDisconnect: () => void;
}

export default function Sidebar({
  walletAddress,
  workspaceId,
  archivedReports,
  sharedReports,
  selectedReport,
  isRebuilding,
  sidebarOpen,
  onCloseSidebar,
  onSelectReport,
  onRebuildFromBlockchain,
  onSwitchWalletAccount,
  onDisconnect,
}: SidebarProps) {
  return (
    <aside className={`tusk-sidebar${sidebarOpen ? " is-open" : ""}`}>
      {/* Logo */}
      <div className="tusk-logo">
        <div className="tusk-logo-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <polygon points="8,1 15,15 1,15" fill="#000" />
          </svg>
        </div>
        TuskOS
      </div>

      {/* Scrollable body */}
      <div className="tusk-sidebar-scroll">
        {/* Wallet */}
        <div>
          <div className="tusk-label">Connected Wallet</div>
          <div className="tusk-cell">
            {walletAddress ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}` : ""}
          </div>
        </div>

        {/* Workspace */}
        <div>
          <div className="tusk-label">Workspace Namespace</div>
          <div className="tusk-cell" style={{ fontSize: "0.68rem" }}>
            {workspaceId}
          </div>
        </div>

        {/* Own archived reports */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem" }}>
            <div className="tusk-section-head" style={{ margin: 0 }}>Archived Reports</div>
            <button
              onClick={onRebuildFromBlockchain}
              disabled={isRebuilding}
              className="tusk-btn tusk-btn-ghost"
              style={{ fontSize: "0.52rem", padding: "0.25rem 0.5rem", color: "var(--accent-orange)", borderColor: "var(--accent-orange)" }}
              title="Reconstruct your MongoDB index cache directly from decentralized ledger nodes"
            >
              {isRebuilding ? "🔄 REBUILDING…" : "🔄 REBUILD FROM BLOCKCHAIN"}
            </button>
          </div>
          <div className="tusk-archive-list">
            {archivedReports.length === 0 ? (
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                padding: "0.5rem 0",
              }}>
                — No reports archived yet.
              </div>
            ) : (
              archivedReports.map((report: any, idx) => {
                const isSelected = selectedReport?.blobId === report.blobId;
                if (report.isSyncing) {
                  return (
                    <div
                      key={idx}
                      className="tusk-report-card"
                      style={{
                        opacity: 0.75,
                        borderStyle: "dashed",
                        borderColor: "var(--accent-orange)",
                        cursor: "default",
                      }}
                    >
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        lineHeight: 1.5,
                      }}>
                        {report.topic || "Unknown Topic"}
                      </div>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontFamily: "var(--font-head)",
                        fontSize: "0.58rem",
                        fontWeight: 700,
                        color: "var(--accent-orange)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        animation: "pulse 1.5s infinite",
                      }}>
                        ⏳ Syncing to Walrus...
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={idx}
                    onClick={() => onSelectReport(report)}
                    className={`tusk-report-card${isSelected ? " active" : ""}`}
                    style={report.isShared && !isSelected ? { borderColor: "var(--accent-blue)" } : undefined}
                  >
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.7rem",
                      color: "var(--text-primary)",
                      lineHeight: 1.5,
                    }}>
                      {report.topic || "Unknown Topic"}
                    </div>
                    {report.isShared && report.fromAddress && (
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.58rem",
                        color: "var(--accent-blue)",
                        opacity: 0.7,
                        lineHeight: 1.4,
                      }}>
                        from {report.fromAddress.slice(0, 6)}…{report.fromAddress.slice(-4)}
                      </div>
                    )}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontFamily: "var(--font-head)",
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      color: isSelected ? "var(--purple)" : report.isShared ? "var(--accent-blue)" : "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                        <rect x="3" y="11" width="18" height="11" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      {isSelected ? "SELECTED" : report.isShared ? "🔗 SHARED MEMORY" : "SEALED MEMORY"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Shared inbox — discovery via MongoDB sharedWith index */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "1rem" }}>
          <div className="tusk-section-head" style={{ margin: 0 }}>
            👥 SHARED MEMORY
          </div>
          <div className="tusk-archive-list">
            {sharedReports.length === 0 ? (
              <div style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                padding: "0.5rem 0",
              }}>
                — No shared journals yet.
              </div>
            ) : (
              sharedReports.map((report: any, idx) => {
                const isSelected = selectedReport?.blobId === report.blobId;
                return (
                  <div
                    key={`shared-${idx}`}
                    onClick={() => onSelectReport(report)}
                    className={`tusk-report-card${isSelected ? " active" : ""}`}
                    style={!isSelected ? { borderColor: "var(--accent-blue)" } : undefined}
                  >
                    <div style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.7rem",
                      color: "var(--text-primary)",
                      lineHeight: 1.5,
                    }}>
                      {report.topic || "Unknown Topic"}
                    </div>
                    {report.fromAddress && (
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.58rem",
                        color: "var(--accent-blue)",
                        opacity: 0.7,
                        lineHeight: 1.4,
                      }}>
                        from {report.fromAddress.slice(0, 6)}…{report.fromAddress.slice(-4)}
                      </div>
                    )}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontFamily: "var(--font-head)",
                      fontSize: "0.58rem",
                      fontWeight: 700,
                      color: isSelected ? "var(--purple)" : "var(--accent-blue)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                        <rect x="3" y="11" width="18" height="11" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      {isSelected ? "SELECTED" : "🔗 SHARED MEMORY"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="tusk-sidebar-footer">
        <div className="tusk-connected">
          <div className="tusk-dot" style={{ background: "var(--green)" }} />
          MEMWAL CONNECTED
        </div>
        <button
          onClick={onSwitchWalletAccount}
          className="tusk-btn tusk-btn-ghost"
          style={{ marginBottom: "0.4rem", width: "100%", color: "var(--accent-orange)", borderColor: "var(--accent-orange)" }}
        >
          SWITCH ACCOUNT
        </button>
        <button onClick={onDisconnect} className="tusk-btn tusk-btn-danger" style={{ width: "100%" }}>
          DISCONNECT
        </button>
      </div>
    </aside>
  );
}
