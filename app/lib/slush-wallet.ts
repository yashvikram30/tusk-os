/**
 * Slush / Sui Wallet Standard utilities for TuskOS.
 * @see https://docs.sui.io/onchain-finance/asset-custody/wallets/slush
 * @see https://docs.sui.io/onchain-finance/asset-custody/wallets/wallet-standard
 */

import {
  SLUSH_WALLET_NAME,
  registerSlushWallet,
} from "@mysten/slush-wallet";

export { SLUSH_WALLET_NAME, registerSlushWallet };

export type WalletHandle = {
  name: string;
  icon?: string;
  accounts: ReadonlyArray<{ address: string; label?: string; publicKey?: unknown }>;
  features: Record<string, unknown>;
};

export type SelectableAccount = {
  address: string;
  label?: string;
};

const SESSION_KEY = "tuskos_wallet";
const PROVIDER_KEY = "tuskos_wallet_provider";
const SUI_TESTNET_CHAIN = "sui:testnet";

let slushWebUnregister: (() => void) | undefined;

/** Register Slush web wallet (extension auto-registers via Wallet Standard). */
export function initSlushWalletRegistry(appName = "TuskOS") {
  if (typeof window === "undefined") return;
  if (slushWebUnregister) return;

  const result = registerSlushWallet(appName);
  slushWebUnregister = result?.unregister;
}

export function isSlushWallet(wallet: WalletHandle): boolean {
  return wallet.name === SLUSH_WALLET_NAME;
}

/**
 * Prefer the Slush extension over the Slush web adapter when both exist.
 * Extension wallets populate accounts on load; web adapter is the fallback.
 */
export function resolveSlushWallet(wallets: WalletHandle[]): WalletHandle | null {
  const slushWallets = wallets.filter(isSlushWallet);
  if (slushWallets.length === 0) {
    return null;
  }
  if (slushWallets.length === 1) return slushWallets[0];
  return (
    slushWallets.find((w) => w.accounts.length > 0) ?? slushWallets[0]
  );
}

function accountLabel(acc: { label?: string }, index: number): string {
  if (acc.label?.trim()) return acc.label;
  return `Sui Account ${index + 1}`;
}

