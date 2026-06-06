"use client";

import React from "react";

export interface ToolbarProps {
  topic: string;
  setTopic: (val: string) => void;
  isRunning: boolean;
  isArchiving: boolean;
  encryptedHistory: string | null;
  historyLength: number;
  policyObjectId: string;
  shareTargetReport: any;
  isEncrypting: boolean;
  isDecrypting: boolean;
  onRunCrew: () => void;
  onArchive: () => void;
  onSealJournal: () => void;
  onExport: () => void;
  onShare: () => void;
  onOpenSidebar: () => void;
}

export default function Toolbar({
  topic,
  setTopic,
  isRunning,
  isArchiving,
  encryptedHistory,
  historyLength,
  policyObjectId,
  shareTargetReport,
  isEncrypting,
  isDecrypting,
  onRunCrew,
  onArchive,
  onSealJournal,
  onExport,
  onShare,
  onOpenSidebar,
}: ToolbarProps) {
  return (
    <div className="tusk-toolbar">
      {/* Mobile hamburger */}
      <button
        className="tusk-hamburger"
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Topic input */}
      <div className="tusk-input-wrap">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Enter a DeFi protocol concept or idea…"
          className="tusk-input"
        />
      </div>

      {/* Action buttons */}
      <div className="tusk-toolbar-actions">
        <button
          onClick={onRunCrew}
          disabled={isRunning || isArchiving}
          className="tusk-btn tusk-btn-primary"
          title="Run Agents"
        >
          {isRunning ? (
            <>
              <span className="tusk-spinner" />
              <span className="btn-label">RUNNING…</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span className="btn-label">RUN AGENTS</span>
            </>
          )}
        </button>
        <button
          onClick={onArchive}
          disabled={isRunning || isArchiving || !encryptedHistory}
          className="tusk-btn tusk-btn-secondary"
          title="Archive encrypted memory to Walrus"
        >
          {isArchiving ? (
            <>
              <span className="tusk-spinner" />
              <span className="btn-label">ARCHIVING…</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="btn-label">ARCHIVE</span>
            </>
          )}
        </button>
      </div>

      {/* Sovereign Data Platform actions ─ second group */}
      <div className="tusk-toolbar-actions" style={{ borderLeft: "2px solid var(--border-dim)" }}>
        {/* SEAL JOURNAL — creates policy if needed, then encrypts */}
        <button
          onClick={onSealJournal}
          disabled={isEncrypting || isDecrypting || isRunning || historyLength === 0}
          className="tusk-btn"
          title={
            !policyObjectId
              ? "Step 1: create on-chain policy, Step 2: encrypt history with Seal"
              : encryptedHistory
              ? "Re-encrypt history with Seal"
              : "Encrypt history with Seal"
          }
          style={{ borderLeft: "2px solid var(--purple)", color: "var(--purple)" }}
        >
          {isEncrypting ? (
            <>
              <span className="tusk-spinner" />
              <span className="btn-label">SEALING…</span>
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
                <rect x="3" y="11" width="18" height="11" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span className="btn-label">
                {encryptedHistory ? "RE-SEAL" : "SEAL JOURNAL"}
              </span>
            </>
          )}
        </button>

        <button
          onClick={onExport}
          disabled={historyLength === 0}
          className="tusk-btn"
          title="Export history as JSON"
          style={{ borderLeft: "2px solid var(--green)", color: "var(--green)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="btn-label">EXPORT</span>
        </button>
        <button
          onClick={onShare}
          disabled={!(shareTargetReport?.policyId || policyObjectId) || !shareTargetReport}
          className="tusk-btn"
          title={
            !(shareTargetReport?.policyId || policyObjectId)
              ? "Seal a journal first to create an access policy"
              : !shareTargetReport
              ? "Archive the journal to Walrus before sharing"
              : "Share encrypted journal with another wallet"
          }
          style={{ borderLeft: "2px solid var(--accent-orange)", color: "var(--accent-orange)" }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          <span className="btn-label">SHARE</span>
        </button>
      </div>
    </div>
  );
}
