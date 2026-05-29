/**
 * ShareModal — Secure Cryptographic Sharing Flow
 * ────────────────────────────────────────────────
 * 1. On-chain: grant_access / revoke_access on JournalAccess (Move)
 * 2. Indexing: POST /api/share_report → MongoDB sharedWith + MemWal inbox pointer
 */
"use client";
import { useState } from "react";
import { Transaction } from "@mysten/sui/transactions";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyObjectId: string;
  packageId: string;
  walletAddress: string;
  /** Archived journal blob on Walrus — scopes MongoDB indexing to this report */
  blobId?: string;
  reportTopic?: string;
  signAndExecuteTransaction: (tx: Transaction) => Promise<{ digest: string }>;
  onShareComplete?: () => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  policyObjectId,
  packageId,
  walletAddress,
  blobId,
  reportTopic,
  signAndExecuteTransaction,
  onShareComplete,
}: ShareModalProps) {
  const [targetAddress, setTargetAddress] = useState("");
  const [isTxPending, setIsTxPending] = useState(false);
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [indexMessage, setIndexMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAlreadySharedOnChain = (err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      msg.includes("abort code: 3") ||
      msg.includes("EAlreadyShared") ||
      (msg.includes("MoveAbort") && msg.includes("grant_access"))
    );
  };

  const registerShareIndex = async (
    action: "grant" | "revoke",
    recipient: string
  ): Promise<void> => {
    const res = await fetch("/api/share_report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientAddress: recipient,
        senderAddress: walletAddress.toLowerCase(),
        policyId: policyObjectId,
        blobId: blobId || undefined,
        topic: reportTopic,
        action,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update share index");
    }

    if (action === "grant") {
      if (data.indexed) {
        setIndexMessage(
          blobId
            ? `Recipient can discover this journal (blob ${blobId.slice(0, 8)}…) in their SHARED MEMORY inbox.`
            : `Indexed ${data.modifiedCount} archived report(s) for the recipient's dashboard.`
        );
      } else {
        setIndexMessage(
          "On-chain access granted, but no MongoDB report was indexed. Archive the journal first, then share again."
        );
      }
    } else {
      setIndexMessage(
        data.modifiedCount > 0
          ? "Share index updated — recipient will no longer see this in their inbox."
          : "On-chain access revoked."
      );
    }
  };

  const handleGrant = async () => {
    if (!targetAddress.trim().startsWith("0x")) {
      setError("Enter a valid Sui address (starts with 0x)");
      return;
    }
    if (!policyObjectId) {
      setError("No policy object found. Seal a journal first to create a policy.");
      return;
    }
    if (!blobId) {
      setError(
        "Archive this journal to Walrus first. Recipients need a blob ID in the index to discover and decrypt it."
      );
      return;
    }

    setIsTxPending(true);
    setError(null);
    setTxDigest(null);
    setIndexMessage(null);

    try {
      let chainConfirmed = false;

      try {
        const tx = new Transaction();
        tx.setSender(walletAddress);
        tx.moveCall({
          target: `${packageId}::journal_access::grant_access`,
          arguments: [
            tx.object(policyObjectId),
            tx.pure.address(targetAddress.trim()),
          ],
        });

        const result = await signAndExecuteTransaction(tx);
        setTxDigest(result.digest);
        chainConfirmed = true;
      } catch (chainErr: unknown) {
        if (isAlreadySharedOnChain(chainErr)) {
          setIndexMessage(
            "Recipient already has on-chain access. Syncing inbox index…"
          );
          chainConfirmed = true;
        } else {
          throw chainErr;
        }
      }

      if (chainConfirmed) {
        await registerShareIndex("grant", targetAddress.trim());
        onShareComplete?.();
      }
    } catch (err: unknown) {
      setTxDigest(null);
      setError(err instanceof Error ? err.message : "Share failed");
    } finally {
      setIsTxPending(false);
    }
  };

  const handleRevoke = async () => {
    if (!targetAddress.trim().startsWith("0x")) {
      setError("Enter a valid Sui address to revoke");
      return;
    }

    setIsTxPending(true);
    setError(null);
    setTxDigest(null);
    setIndexMessage(null);

    try {
      const tx = new Transaction();
      tx.setSender(walletAddress);
      tx.moveCall({
        target: `${packageId}::journal_access::revoke_access`,
        arguments: [
          tx.object(policyObjectId),
          tx.pure.address(targetAddress.trim()),
        ],
      });

      const result = await signAndExecuteTransaction(tx);
      setTxDigest(result.digest);

      try {
        await registerShareIndex("revoke", targetAddress.trim());
      } catch (indexErr) {
        console.error("Failed to update share index after revoke:", indexErr);
        setIndexMessage(
          "On-chain access revoked. Share index may be stale until the recipient rebuilds."
        );
      }
      onShareComplete?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Revoke transaction failed");
    } finally {
      setIsTxPending(false);
    }
  };

  return (
    <>
      <style>{`
        .share-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: shareIn 0.2s ease-out;
        }
        @keyframes shareIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .share-modal {
          background: #000;
          border: 2px solid #F8FAFC;
          width: 90%;
          max-width: 460px;
          padding: 2rem;
          position: relative;
          box-shadow: 6px 6px 0 0 #FF4F00;
          animation: shareSlide 0.25s cubic-bezier(0.16,1,0.3,1);
          font-family: 'IBM Plex Mono', monospace;
        }
        @keyframes shareSlide {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .share-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 900;
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #F8FAFC;
          margin: 0 0 0.35rem;
        }
        .share-desc {
          font-size: 0.72rem;
          color: #6b7280;
          margin: 0 0 1.5rem;
          line-height: 1.6;
        }
        .share-label {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #6b7280;
          margin-bottom: 0.4rem;
        }
        .share-input {
          width: 100%;
          background: #0d0d0f;
          border: 2px solid #2a2a2e;
          color: #F8FAFC;
          padding: 0.65rem 0.9rem;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.78rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .share-input:focus {
          border-color: #F8FAFC;
        }
        .share-input::placeholder {
          color: #6b7280;
        }
        .share-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.25rem;
        }
        .share-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 900;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 0.65rem 1.1rem;
          border: 2px solid;
          background: #000;
          cursor: pointer;
          transition: transform 0.1s ease, background 0.1s ease;
          flex: 1;
        }
        .share-btn:hover:not(:disabled) {
          transform: translate(-2px, -2px);
        }
        .share-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .share-btn-grant  { border-color: #10b981; color: #10b981; }
        .share-btn-grant:hover:not(:disabled)  { background: rgba(16,185,129,0.07); }
        .share-btn-revoke { border-color: #ef4444; color: #ef4444; }
        .share-btn-revoke:hover:not(:disabled) { background: rgba(239,68,68,0.07); }
        .share-btn-cancel { border-color: #2a2a2e; color: #6b7280; flex: 0 0 auto; }
        .share-btn-cancel:hover { background: #0d0d0f; }
        .share-error {
          margin-top: 0.85rem;
          padding: 0.6rem 0.75rem;
          border: 2px solid #ef4444;
          background: rgba(239,68,68,0.05);
          color: #ef4444;
          font-size: 0.72rem;
          line-height: 1.5;
        }
        .share-success {
          margin-top: 0.85rem;
          padding: 0.6rem 0.75rem;
          border: 2px solid #10b981;
          background: rgba(16,185,129,0.05);
          color: #10b981;
          font-size: 0.72rem;
          line-height: 1.5;
        }
        .share-info {
          margin-top: 0.85rem;
          padding: 0.6rem 0.75rem;
          border: 2px solid #3b82f6;
          background: rgba(59,130,246,0.05);
          color: #93c5fd;
          font-size: 0.68rem;
          line-height: 1.5;
        }
        .share-close {
          position: absolute;
          top: 0.85rem;
          right: 0.85rem;
          background: transparent;
          border: none;
          color: #6b7280;
          font-size: 1.1rem;
          cursor: pointer;
          transition: color 0.15s;
          line-height: 1;
          padding: 0.25rem;
        }
        .share-close:hover { color: #F8FAFC; }
        .share-policy-info {
          font-size: 0.65rem;
          color: #6b7280;
          border-left: 2px solid #2a2a2e;
          padding: 0.4rem 0.65rem;
          margin-bottom: 1.25rem;
          word-break: break-all;
          line-height: 1.6;
        }
      `}</style>

      <div className="share-overlay" onClick={onClose}>
        <div className="share-modal" onClick={(e) => e.stopPropagation()}>
          <button className="share-close" onClick={onClose}>
            ✕
          </button>

          <h2 className="share-title">Share Journal Access</h2>
          <p className="share-desc">
            Grants on-chain decrypt permission via Move, then indexes the recipient in
            MongoDB so they can discover this Walrus blob in their SHARED MEMORY inbox.
          </p>

          {reportTopic && blobId && (
            <div className="share-policy-info">
              <strong
                style={{
                  color: "#FF4F00",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: "0.58rem",
                  letterSpacing: "0.15em",
                }}
              >
                JOURNAL TO SHARE
              </strong>
              <br />
              {reportTopic}
              <br />
              <span style={{ opacity: 0.7 }}>blob {blobId.slice(0, 12)}…</span>
            </div>
          )}

          {policyObjectId && (
            <div className="share-policy-info">
              <strong
                style={{
                  color: "#FF4F00",
                  fontFamily: "Space Grotesk, sans-serif",
                  fontSize: "0.58rem",
                  letterSpacing: "0.15em",
                }}
              >
                POLICY OBJECT (Seal identity)
              </strong>
              <br />
              {policyObjectId}
            </div>
          )}

          <div className="share-label">Recipient Sui Wallet Address</div>
          <input
            className="share-input"
            type="text"
            value={targetAddress}
            onChange={(e) => setTargetAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
          />

          <div className="share-actions">
            <button
              className="share-btn share-btn-grant"
              onClick={handleGrant}
              disabled={isTxPending || !targetAddress}
            >
              {isTxPending ? "PENDING…" : "✓ GRANT ACCESS"}
            </button>
            <button
              className="share-btn share-btn-revoke"
              onClick={handleRevoke}
              disabled={isTxPending || !targetAddress}
            >
              {isTxPending ? "PENDING…" : "✕ REVOKE"}
            </button>
            <button className="share-btn share-btn-cancel" onClick={onClose}>
              CANCEL
            </button>
          </div>

          {error && <div className="share-error">⚠ {error}</div>}
          {txDigest && (
            <div className="share-success">
              ✓ On-chain transaction confirmed
              <br />
              <a
                href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#10b981",
                  textDecoration: "underline",
                  fontSize: "0.68rem",
                  wordBreak: "break-all",
                }}
              >
                {txDigest}
              </a>
            </div>
          )}
          {indexMessage && <div className="share-info">{indexMessage}</div>}
        </div>
      </div>
    </>
  );
}
