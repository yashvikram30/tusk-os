"use client";

import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createNetworkConfig, SuiClientProvider, WalletProvider as DAppKitProvider } from "@mysten/dapp-kit";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { registerSlushWallet } from "@mysten/slush-wallet";

// DApp Kit requires React Query to manage async wallet states
const queryClient = new QueryClient();

// Configure the network (TuskOS uses Testnet)
const { networkConfig } = createNetworkConfig({
  testnet: { 
    url: getJsonRpcFullnodeUrl("testnet"),
    network: "testnet"
  },
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  
  useEffect(() => {
    // 1. Register Slush so DApp Kit can detect it in the browser
    registerSlushWallet("TuskOS");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        {/* autoConnect=true automatically restores the active session on refresh */}
        <DAppKitProvider autoConnect={true}>
          {children}
        </DAppKitProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}
