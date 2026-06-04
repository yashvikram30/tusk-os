"use client";

import React from "react";

export interface Board {
  id: string;
  name: string;
  topic: string;
}

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
  boards: Board[];
  activeBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onNewBoardClick: () => void;
  activeMode: string;
  onSelectMode: (mode: string) => void;
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
  boards,
  activeBoardId,
  onSelectBoard,
  onNewBoardClick,
  activeMode,
  onSelectMode,
}: SidebarProps) {
  const [boardsExpanded, setBoardsExpanded] = React.useState(false);
  const [archivedExpanded, setArchivedExpanded] = React.useState(false);
  const [sharedExpanded, setSharedExpanded] = React.useState(false);

  return (
    <aside className={`tusk-sidebar${sidebarOpen ? " is-open" : ""}`}>
      {/* Logo */}
      <div className="tusk-logo">
        <div className="tusk-logo-icon">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <polygon points="8,1 15,15 1,15" fill="#000" />
          </svg>
        </div>
        TUSKOS
      </div>

      {/* Scrollable body */}
      <div className="tusk-sidebar-scroll" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* SWARM MODE SELECTOR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderBottom: "1px solid var(--border-dim)", paddingBottom: "1rem" }}>
          <div 
            className="tusk-section-head" 
            style={{ 
              margin: 0, 
              fontSize: "0.62rem", 
              color: "var(--accent-orange)",
              letterSpacing: "0.1em",
              marginBottom: "0.4rem"
            }}
          >
            SWARM ENGINE MODE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              { id: "smart-contract-audit", label: "Code Audit" },
              { id: "defi-risk-analysis", label: "Risk Simulation" },
              { id: "enterprise-compliance", label: "Compliance Validation" }
            ].map((modeOpt) => {
              const isSelected = activeMode === modeOpt.id;
              return (
                <button
                  key={modeOpt.id}
                  onClick={() => onSelectMode(modeOpt.id)}
                  className="tusk-btn"
                  style={{
                    width: "100%",
                    fontSize: "0.65rem",
                    padding: "0.5rem 0.75rem",
                    justifyContent: "flex-start",
                    borderColor: isSelected ? "var(--purple)" : "var(--border-dim)",
                    background: isSelected ? "rgba(168,85,247,0.06)" : "var(--bg-ice)",
                    color: isSelected ? "var(--purple)" : "var(--text-muted)",
                    textAlign: "left"
                  }}
                >
                  {isSelected ? "● " : "○ "} {modeOpt.label.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Boards List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              marginBottom: "0.2rem",
              cursor: "pointer",
              userSelect: "none"
            }}
            onClick={() => setBoardsExpanded(!boardsExpanded)}
          >
            <div 
              className="tusk-section-head" 
              style={{ 
                margin: 0, 
                display: "flex", 
                alignItems: "center", 
                gap: "0.5rem",
                fontSize: "0.62rem",
                color: "var(--accent-orange)"
              }}
            >
              <span style={{ 
                display: "inline-block",
                fontSize: "0.5rem", 
                transition: "transform 0.15s ease", 
                transform: boardsExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                transformOrigin: "center"
              }}>▼</span>
              ACTIVE BOARDS
            </div>
          </div>
          
          {boardsExpanded && (
            <div className="tusk-archive-list" style={{ gap: "0.4rem" }}>
              <button
                onClick={onNewBoardClick}
                className="tusk-btn tusk-btn-ghost"
                style={{ 
                  width: "100%", 
                  fontSize: "0.62rem", 
                  padding: "0.5rem", 
                  color: "var(--accent-blue)", 
                  borderColor: "var(--accent-blue)",
                  marginBottom: "0.2rem"
                }}
                title="Create a new workspace board"
              >
                ＋ NEW BOARD
              </button>
              {boards.length === 0 ? (
                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  padding: "0.5rem 0",
                }}>
                  — No boards created yet.
                </div>
              ) : (
                boards.map((board) => {
                  const isActive = board.id === activeBoardId;
                  return (
                    <div
                      key={board.id}
                      onClick={() => onSelectBoard(board.id)}
                      className={`tusk-report-card${isActive ? " active" : ""}`}
                      style={{
                        padding: "0.6rem 0.75rem",
                        cursor: "pointer",
                        borderWidth: "2px",
                        borderColor: isActive ? "var(--purple)" : "var(--border-dim)",
                        background: isActive ? "rgba(168,85,247,0.04)" : "var(--bg-ice)"
                      }}
                    >
                      <div style={{
                        fontFamily: "var(--font-head)",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}>
                        <span>{board.name}</span>
                        {isActive && (
                          <span style={{
                            fontSize: "0.5rem",
                            color: "var(--purple)",
                            border: "1px solid var(--purple)",
                            padding: "1px 4px",
                            textTransform: "uppercase"
                          }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.58rem",
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {board.topic}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Own archived reports */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              marginBottom: "0.2rem",
              cursor: "pointer",
              userSelect: "none"
            }}
            onClick={() => setArchivedExpanded(!archivedExpanded)}
          >
            <div 
              className="tusk-section-head" 
              style={{ 
                margin: 0, 
                display: "flex", 
                alignItems: "center", 
                gap: "0.5rem",
                fontSize: "0.62rem",
                color: "var(--accent-orange)"
              }}
            >
              <span style={{ 
                display: "inline-block",
                fontSize: "0.5rem", 
                transition: "transform 0.15s ease", 
                transform: archivedExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                transformOrigin: "center"
              }}>▼</span>
              ARCHIVED REPORTS
            </div>
          </div>
          
          {archivedExpanded && (
            <div className="tusk-archive-list">
              <button
                onClick={onRebuildFromBlockchain}
                disabled={isRebuilding}
                className="tusk-btn tusk-btn-ghost"
                style={{ 
                  width: "100%", 
                  fontSize: "0.58rem", 
                  padding: "0.5rem", 
                  color: "var(--accent-orange)", 
                  borderColor: "var(--accent-orange)",
                  marginBottom: "0.2rem"
                }}
                title="Reconstruct your MongoDB index cache directly from decentralized ledger nodes"
              >
                {isRebuilding ? "🔄 REBUILDING…" : "🔄 REBUILD FROM BLOCKCHAIN"}
              </button>
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
          )}
        </div>

        {/* Shared inbox — discovery via MongoDB sharedWith index */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              cursor: "pointer",
              userSelect: "none",
              marginBottom: "0.2rem"
            }}
            onClick={() => setSharedExpanded(!sharedExpanded)}
          >
            <div 
              className="tusk-section-head" 
              style={{ 
                margin: 0, 
                display: "flex", 
                alignItems: "center", 
                gap: "0.5rem",
                fontSize: "0.62rem",
                color: "var(--accent-orange)"
              }}
            >
              <span style={{ 
                display: "inline-block",
                fontSize: "0.5rem", 
                transition: "transform 0.15s ease", 
                transform: sharedExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                transformOrigin: "center"
              }}>▼</span>
              SHARED MEMORY
            </div>
          </div>
          
          {sharedExpanded && (
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
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="tusk-sidebar-footer">
        <div style={{ display: "flex", gap: "0.5rem", width: "100%" }}>
          <button
            onClick={onSwitchWalletAccount}
            className="tusk-btn tusk-btn-ghost"
            style={{ flex: 1, color: "var(--accent-orange)", borderColor: "var(--accent-orange)", fontSize: "0.68rem", padding: "0.5rem" }}
          >
            SWITCH
          </button>
          <button 
            onClick={onDisconnect} 
            className="tusk-btn tusk-btn-danger" 
            style={{ flex: 1, fontSize: "0.68rem", padding: "0.5rem" }}
          >
            DISCONNECT
          </button>
        </div>
      </div>
    </aside>
  );
}
