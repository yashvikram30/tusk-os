"use client";

import { useCallback, useEffect, useState } from "react";
import { formatAddress } from "../lib/slush-wallet";
import {
  useWallets,
  useConnectWallet,
  useAccounts,
  useSwitchAccount,
  useCurrentAccount,
} from "@mysten/dapp-kit";

type Step = "wallet" | "accounts";

export interface WalletConnectFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (address: string) => void;
}

export default function WalletConnectFlow({
  isOpen,
  onClose,
  onConnected,
}: WalletConnectFlowProps) {
  const wallets = useWallets();
  const { mutateAsync: connect } = useConnectWallet();
  const accounts = useAccounts();
  const { mutate: switchAccount } = useSwitchAccount();
  const activeAccount = useCurrentAccount();

  const hasSlush = wallets.some((w) => w.name === "Slush" || w.name.includes("Slush"));
  const selectedAddress = activeAccount?.address ?? null;

  const [step, setStep] = useState<Step>("wallet");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (activeAccount) {
        setStep("accounts");
      } else {
        setStep("wallet");
      }
      setError(null);
      setIsConnecting(false);
    }
  }, [isOpen, activeAccount]);

  const connectSlush = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const slushWallet = wallets.find((w) => w.name === "Slush" || w.name.includes("Slush"));
      if (!slushWallet) {
        throw new Error("Slush Wallet not found. Please install the extension.");
      }
      await connect({ wallet: slushWallet });
      setStep("accounts");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, [wallets, connect]);

  const selectAccount = (account: any) => {
    switchAccount({ account });
    onConnected?.(account.address);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        .wcf-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .wcf-modal {
          background: #000;
          border: 2px solid #F8FAFC;
          width: 90%;
          max-width: 440px;
          padding: 1.75rem;
          position: relative;
          box-shadow: 6px 6px 0 0 #FF4F00;
          font-family: 'IBM Plex Mono', monospace;
        }
        .wcf-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 900;
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #F8FAFC;
          margin: 0 0 0.35rem;
        }
        .wcf-desc {
          font-size: 0.72rem;
          color: #6b7280;
          line-height: 1.6;
          margin: 0 0 1.25rem;
        }
        .wcf-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: #6b7280;
          font-size: 1.1rem;
          cursor: pointer;
        }
        .wcf-close:hover { color: #F8FAFC; }
        .wcf-btn-slush {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 1rem 1.1rem;
          border: 2px solid #2a2a2e;
          background: #0d0d0f;
          color: #F8FAFC;
          cursor: pointer;
          transition: all 0.15s;
        }
        .wcf-btn-slush:hover:not(:disabled) {
          border-color: #a855f7;
          box-shadow: 4px 4px 0 #a855f7;
          transform: translate(-2px,-2px);
        }
        .wcf-btn-slush:disabled { opacity: 0.45; cursor: not-allowed; }
        .wcf-account {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.2rem;
          width: 100%;
          padding: 0.85rem 1rem;
          margin-bottom: 0.5rem;
          border: 2px solid #2a2a2e;
          background: #0d0d0f;
          color: #F8FAFC;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
        }
        .wcf-account:hover {
          border-color: #FF4F00;
          box-shadow: 3px 3px 0 #FF4F00;
          transform: translate(-2px,-2px);
        }
        .wcf-account.is-current { border-color: #10b981; }
        .wcf-account-label {
          font-size: 0.6rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .wcf-account-addr {
          font-size: 0.75rem;
          word-break: break-all;
        }
        .wcf-error {
          margin-top: 0.75rem;
          padding: 0.55rem 0.7rem;
          border: 2px solid #ef4444;
          color: #ef4444;
          font-size: 0.7rem;
        }
        .wcf-hint {
          font-size: 0.65rem;
          color: #6b7280;
          margin-top: 0.75rem;
          line-height: 1.5;
        }
        .wcf-detected {
          margin-top: 0.6rem;
          font-size: 0.62rem;
          color: #10b981;
          text-align: center;
        }
        .wcf-back {
          margin-top: 0.75rem;
          background: transparent;
          border: none;
          color: #6b7280;
          font-size: 0.68rem;
          cursor: pointer;
          text-decoration: underline;
        }
      `}</style>

      <div className="wcf-overlay" onClick={onClose}>
        <div className="wcf-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="wcf-close" onClick={onClose}>
            ✕
          </button>

          {step === "wallet" ? (
            <>
              <h2 className="wcf-title">Connect Slush</h2>
              <p className="wcf-desc">
                Official Sui wallet by Mysten Labs. Authorize accounts in Slush,
                then choose which address TuskOS uses for this session.
              </p>
              <button
                type="button"
                className="wcf-btn-slush"
                onClick={connectSlush}
                disabled={isConnecting}
              >
                <span>
                  {isConnecting ? "Opening Slush…" : "Connect Slush Wallet"}
                </span>
                <span style={{ color: "#c084fc" }}>SUI →</span>
              </button>
              {wallets.length > 0 && (
                <p className="wcf-detected">
                  ● {wallets.map((w) => w.name).join(", ")} available
                </p>
              )}
              {!hasSlush && wallets.length === 0 && (
                <p className="wcf-hint" style={{ marginTop: "0.75rem" }}>
                  Install the Slush extension from{" "}
                  <a
                    href="https://slush.app"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#c084fc" }}
                  >
                    slush.app
                  </a>{" "}
                  or connect via the Slush web wallet.
                </p>
              )}
              {error && <div className="wcf-error">{error}</div>}
            </>
          ) : (
            <>
              <h2 className="wcf-title">Select Account</h2>
              <p className="wcf-desc">
                Each account has its own workspace, policy, and journals on Sui
                Testnet.
              </p>
              {accounts.map((acc) => {
                const isCurrent =
                  selectedAddress?.toLowerCase() === acc.address.toLowerCase();
                return (
                  <button
                    key={acc.address}
                    type="button"
                    className={`wcf-account${isCurrent ? " is-current" : ""}`}
                    onClick={() => selectAccount(acc)}
                  >
                    <span className="wcf-account-label">
                      {acc.label || "Sui Account"}
                      {isCurrent ? " · current" : ""}
                    </span>
                    <span className="wcf-account-addr">{acc.address}</span>
                    <span
                      className="wcf-account-label"
                      style={{ color: "#10b981" }}
                    >
                      {formatAddress(acc.address)}
                    </span>
                  </button>
                );
              })}
              <p className="wcf-hint">
                Need another account? Open Slush, add or switch accounts, then
                tap below to re-authorize.
              </p>
              <button
                type="button"
                className="wcf-back"
                onClick={() => {
                  setStep("wallet");
                  setError(null);
                }}
              >
                ← Authorize more accounts in Slush
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
