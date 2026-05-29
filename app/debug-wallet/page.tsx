"use client";

import { 
  useCurrentAccount, 
  useConnectWallet, 
  useDisconnectWallet, 
  useWallets 
} from "@mysten/dapp-kit";

export default function DebugWalletPage() {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  const isConnected = !!account;

  const handleConnect = () => {
    // Find the Slush wallet in the injected list and connect to it
    const slushWallet = wallets.find((w) => w.name === "Slush" || w.name.includes("Slush"));
    if (slushWallet) {
      connect({ wallet: slushWallet });
    } else {
      alert("Slush Wallet not found. Please install the extension.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-8">
      <div className="p-8 border border-[#FF4F00] bg-[rgba(13,13,15,0.75)] backdrop-blur-md rounded-lg shadow-[4px_4px_0px_#FF4F00] max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6 font-mono text-[#A855F7]">Wallet Debug</h1>
        
        <div className="mb-8">
          <p className="text-sm text-gray-400 mb-2">Status:</p>
          {isConnected ? (
            <span className="text-[#10B981] font-mono bg-green-900/30 px-3 py-1 rounded">Connected</span>
          ) : (
            <span className="text-red-500 font-mono bg-red-900/30 px-3 py-1 rounded">Disconnected</span>
          )}
        </div>

        {isConnected && (
          <div className="mb-8">
            <p className="text-sm text-gray-400 mb-2">Active Address:</p>
            <p className="font-mono text-sm break-all bg-black/50 p-3 border border-gray-800 rounded">
              {account?.address}
            </p>
          </div>
        )}

        <button
          onClick={isConnected ? () => disconnect() : handleConnect}
          className="w-full py-3 px-4 border-2 border-[#FF4F00] text-[#FF4F00] font-bold uppercase hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[4px_4px_0px_#FF4F00] transition-all"
        >
          {isConnected ? "Disconnect" : "Connect Slush Wallet"}
        </button>
      </div>
    </div>
  );
}
