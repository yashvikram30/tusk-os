"use client";

import { useEffect } from "react";
import { WalletProvider } from "./components/WalletProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (
        reason &&
        (String(reason).includes("MetaMask") ||
          (reason.message && String(reason.message).includes("MetaMask")))
      ) {
        event.preventDefault();
        console.warn(
          "Silenced MetaMask extension unhandled promise rejection:",
          reason
        );
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return <WalletProvider>{children}</WalletProvider>;
}
