"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRecord } from "tusk-memory";
import dynamic from "next/dynamic";
import {
  useCurrentAccount,
  useDisconnectWallet,
  useSignPersonalMessage,
  useSignAndExecuteTransaction,
  useSuiClient,
  useWallets,
} from "@mysten/dapp-kit";
import Sidebar, { Board } from "../components/Sidebar";
import Toolbar from "../components/Toolbar";
import Whiteboard from "../components/Whiteboard";
import "./dashboard.css";

const WalletConnectFlow = dynamic(
  () => import("../components/WalletConnectFlow"),
  { ssr: false }
);

// Dynamically import ShareModal (client-only — uses wallet/Sui SDK)
const ShareModal = dynamic(() => import("../components/ShareModal"), { ssr: false });
const NewBoardModal = dynamic(() => import("../components/NewBoardModal"), { ssr: false });

// The deployed Move package ID — update this after `sui client publish`
const PACKAGE_ID = process.env.NEXT_PUBLIC_TUSKOS_PACKAGE_ID || "";

type ChatMessage = {
  author: string;
  note: string;
};

export default function Dashboard() {
  const router = useRouter();
  const account = useCurrentAccount();
  const walletAddress = account?.address ?? null;
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutateAsync: signPersonalMessageFn } = useSignPersonalMessage();
  const { mutateAsync: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const wallets = useWallets();
  const hasSlush = wallets.some(w => w.name === "Slush" || w.name.includes("Slush"));

  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [topic, setTopic] = useState("A capital-efficient leverage yield aggregator on Sui");
  const [activeMode, setActiveMode] = useState<string>("smart-contract-audit");

  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>("default");
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);

  const [consensusReached, setConsensusReached] = useState<boolean | null>(null);
  const [debateIterations, setDebateIterations] = useState<number | null>(null);

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [archivedReports, setArchivedReports] = useState<any[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [liveStatus, setLiveStatus] = useState<{ text: string; color: string } | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Sovereign Data Platform state ────────────────────────────────────
  /** The JournalAccess object ID minted on-chain for this wallet */
  const [policyObjectId, setPolicyObjectId] = useState<string>("");
  /** Base64-encoded encrypted history blob */
  const [encryptedHistory, setEncryptedHistory] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // ── Selected Archived Report State ─────────────────────────────────────
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [selectedReportText, setSelectedReportText] = useState<string | null>(null);
  const [selectedReportHistory, setSelectedReportHistory] = useState<ChatMessage[]>([]);
  const [isReportUnsealed, setIsReportUnsealed] = useState(false);
  const [isFetchingReport, setIsFetchingReport] = useState(false);
  const [isDecryptingReport, setIsDecryptingReport] = useState(false);

  // For live history decrypt state
  const [isLiveHistoryUnsealed, setIsLiveHistoryUnsealed] = useState(false);

  // ── Shared Reports state ──
  const [sharedReports, setSharedReports] = useState<any[]>([]);
  const [isRebuilding, setIsRebuilding] = useState(false);

  const whiteboardRef = useRef<HTMLDivElement>(null);
  const walletAddressRef = useRef(walletAddress);
  useEffect(() => {
    walletAddressRef.current = walletAddress;
  }, [walletAddress]);

  const fetchHistory = async (wsId: string) => {
    try {
      const res = await fetch(`/api/history?workspace_id=${wsId}`);
      const data = await res.json();

      // Ignore stale wallet or board switches
      const currentAddress = walletAddressRef.current?.toLowerCase();
      const expectedWsId = activeBoardId === "default"
        ? `wallet_${currentAddress}`
        : `wallet_${currentAddress}_board_${activeBoardId}`;
      if (wsId !== expectedWsId) return;

      const raw = (data.history || []) as ChatMessage[];
      // Deduplicate inline (deduplicateHistory is defined after this fn in component scope)
      const seen = new Set<string>();
      const deduped = raw.filter(item => {
        const cleanedAuthor = item.author.split('___')[0];
        if (cleanedAuthor === 'System_Archive' || cleanedAuthor === 'SHARED_INBOX_GRANT') return false;
        const key = `${cleanedAuthor}|||${item.note}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setHistory(deduped);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  };

  const fetchUserReports = async (wsId: string) => {
    const address = wsId.replace("wallet_", "");
    await loadArchivedJournals(address);
  };

  /**
   * Loads all archived and shared journals for a given wallet address
   * by querying the fast MongoDB indexer route.
   */
  const loadArchivedJournals = async (address: string) => {
    const addressLower = address.toLowerCase();

    try {
      const res = await fetch(`/api/reports?wallet=${addressLower}`);
      if (!res.ok) return;
      const data = await res.json();

      // Ignore stale wallet switches
      const currentAddress = walletAddressRef.current?.toLowerCase();
      if (addressLower !== currentAddress) return;

      const allReports = (data.reports || []) as any[];

      // 1. Filter own archived reports (ownerAddress === wallet)
      const ownArchived = allReports.filter(
        (r: any) => r.ownerAddress.toLowerCase() === addressLower
      );

      // Overwrite the own archived reports state (preserving any active optimistic syncing items)
      setArchivedReports(prev => {
        const syncing = prev.filter((r: any) => r.isSyncing);
        return [...syncing, ...ownArchived];
      });

      // 2. Inbox: reports where this wallet is in sharedWith (not owned by them)
      const sharedWithMe = allReports
        .filter(
          (r: any) =>
            r.ownerAddress.toLowerCase() !== addressLower &&
            Array.isArray(r.sharedWith) &&
            r.sharedWith.some((a: string) => a.toLowerCase() === addressLower)
        )
        .map((r: any) => ({
          ...r,
          isShared: true,
          fromAddress: r.ownerAddress,
        }));

      setSharedReports(sharedWithMe);

    } catch (err) {
      console.error('Failed to load archived/shared reports:', err);
    }
  };

  useEffect(() => {
    if (!walletAddress) {
      router.push("/");
      return;
    }
    const normalizedAddress = walletAddress.toLowerCase();
    const wsId = activeBoardId === "default"
      ? `wallet_${normalizedAddress}`
      : `wallet_${normalizedAddress}_board_${activeBoardId}`;

    setWorkspaceId(wsId);
    fetchHistory(wsId);
    fetchUserReports(wsId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, activeBoardId, router]);

  // Load address-specific configurations from localStorage whenever walletAddress changes
  useEffect(() => {
    if (walletAddress) {
      const addressLower = walletAddress.toLowerCase();

      setArchivedReports([]);
      setSharedReports([]);

      // 1. Restore policy object ID
      const savedPolicy = localStorage.getItem(`tuskos_policy_${addressLower}`);
      setPolicyObjectId(savedPolicy || "");

      if (savedPolicy) {
        // Asynchronously verify that the policy object's on-chain package matches current PACKAGE_ID
        const checkPolicy = async () => {
          try {
            const { getSuiClient } = await import("../lib/seal");
            const suiClient = getSuiClient();
            const objDetails = await suiClient.getObject({
              id: savedPolicy,
              options: { showType: true }
            });
            if (objDetails.data && objDetails.data.type) {
              const typeStr = objDetails.data.type; // e.g. "0x5714...::journal_access::JournalAccess"
              const parts = typeStr.split("::");
              if (parts.length > 0 && parts[0].startsWith("0x")) {
                const policyPkg = parts[0].toLowerCase().replace(/^0x/, "").padStart(64, "0");
                const currentPkg = PACKAGE_ID.toLowerCase().replace(/^0x/, "").padStart(64, "0");
                if (policyPkg !== currentPkg) {
                  console.warn(`Policy object ${savedPolicy} package ID mismatch! Object belongs to ${parts[0]} but app is configured for ${PACKAGE_ID}. Resetting policy...`);
                  localStorage.removeItem(`tuskos_policy_${addressLower}`);
                  setPolicyObjectId("");
                  setLiveStatus({
                    text: "⚠️ On-chain policy mismatch detected (contract upgraded). Re-initializing policy...",
                    color: "orange"
                  });
                  setTimeout(() => setLiveStatus(null), 5000);
                }
              }
            } else {
              console.warn(`Policy object ${savedPolicy} not found on-chain. Resetting policy...`);
              localStorage.removeItem(`tuskos_policy_${addressLower}`);
              setPolicyObjectId("");
            }
          } catch (err) {
            console.error("Failed to verify on-chain policy package ID:", err);
          }
        };
        checkPolicy();
      }

      // 2. Restore boards list and active board ID
      const savedBoards = localStorage.getItem(`tuskos_boards_${addressLower}`);
      const initialBoards = savedBoards
        ? JSON.parse(savedBoards)
        : [
            {
              id: "default",
              name: "Default Workspace",
              topic: "A capital-efficient leverage yield aggregator on Sui",
            },
          ];
      setBoards(initialBoards);

      const savedActiveBoard = localStorage.getItem(`tuskos_active_board_${addressLower}`) || "default";
      const activeExists = initialBoards.some((b: any) => b.id === savedActiveBoard);
      const actualActiveBoard = activeExists ? savedActiveBoard : "default";
      setActiveBoardId(actualActiveBoard);

      const activeBoardObj = initialBoards.find((b: any) => b.id === actualActiveBoard);
      if (activeBoardObj) {
        setTopic(activeBoardObj.topic);
      }

      // 3. Restore board-specific encrypted history
      const savedEncrypted = localStorage.getItem(`tuskos_encrypted_${addressLower}_board_${actualActiveBoard}`);
      if (savedEncrypted) {
        setEncryptedHistory(savedEncrypted);
        setIsLiveHistoryUnsealed(false);
      } else {
        setEncryptedHistory(null);
        setIsLiveHistoryUnsealed(false);
      }

      // 4. Hydrate archived reports from server (own + shared index cache query)
      loadArchivedJournals(addressLower);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  useEffect(() => {
    if (whiteboardRef.current) {
      whiteboardRef.current.scrollTop = whiteboardRef.current.scrollHeight;
    }
  }, [history]);

  const switchWalletAccount = () => {
    setShowWalletModal(true);
  };

  const applyWalletSwitch = (address: string) => {
    const normalized = address.toLowerCase();
    
    // Load boards for the switched wallet
    const savedBoards = localStorage.getItem(`tuskos_boards_${normalized}`);
    const initialBoards = savedBoards
      ? JSON.parse(savedBoards)
      : [
          {
            id: "default",
            name: "Default Workspace",
            topic: "A capital-efficient leverage yield aggregator on Sui",
          },
        ];
    setBoards(initialBoards);

    const savedActiveBoard = localStorage.getItem(`tuskos_active_board_${normalized}`) || "default";
    const activeExists = initialBoards.some((b: any) => b.id === savedActiveBoard);
    const actualActiveBoard = activeExists ? savedActiveBoard : "default";
    setActiveBoardId(actualActiveBoard);

    const activeBoardObj = initialBoards.find((b: any) => b.id === actualActiveBoard);
    const currentTopic = activeBoardObj?.topic || "A capital-efficient leverage yield aggregator on Sui";
    setTopic(currentTopic);

    const wsId = actualActiveBoard === "default"
      ? `wallet_${normalized}`
      : `wallet_${normalized}_board_${actualActiveBoard}`;
    
    setWorkspaceId(wsId);
    setArchivedReports([]);
    setSharedReports([]);
    setSelectedReport(null);
    setHistory([]);
    setConsensusReached(null);
    setDebateIterations(null);
    setPolicyObjectId(localStorage.getItem(`tuskos_policy_${normalized}`) || "");
    setEncryptedHistory(localStorage.getItem(`tuskos_encrypted_${normalized}_board_${actualActiveBoard}`));
    fetchHistory(wsId);
    fetchUserReports(wsId);
  };

  const handleSelectBoard = (boardId: string) => {
    if (!walletAddress) return;
    const addressLower = walletAddress.toLowerCase();
    
    const targetBoard = boards.find(b => b.id === boardId);
    if (!targetBoard) return;

    setActiveBoardId(boardId);
    localStorage.setItem(`tuskos_active_board_${addressLower}`, boardId);
    setTopic(targetBoard.topic);

    setHistory([]);
    setSelectedReport(null);
    setSelectedReportText(null);
    setSelectedReportHistory([]);
    setIsReportUnsealed(false);
    setConsensusReached(null);
    setDebateIterations(null);
    
    const savedEncrypted = localStorage.getItem(`tuskos_encrypted_${addressLower}_board_${boardId}`);
    if (savedEncrypted) {
      setEncryptedHistory(savedEncrypted);
      setIsLiveHistoryUnsealed(false);
    } else {
      setEncryptedHistory(null);
      setIsLiveHistoryUnsealed(false);
    }
  };

  const handleCreateBoard = (name: string, topic: string) => {
    if (!walletAddress) return;
    const addressLower = walletAddress.toLowerCase();
    
    const newBoard = {
      id: `board_${Date.now()}`,
      name,
      topic,
    };
    
    const updatedBoards = [...boards, newBoard];
    setBoards(updatedBoards);
    localStorage.setItem(`tuskos_boards_${addressLower}`, JSON.stringify(updatedBoards));
    
    setActiveBoardId(newBoard.id);
    localStorage.setItem(`tuskos_active_board_${addressLower}`, newBoard.id);
    setTopic(newBoard.topic);

    setHistory([]);
    setSelectedReport(null);
    setSelectedReportText(null);
    setSelectedReportHistory([]);
    setIsReportUnsealed(false);
    setEncryptedHistory(null);
    setIsLiveHistoryUnsealed(false);
  };

  const handleSetTopic = (newTopic: string) => {
    setTopic(newTopic);
    if (!walletAddress) return;
    const addressLower = walletAddress.toLowerCase();
    const updatedBoards = boards.map(b => b.id === activeBoardId ? { ...b, topic: newTopic } : b);
    setBoards(updatedBoards);
    localStorage.setItem(`tuskos_boards_${addressLower}`, JSON.stringify(updatedBoards));
  };

  const handleDisconnect = () => {
    disconnect();
    router.push("/");
  };

  // Deduplicate messages by cleaned-author+note content to prevent intertwined repeats.
  // We strip the ___timestamp suffix so identical content from repeated runs is caught
  // even if stored with different timestamps.
  const deduplicateHistory = (items: ChatMessage[]): ChatMessage[] => {
    const seen = new Set<string>();
    return items.filter(item => {
      const cleanedAuthor = item.author.split('___')[0];
      if (cleanedAuthor === 'System_Archive' || cleanedAuthor === 'SHARED_INBOX_GRANT') return false;
      const key = `${cleanedAuthor}|||${item.note}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const runCrew = async () => {
    if (!workspaceId || !topic) return;
    setIsRunning(true);
    setSuccessBanner(null);
    // Clear previous session messages immediately so new run starts fresh
    setHistory([]);
    setEncryptedHistory(null);
    setConsensusReached(null);
    setDebateIterations(null);
    localStorage.removeItem(`tuskos_encrypted_${walletAddress?.toLowerCase()}_board_${activeBoardId}`);
    setIsLiveHistoryUnsealed(false);
    setLiveStatus({ text: "Running Actor-Critic Consensus Loop (Architect, Red Team, Blue Team)...", color: "blue" });
    try {
      const res = await fetch("/api/run_crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, topic, mode: activeMode }),
      });
      const data = await res.json();

      // Ignore stale wallet or board switches
      const currentAddress = walletAddressRef.current?.toLowerCase();
      const expectedWsId = activeBoardId === "default"
        ? `wallet_${currentAddress}`
        : `wallet_${currentAddress}_board_${activeBoardId}`;
      if (workspaceId !== expectedWsId) return;

      if (data.status === "success" && data.history) {
        setHistory(deduplicateHistory(data.history as ChatMessage[]));
        setConsensusReached(data.consensus);
        setDebateIterations(data.iterations);
      } else if (data.error) {
        alert(`Agent run failed: ${data.error}`);
      } else {
        alert("Failed to run agents.");
      }
    } catch (err) {
      console.error("Failed to run crew", err);
      alert("Error running agents.");
    } finally {
      setIsRunning(false);
      setLiveStatus(null);
    }
  };

  // ── Module 4: Export ────────────────────────────────────────────────
  const exportHistory = () => {
    if (history.length === 0) { alert("No history to export."); return; }
    const blob = new Blob([JSON.stringify({ topic, history }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tuskos_history_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── SEAL JOURNAL: Step-by-step = create policy (if needed) + encrypt ───
  //
  // Why combined: encrypting requires a policyObjectId, which requires an
  // on-chain transaction to create. Rather than making users click two
  // separate buttons and hit the "Create a policy first" error, this single
  // action handles both steps automatically with clear status feedback.
  //
  const sealJournal = async () => {
    if (history.length === 0) {
      alert("No agent history to seal. Run agents first.");
      return;
    }
    if (!PACKAGE_ID) {
      alert("NEXT_PUBLIC_TUSKOS_PACKAGE_ID is not set. Deploy the Move contract first.");
      return;
    }

    if (!hasSlush || !walletAddress) {
      alert("Connect Slush and select an account first.");
      return;
    }

    setIsEncrypting(true);

    try {
      // ── Step 1: Create on-chain access policy (if not already created) ──
      let activePolicyId = policyObjectId;

      if (!activePolicyId) {
        setLiveStatus({
          text: "Step 1/2 — Creating on-chain access policy…",
          color: "blue",
        });

        const { Transaction } = await import("@mysten/sui/transactions");
        const tx = new Transaction();
        tx.setSender(walletAddress!);
        tx.moveCall({
          target: `${PACKAGE_ID}::journal_access::create_policy`,
          arguments: [],
        });

        const executeResult = await signAndExecuteTransaction({ transaction: tx });
        const result = await suiClient.waitForTransaction({
          digest: executeResult.digest,
          options: {
            showObjectChanges: true,
          },
        });

        let created = result.objectChanges?.find(
          (c: any) => c.type === "created" && c.objectType?.includes("JournalAccess")
        );

        if (!(created as any)?.objectId) {
          const digest = result.digest;
          if (!digest) {
            throw new Error(
              "Policy transaction succeeded but no JournalAccess object or transaction digest was returned. " +
              "Check that the Move package is published correctly."
            );
          }

          setLiveStatus({
            text: "Step 1/2 — Confirming policy creation on-chain…",
            color: "blue",
          });

          const { getSuiClient } = await import("../lib/seal");
          const suiClient = getSuiClient();

          const txDetails = await suiClient.waitForTransaction({
            digest,
            options: {
              showObjectChanges: true,
            },
          });

          created = txDetails.objectChanges?.find(
            (c: any) => c.type === "created" && c.objectType?.includes("JournalAccess")
          );
        }

        if (!(created as any)?.objectId) {
          throw new Error(
            "Policy transaction succeeded but no JournalAccess object was returned. " +
            "Check that the Move package is published correctly."
          );
        }

        activePolicyId = (created as any).objectId;
        setPolicyObjectId(activePolicyId);
        localStorage.setItem(`tuskos_policy_${walletAddress?.toLowerCase()}`, activePolicyId);

        setLiveStatus({
          text: `✓ Policy created (${activePolicyId.slice(0, 10)}…). Starting encryption…`,
          color: "blue",
        });

        // Brief pause so the user can see the policy was created
        await new Promise(r => setTimeout(r, 800));
      }

      // ── Step 2: Encrypt history with Seal ──────────────────────────
      setLiveStatus({
        text: policyObjectId
          ? "Encrypting history with Seal threshold encryption…"
          : "Step 2/2 — Encrypting history with Seal threshold encryption…",
        color: "blue",
      });

      const { encryptAgentHistory, encryptedBytesToBase64 } = await import("../lib/seal");
      const plainText = JSON.stringify({ topic, history });
      const { encryptedBytes } = await encryptAgentHistory(
        plainText,
        activePolicyId,
        PACKAGE_ID
      );
      const b64 = encryptedBytesToBase64(encryptedBytes);
      setEncryptedHistory(b64);
      localStorage.setItem(`tuskos_encrypted_${walletAddress?.toLowerCase()}_board_${activeBoardId}`, b64);
      setHistory([]); // Wipe plain text from active React state!
      setIsLiveHistoryUnsealed(false);

      setLiveStatus({
        text: "✓ Journal sealed with Mysten Seal. Encrypted blob stored locally.",
        color: "green",
      });
      setTimeout(() => setLiveStatus(null), 5000);

    } catch (err: any) {
      console.error("Seal Journal error:", err);
      alert("Seal Journal failed: " + (err.message || String(err)));
      setLiveStatus(null);
    } finally {
      setIsEncrypting(false);
    }
  };


  // ── Module 3: Decrypt History ────────────────────────────────────────────
  //
  // Official Seal SDK flow (from MystenLabs/seal examples):
  //   1. SessionKey.create(...)
  //   2. wallet.signPersonalMessage(sessionKey.getPersonalMessage())
  //   3. sessionKey.setPersonalMessageSignature(signature)
  //   4. Build tx calling seal_approve, get txBytes
  //   5. sealClient.decrypt({ data, sessionKey, txBytes })
  //
  const decryptHistory = async () => {
    const b64 =
      encryptedHistory ||
      localStorage.getItem(`tuskos_encrypted_${walletAddress?.toLowerCase()}_board_${activeBoardId}`);
    if (!b64) {
      alert("No encrypted history found. Seal your history first.");
      return;
    }
    if (!policyObjectId) {
      alert("Policy object ID not set. Create a policy first.");
      return;
    }
    if (!PACKAGE_ID) {
      alert("NEXT_PUBLIC_TUSKOS_PACKAGE_ID is not set. See README.");
      return;
    }

    if (!walletAddress) {
      alert("Connect wallet first.");
      return;
    }

    setIsDecrypting(true);
    setLiveStatus({
      text: "Requesting wallet signature for Seal session key…",
      color: "blue",
    });

    try {
      const { decryptAgentHistory, base64ToEncryptedBytes } = await import("../lib/seal");
      const encryptedBytes = base64ToEncryptedBytes(b64);

      // signPersonalMessage is the correct Seal SDK authentication method.
      // The session key generates a personal message; the wallet signs it;
      // the signature proves to Seal key servers that we own this address.
      const plainText = await decryptAgentHistory(
        encryptedBytes,
        policyObjectId,
        PACKAGE_ID,
        walletAddress!,
        async (msg: Uint8Array) => {
          const res = await signPersonalMessageFn({ message: msg });
          return { signature: res.signature };
        }
      );

      const parsed = JSON.parse(plainText);
      setHistory(parsed.history || []);
      setIsLiveHistoryUnsealed(true);
      setLiveStatus({
        text: "✓ History unsealed and decrypted successfully.",
        color: "green",
      });
      setTimeout(() => setLiveStatus(null), 5000);
    } catch (err: any) {
      console.error("Decryption error:", err);
      alert("Decryption failed: " + (err.message || String(err)));
      setLiveStatus(null);
    } finally {
      setIsDecrypting(false);
    }
  };

  // ── Selected Report Management ──────────────────────────────────────────
  const selectReport = async (report: any) => {
    setSelectedReport(report);
    setSelectedReportText(null);
    setSelectedReportHistory([]);   // clear previous report's decrypted content
    setIsReportUnsealed(false);
    setIsFetchingReport(true);
    try {
      const res = await fetch(`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${report.blobId}`);
      if (!res.ok) throw new Error("Failed to fetch report from Walrus");
      const text = await res.text();
      
      setSelectedReport((current: any) => {
        if (current && current.blobId === report.blobId) {
          setSelectedReportText(text);
          setIsFetchingReport(false);
        }
        return current;
      });
    } catch (err) {
      setSelectedReport((current: any) => {
        if (current && current.blobId === report.blobId) {
          console.error(err);
          alert("Failed to load report from Walrus");
          setIsFetchingReport(false);
        }
        return current;
      });
    }
  };

  const unsealReport = async () => {
    if (!selectedReport || !selectedReportText) return;

    // Shared reports must be decrypted with the CREATOR's JournalAccess policyId,
    // not the current viewer's policyObjectId. If selectedReport.policyId is missing
    // (e.g. manually imported via Blob ID), we can use a placeholder because
    // decryptAgentHistory extracts the actual policy ID from the encrypted bytes.
    const effectivePolicyId = selectedReport.isShared
      ? selectedReport.policyId
      : policyObjectId;

    if (!effectivePolicyId) {
      alert(
        selectedReport.isShared
          ? "This shared report is missing a policy ID in the index. Ask the owner to re-share, or use Rebuild from Blockchain."
          : "Policy object ID not set. Seal a journal first to create a policy."
      );
      return;
    }

    if (!walletAddress) {
      alert("Connect wallet first.");
      return;
    }

    setIsDecryptingReport(true);
    try {
      const { decryptAgentHistory, base64ToEncryptedBytes } = await import("../lib/seal");
      const encryptedBytes = base64ToEncryptedBytes(selectedReportText);

      const plainText = await decryptAgentHistory(
        encryptedBytes,
        effectivePolicyId,
        PACKAGE_ID,
        walletAddress!,
        async (msg: Uint8Array) => {
          const res = await signPersonalMessageFn({ message: msg });
          return { signature: res.signature };
        }
      );

      const parsed = JSON.parse(plainText);
      setSelectedReportHistory(parsed.history || []);
      setIsReportUnsealed(true);
    } catch (err: any) {
      console.error("Authorization failed:", err);
      alert("Authorization failed: " + (err.message || String(err)));
    } finally {
      setIsDecryptingReport(false);
    }
  };

  const archiveEncryptedPayload = async () => {
    if (!workspaceId || !encryptedHistory || !walletAddress || !policyObjectId) {
      alert("Please ensure your journal is sealed and policy is initialized first.");
      return;
    }
    setIsArchiving(true);
    setSuccessBanner(null);

    // 1. Optimistic UI: Immediately add a temporary syncing item to the sidebar
    const tempId = "temp-" + Date.now();
    const tempReport = {
      blobId: tempId,
      topic: topic,
      isSyncing: true,
    };
    setArchivedReports(prev => [tempReport, ...prev]);

    try {
      const res = await fetch("/api/generate_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaceId,
          topic,
          encryptedData: encryptedHistory,
          owner_address: walletAddress.toLowerCase(),
          policy_id: policyObjectId
        }),
      });
      const data = await res.json();
      if (data.status === "success" && data.blobId) {
        setSuccessBanner(data.blobId);
        // Clear active encrypted history since it has been uploaded/archived
        setEncryptedHistory(null);
        localStorage.removeItem(`tuskos_encrypted_${walletAddress.toLowerCase()}_board_${activeBoardId}`);
        
        // Optimistic UI Swap: replace the syncing item with the actual report card instantly
        const realReport = {
          blobId: data.blobId,
          topic: topic,
          ownerAddress: walletAddress.toLowerCase(),
          policyId: policyObjectId,
          sharedWith: [],
          timestamp: new Date()
        };
        setArchivedReports(prev => prev.map(r => r.blobId === tempId ? realReport : r));

        // Fetch actual updated reports list in background to ensure sync
        await loadArchivedJournals(walletAddress);
      } else {
        alert("Upload Failed: " + (data.error || "Unknown error"));
        // Remove temp report on failure
        setArchivedReports(prev => prev.filter(r => r.blobId !== tempId));
      }
    } catch (err) {
      console.error("Archive report error", err);
      alert("Upload Failed: " + (err instanceof Error ? err.message : String(err)));
      // Remove temp report on failure
      setArchivedReports(prev => prev.filter(r => r.blobId !== tempId));
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRebuildFromBlockchain = async () => {
    if (!walletAddress) return;
    setIsRebuilding(true);
    try {
      const res = await fetch("/api/admin/sync_ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress }),
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        alert(`✓ Database rebuilt successfully! Synchronized ${data.upserted} report records from the decentralized network.`);
        await loadArchivedJournals(walletAddress);
      } else {
        alert("Rebuild Failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Rebuild error", err);
      alert("Rebuild Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRebuilding(false);
    }
  };

  if (!walletAddress) return null;

  // Journal to share: selected own archive, else most recent archived blob
  const shareTargetReport =
    selectedReport &&
    !selectedReport.isShared &&
    selectedReport.blobId &&
    !selectedReport.isSyncing
      ? selectedReport
      : archivedReports.find((r: any) => r.blobId && !r.isSyncing) ?? null;

  return (
    <>
      {/* Scanlines */}
      <div className="tusk-scanlines" />

      {/* Mobile overlay */}
      <div
        className={`tusk-overlay${sidebarOpen ? " is-open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <div className="tusk-shell">
        <Sidebar
          walletAddress={walletAddress}
          workspaceId={workspaceId}
          archivedReports={archivedReports}
          sharedReports={sharedReports}
          selectedReport={selectedReport}
          isRebuilding={isRebuilding}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          onSelectReport={selectReport}
          onRebuildFromBlockchain={handleRebuildFromBlockchain}
          onSwitchWalletAccount={switchWalletAccount}
          onDisconnect={handleDisconnect}
          boards={boards}
          activeBoardId={activeBoardId}
          onSelectBoard={handleSelectBoard}
          onNewBoardClick={() => setShowNewBoardModal(true)}
          activeMode={activeMode}
          onSelectMode={setActiveMode}
        />

        <main className="tusk-main">
          <Toolbar
            topic={topic}
            setTopic={handleSetTopic}
            isRunning={isRunning}
            isArchiving={isArchiving}
            encryptedHistory={encryptedHistory}
            historyLength={history.length}
            policyObjectId={policyObjectId}
            shareTargetReport={shareTargetReport}
            isEncrypting={isEncrypting}
            isDecrypting={isDecrypting}
            onRunCrew={runCrew}
            onArchive={archiveEncryptedPayload}
            onSealJournal={sealJournal}
            onExport={exportHistory}
            onShare={() => setShowShareModal(true)}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          <Whiteboard
            whiteboardRef={whiteboardRef}
            selectedReport={selectedReport}
            setSelectedReport={setSelectedReport}
            isFetchingReport={isFetchingReport}
            isReportUnsealed={isReportUnsealed}
            selectedReportHistory={selectedReportHistory}
            isDecryptingReport={isDecryptingReport}
            onUnsealReport={unsealReport}
            successBanner={successBanner}
            liveStatus={liveStatus}
            history={history}
            encryptedHistory={encryptedHistory}
            isLiveHistoryUnsealed={isLiveHistoryUnsealed}
            isDecrypting={isDecrypting}
            onDecryptHistory={decryptHistory}
            consensusReached={consensusReached}
            debateIterations={debateIterations}
          />
        </main>
      </div>

      {/* Share Modal — Module 4 */}
      {showShareModal && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          policyObjectId={shareTargetReport?.policyId || policyObjectId}
          blobId={shareTargetReport?.blobId}
          reportTopic={shareTargetReport?.topic}
          packageId={PACKAGE_ID}
          walletAddress={walletAddress!}
          onShareComplete={() => {
            if (walletAddress) loadArchivedJournals(walletAddress);
          }}
          signAndExecuteTransaction={async (tx) => {
            const res = await signAndExecuteTransaction({ transaction: tx });
            return res;
          }}
        />
      )}

      <WalletConnectFlow
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnected={(address) => {
          applyWalletSwitch(address);
          setShowWalletModal(false);
        }}
      />

      <NewBoardModal
        isOpen={showNewBoardModal}
        onClose={() => setShowNewBoardModal(false)}
        onCreate={handleCreateBoard}
      />
    </>
  );
}