function mergeAccounts(...groups: WalletHandle["accounts"][]): SelectableAccount[] {
  const map = new Map<string, SelectableAccount>();
  let i = 0;
  for (const group of groups) {
    for (const acc of group) {
      if (!acc?.address) continue;
      const address = acc.address.toLowerCase();
      if (!map.has(address)) {
        map.set(address, { address, label: accountLabel(acc, i) });
        i++;
      }
    }
  }
  return Array.from(map.values());
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function collectAuthorizedAccounts(
  wallet: WalletHandle,
  connectResult?: { accounts?: WalletHandle["accounts"] }
): Promise<SelectableAccount[]> {
  const groups: WalletHandle["accounts"][] = [];
  if (connectResult?.accounts?.length) groups.push(connectResult.accounts);
  if (wallet.accounts?.length) groups.push([...wallet.accounts]);

  for (let i = 0; i < 8; i++) {
    await sleep(80 * (i + 1));
    if (wallet.accounts?.length) groups.push([...wallet.accounts]);
    const merged = mergeAccounts(...groups);
    if (merged.length > 0) return merged;
  }
  return mergeAccounts(...groups);
}

/** Prompt Slush connect UI; returns all authorized accounts (caller shows picker). */
export async function requestWalletAccounts(
  wallet: WalletHandle
): Promise<SelectableAccount[]> {
  const connect = wallet.features?.["standard:connect"] as
    | { connect: (input?: { silent?: boolean }) => Promise<{ accounts: WalletHandle["accounts"] }> }
    | undefined;

  if (!connect) {
    throw new Error(
      "Wallet does not support connect. Install Slush from slush.app or use the web wallet."
    );
  }

  let connectResult: { accounts?: WalletHandle["accounts"] } | undefined;
  try {
    connectResult = await connect.connect({ silent: false });
  } catch (firstErr) {
    try {
      connectResult = await connect.connect();
    } catch {
      throw firstErr;
    }
  }

  const accounts = await collectAuthorizedAccounts(wallet, connectResult);
  if (accounts.length === 0) {
    throw new Error(
      "No accounts authorized. Approve at least one account in Slush for this site."
    );
  }
  return accounts;
}

export async function ensureWalletReady(
  wallet: WalletHandle,
  selectedAddress: string
): Promise<void> {
  const connect = wallet.features?.["standard:connect"] as
    | { connect: (input?: { silent?: boolean }) => Promise<unknown> }
    | undefined;
  if (!connect) return;

  const selected = selectedAddress.toLowerCase();
  const hasSelected = wallet.accounts?.some(
    (a) => a.address?.toLowerCase() === selected
  );

  if (!wallet.accounts?.length || !hasSelected) {
    try {
      await connect.connect({ silent: false });
    } catch {
      try {
        await connect.connect();
      } catch {
        /* dismissed */
      }
    }
    await collectAuthorizedAccounts(wallet);
  }
}

export async function getWalletAccount(
  wallet: WalletHandle,
  selectedAddress: string
) {
  const selected = selectedAddress.toLowerCase();
  await ensureWalletReady(wallet, selected);

  const account = wallet.accounts?.find(
    (a) => a.address?.toLowerCase() === selected
  );
  if (!account) {
    throw new Error(
      `Account ${selected.slice(0, 8)}… is not authorized in Slush. Use Switch Account.`
    );
  }
  return account;
}

export type SignAndExecuteResult = {
  digest: string;
  objectChanges?: Array<{
    type?: string;
    objectType?: string;
    objectId?: string;
  }>;
  transactionBlock?: { digest?: string };
};

export async function signAndExecuteTransaction(
  wallet: WalletHandle,
  selectedAddress: string,
  tx: unknown
): Promise<SignAndExecuteResult> {
  const account = await getWalletAccount(wallet, selectedAddress);

  const modern = wallet.features?.["sui:signAndExecuteTransaction"] as
    | {
        signAndExecuteTransaction: (input: {
          transaction: unknown;
          chain: string;
          account: typeof account;
          options?: { showObjectChanges?: boolean };
        }) => Promise<{ digest: string }>;
      }
    | undefined;

  if (modern) {
    return modern.signAndExecuteTransaction({
      transaction: tx,
      chain: SUI_TESTNET_CHAIN,
      account,
      options: { showObjectChanges: true },
    });
  }

  const legacy = wallet.features?.["sui:signAndExecuteTransactionBlock"] as
    | {
        signAndExecuteTransactionBlock: (input: {
          transactionBlock: unknown;
          chain: string;
          account: typeof account;
          options?: { showObjectChanges?: boolean };
        }) => Promise<{ digest: string }>;
      }
    | undefined;

  if (legacy) {
    return legacy.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      chain: SUI_TESTNET_CHAIN,
      account,
      options: { showObjectChanges: true },
    });
  }

  throw new Error("Slush wallet does not support transaction execution.");
}

export async function signPersonalMessage(
  wallet: WalletHandle,
  selectedAddress: string,
  message: Uint8Array
): Promise<{ signature: string }> {
  const account = await getWalletAccount(wallet, selectedAddress);

  const pm = wallet.features?.["sui:signPersonalMessage"] as
    | {
        signPersonalMessage: (input: {
          message: Uint8Array;
          account: typeof account;
        }) => Promise<{ signature: string }>;
      }
    | undefined;

  if (pm) {
    const result = await pm.signPersonalMessage({ message, account });
    return { signature: result.signature };
  }

  const legacy = wallet.features?.["sui:signMessage"] as
    | {
        signMessage: (input: {
          message: Uint8Array;
          account: typeof account;
        }) => Promise<{ signature: string }>;
      }
    | undefined;

  if (legacy) {
    const result = await legacy.signMessage({ message, account });
    return { signature: result.signature };
  }

  throw new Error(
    "Slush wallet does not support personal message signing. Update Slush to the latest version."
  );
}

export function getStoredWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY)?.toLowerCase() ?? null;
}

export function persistWalletSession(address: string) {
  const normalized = address.toLowerCase();
  localStorage.setItem(SESSION_KEY, normalized);
  localStorage.setItem(PROVIDER_KEY, "slush");
  return normalized;
}

export function clearWalletSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PROVIDER_KEY);
}

export function formatAddress(address: string) {
  const a = address.toLowerCase();
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Dedupe wallets when registering (extension + web both named "Slush"). */
export function upsertWallet(
  list: WalletHandle[],
  wallet: WalletHandle
): WalletHandle[] {
  if (!wallet?.name || !isSlushWallet(wallet)) return list;

  const sameNameIdx = list.findIndex((w) => w.name === wallet.name);
  if (sameNameIdx < 0) return [...list, wallet];

  const existing = list[sameNameIdx];
  if (existing.accounts.length >= wallet.accounts.length) return list;
  const next = [...list];
  next[sameNameIdx] = wallet;
  return next;
}
