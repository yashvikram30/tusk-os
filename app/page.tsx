"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import "./landing.css";

const WalletConnectFlow = dynamic(
  () => import("./components/WalletConnectFlow"),
  { ssr: false }
);

export default function LandingPage() {
  const account = useCurrentAccount();
  const selectedAddress = account?.address ?? null;
  const { mutate: disconnect } = useDisconnectWallet();
  const [isClient, setIsClient] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "1") {
      disconnect();
      setShowConnectModal(true);
      window.history.replaceState({}, "", "/");
    }
  }, [disconnect]);

  const openConnectFlow = () => setShowConnectModal(true);

  const launchDashboard = () => {
    if (selectedAddress) router.push("/dashboard");
  };

  if (!isClient) return null;

  return (
    <>

      {/* Scanlines */}
      <div className="tusk-scanlines" />

      {/* ── HEADER ── */}
      <header className="tusk-header">
        <div className="tusk-logo">
          <div className="tusk-logo-mark">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polygon points="7,1 13,13 1,13" fill="#000" />
            </svg>
          </div>
          TuskOS
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {selectedAddress ? (
            <>
              <div className="tusk-btn tusk-btn-wallet">
                {selectedAddress.slice(0, 6)}…{selectedAddress.slice(-4)}
              </div>
              <button onClick={openConnectFlow} className="tusk-btn tusk-btn-secondary">
                SWITCH ACCOUNT
              </button>
              <button onClick={() => disconnect()} className="tusk-btn tusk-btn-danger">
                DISCONNECT
              </button>
            </>
          ) : (
            <button onClick={openConnectFlow} className="tusk-btn tusk-btn-primary">
              CONNECT WALLET ↗
            </button>
          )}
        </nav>
      </header>

      {/* ── HERO ── */}
      <section className="tusk-hero">
        <div className="tusk-hero-left">
          <div className="tusk-ticker">
            <div className="tusk-ticker-dot" />
            LIVE · WALRUS TESTNET · SUI NETWORK
          </div>

          <h1 className="tusk-h1">
            LONG-TERM<br />
            <span>MEMORY</span><br />
            FOR AI<br />
            AGENTS
          </h1>

          <p className="tusk-hero-desc">
            TuskOS introduces a verifiable memory layer on Walrus — allowing
            agents to remember, share, and reuse information across sessions,
            permanently anchored on-chain.
          </p>

          <div className="tusk-hero-cta">
            <button
              onClick={launchDashboard}
              disabled={!selectedAddress}
              className="tusk-btn tusk-btn-primary"
              style={{ padding: "0.85rem 1.75rem", fontSize: "0.8rem" }}
            >
              LAUNCH TUSKOS ↗
            </button>

            <a
              href="#"
              className="tusk-btn tusk-btn-secondary"
              style={{ padding: "0.85rem 1.75rem", fontSize: "0.8rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.54-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 3-.4c1.02.005 2.04.14 3 .4 2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.82.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              GITHUB
            </a>
          </div>

          {!selectedAddress && (
            <p className="tusk-no-wallet">
              * Connect Slush wallet to access dashboard
            </p>
          )}
        </div>

        {/* Right — abstract line-art illustration */}
        <div className="tusk-hero-right">
          <div className="tusk-illustration">
            <svg width="100%" height="100%" viewBox="0 0 600 700" fill="none"
              xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.85 }}>
              {Array.from({ length: 13 }).map((_, i) => (
                <line key={`v${i}`} x1={i*50} y1="0" x2={i*50} y2="700" stroke="#2a2a2e" strokeWidth="1"/>
              ))}
              {Array.from({ length: 15 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={i*50} x2="600" y2={i*50} stroke="#2a2a2e" strokeWidth="1"/>
              ))}
              <rect x="175" y="225" width="250" height="250" stroke="#F8FAFC" strokeWidth="2"/>
              <circle cx="300" cy="350" r="90" stroke="#F8FAFC" strokeWidth="1.5" strokeDasharray="6 4"/>
              <polygon points="300,310 340,350 300,390 260,350" stroke="#FF4F00" strokeWidth="2" fill="rgba(255,79,0,0.06)"/>
              <circle cx="300" cy="350" r="6" fill="#FF4F00"/>
              <line x1="175" y1="215" x2="175" y2="235" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="165" y1="225" x2="185" y2="225" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="425" y1="215" x2="425" y2="235" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="415" y1="225" x2="435" y2="225" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="175" y1="465" x2="175" y2="485" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="165" y1="475" x2="185" y2="475" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="425" y1="465" x2="425" y2="485" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="415" y1="475" x2="435" y2="475" stroke="#FF4F00" strokeWidth="2"/>
              <line x1="300" y1="350" x2="175" y2="225" stroke="#2a2a2e" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1="300" y1="350" x2="425" y2="225" stroke="#2a2a2e" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1="300" y1="350" x2="175" y2="475" stroke="#2a2a2e" strokeWidth="1" strokeDasharray="4 4"/>
              <line x1="300" y1="350" x2="425" y2="475" stroke="#2a2a2e" strokeWidth="1" strokeDasharray="4 4"/>
              <rect x="50" y="500" width="100" height="130" stroke="#00E0FF" strokeWidth="2"/>
              <rect x="60" y="515" width="80" height="8" stroke="#00E0FF" strokeWidth="1" fill="rgba(0,224,255,0.05)"/>
              <rect x="60" y="530" width="80" height="8" stroke="#00E0FF" strokeWidth="1" fill="rgba(0,224,255,0.05)"/>
              <rect x="60" y="545" width="80" height="8" stroke="#00E0FF" strokeWidth="1" fill="rgba(0,224,255,0.05)"/>
              <rect x="60" y="560" width="50" height="8" stroke="#00E0FF" strokeWidth="1" fill="rgba(0,224,255,0.05)"/>
              <text x="100" y="496" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#00E0FF" letterSpacing="2">VAULT</text>
              <line x1="150" y1="530" x2="175" y2="475" stroke="#00E0FF" strokeWidth="1" strokeDasharray="3 3"/>
              <rect x="450" y="80" width="120" height="100" stroke="#F8FAFC" strokeWidth="2"/>
              <line x1="460" y1="100" x2="560" y2="100" stroke="#2a2a2e" strokeWidth="1"/>
              <line x1="460" y1="113" x2="540" y2="113" stroke="#2a2a2e" strokeWidth="1"/>
              <line x1="460" y1="126" x2="550" y2="126" stroke="#2a2a2e" strokeWidth="1"/>
              <line x1="460" y1="139" x2="530" y2="139" stroke="#2a2a2e" strokeWidth="1"/>
              <line x1="460" y1="152" x2="545" y2="152" stroke="#2a2a2e" strokeWidth="1"/>
              <text x="510" y="76" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#F8FAFC" letterSpacing="2">WHITEBOARD</text>
              <line x1="450" y1="140" x2="425" y2="225" stroke="#F8FAFC" strokeWidth="1" strokeDasharray="3 3"/>
              <rect x="30" y="100" width="90" height="90" stroke="#FF4F00" strokeWidth="2"/>
              <circle cx="75" cy="145" r="22" stroke="#FF4F00" strokeWidth="1.5" strokeDasharray="3 3"/>
              <circle cx="75" cy="145" r="6" fill="#FF4F00"/>
              <text x="75" y="96" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#FF4F00" letterSpacing="2">AGENT</text>
              <line x1="120" y1="145" x2="175" y2="225" stroke="#FF4F00" strokeWidth="1" strokeDasharray="3 3"/>
              <rect x="268" y="318" width="64" height="64" fill="none" stroke="#FF4F00" strokeWidth="1"/>
              <polygon points="300,326 324,358 276,358" fill="none" stroke="#FF4F00" strokeWidth="1.5"/>
              <circle cx="300" cy="350" r="18" stroke="#FF4F00" strokeWidth="1" opacity="0.4" strokeDasharray="2 4"/>
              <circle cx="200" cy="260" r="3" fill="#10b981"/>
              <circle cx="400" cy="260" r="3" fill="#10b981"/>
              <circle cx="200" cy="440" r="3" fill="#10b981"/>
              <circle cx="400" cy="440" r="3" fill="#FF4F00"/>
              <text x="178" y="222" fontFamily="IBM Plex Mono" fontSize="8" fill="#6b7280">0,0</text>
              <text x="408" y="222" fontFamily="IBM Plex Mono" fontSize="8" fill="#6b7280">1,0</text>
              <text x="178" y="492" fontFamily="IBM Plex Mono" fontSize="8" fill="#6b7280">0,1</text>
              <text x="408" y="492" fontFamily="IBM Plex Mono" fontSize="8" fill="#6b7280">1,1</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="tusk-features">
        {[
          { num: "01", title: "Decentralized Memory",
            desc: "Agents read and write state to MemWal namespaces instead of centralized databases. Every thought persists.", accent: false },
          { num: "02", title: "On-Chain Archival",
            desc: "Publish finalized executive reports to Walrus Testnet for permanent, verifiable, and tamper-proof storage.", accent: true },
          { num: "03", title: "Multi-Agent Collab",
            desc: "DeFi Architect, Red Team, and Blue Team agents debate protocol specs on a shared whiteboard to reach consensus.", accent: false },
        ].map(f => (
          <div key={f.title} className={`tusk-feature-card${f.accent ? " accent" : ""}`}>
            <div className="tusk-feature-num">{f.num} ——</div>
            <h3 className="tusk-feature-title">{f.title}</h3>
            <p className="tusk-feature-desc">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* ── FOOTER ── */}
      <footer className="tusk-footer">
        <div className="tusk-footer-chain">
          <span className="tusk-footer-tag">WALRUS</span>
          <span className="tusk-footer-tag">MEMWAL</span>
          <span className="tusk-footer-tag">SUI NETWORK</span>
        </div>
        <span className="tusk-footer-copy">© 2025 TUSKOS</span>
      </footer>

      <WalletConnectFlow
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
    </>
  );
}