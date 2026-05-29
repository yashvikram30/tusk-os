/**
 * TuskOS — Seal SDK Encryption / Decryption Utilities
 * ─────────────────────────────────────────────────────
 * Module 2 (Encryption) + Module 3 (Decryption)
 *
 * Uses:
 *   - @mysten/sui  — Sui TypeScript SDK + Transaction building
 *   - @mysten/seal — Threshold encryption via Seal key servers
 *
 * ─── OFFICIAL PATTERN (from MystenLabs/seal examples) ───────────────────────
 *
 * ENCRYPT:
 *   client.encrypt({ threshold, packageId, id: "0x<hex>", data }) → { encryptedObject }
 *   Note: `id` must be a hex STRING (the policy object ID starting with "0x")
 *
 * DECRYPT:
 *   1. SessionKey.create({ address, packageId, ttlMin, suiClient })
 *      → create a time-limited session key
 *   2. wallet.signPersonalMessage(sessionKey.getPersonalMessage())
 *      → get a signature from the user's wallet
 *   3. sessionKey.setPersonalMessageSignature(signature)
 *      → bind the signature to the session key (enables getCertificate())
 *   4. Build the Transaction that calls seal_approve (with identity bytes + policy object)
 *   5. tx.build({ client }) → txBytes
 *   6. sealClient.decrypt({ data, sessionKey, txBytes }) → plaintext
 *
 * KEY SERVER CONFIG (Testnet):
 *   Use the DECENTRALIZED committee server with aggregatorUrl.
 *   DO NOT use individual key-server object IDs without aggregatorUrl.
 *   Set verifyKeyServers: false for client-side usage.
 */

import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex } from "@mysten/sui/utils";

// Dynamic import so this module is only loaded client-side (browser)
async function getSealModule() {
  const { SealClient, SessionKey, EncryptedObject } =
    await import("@mysten/seal");
  return { SealClient, SessionKey, EncryptedObject };
}

// ── Sui + Seal client singletons ────────────────────────────────────────────

let _sealClientCache: any = null;
let _suiClientCache: SuiJsonRpcClient | null = null;

export function getSuiClient(): SuiJsonRpcClient {
  if (!_suiClientCache) {
    _suiClientCache = new SuiJsonRpcClient({
      url: getJsonRpcFullnodeUrl("testnet"),
      network: "testnet",
    });
  }
  return _suiClientCache;
}

/**
 * Returns a SealClient configured with the official Mysten Labs testnet
 * DECENTRALIZED committee key server.
 *
 * Source: https://raw.githubusercontent.com/MystenLabs/seal/main/examples/frontend/src/utils.ts
 * DECENTRALIZED_KEY_SERVER_OBJ_ID = 0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98
 */
export async function getSealClient(): Promise<any> {
  if (_sealClientCache) return _sealClientCache;

  const { SealClient } = await getSealModule();
  const suiClient = getSuiClient();

  _sealClientCache = new SealClient({
    suiClient,
    serverConfigs: [
      {
        objectId:
          "0xb012378c9f3799fb5b1a7083da74a4069e3c3f1c93de0b27212a5799ce1e1e98",
        weight: 1,
        // aggregatorUrl is required for decentralized (committee) key servers
        aggregatorUrl: "https://seal-aggregator-testnet.mystenlabs.com",
      },
    ],
    // Set to false for browser usage (avoids network round-trip to verify server)
    verifyKeyServers: false,
  });

  return _sealClientCache;
}

// ── Module 2: Encrypt Agent History ─────────────────────────────────────────

/**
 * Encrypts the agent history JSON using the Seal SDK.
 *
 * @param plainTextJSON  - The history as a JSON string
 * @param policyObjectId - The on-chain JournalAccess object ID (owner's policy)
 *                         MUST start with "0x" — used as the Seal identity string
 * @param packageId      - The deployed TuskOS Move package ID
 * @returns { encryptedBytes: Uint8Array } — store this in localStorage / Walrus
 */
export async function encryptAgentHistory(
  plainTextJSON: string,
  policyObjectId: string,
  packageId: string
): Promise<{ encryptedBytes: Uint8Array }> {
  const client = await getSealClient();
  const suiClient = getSuiClient();

  // Validate that the policyObjectId actually belongs to packageId on-chain
  try {
    const objDetails = await suiClient.getObject({
      id: policyObjectId,
      options: { showType: true }
    });
    if (objDetails.data && objDetails.data.type) {
      const typeStr = objDetails.data.type;
      const parts = typeStr.split("::");
      if (parts.length > 0 && parts[0].startsWith("0x")) {
        const policyPkg = parts[0].toLowerCase().replace(/^0x/, "").padStart(64, "0");
        const currentPkg = packageId.toLowerCase().replace(/^0x/, "").padStart(64, "0");
        if (policyPkg !== currentPkg) {
          throw new Error(`Policy object ${policyObjectId} belongs to package ${parts[0]}, but encryption is running with package ${packageId}.`);
        }
      }
    } else {
      throw new Error(`Policy object ${policyObjectId} not found on-chain.`);
    }
  } catch (err: any) {
    console.error("Policy object validation failed during encryption:", err);
    throw new Error(`Encryption failed: ${err.message || String(err)}`);
  }

  // Encode the plaintext as bytes
  const data = new TextEncoder().encode(plainTextJSON);

  // Seal encrypts using threshold IBE.
  // `id` must be a hex STRING (the policy object ID, "0x...").
  // The Seal SDK will internally derive the identity bytes from it.
  const { encryptedObject } = await client.encrypt({
    threshold: 1, // Single decentralized server, threshold = 1
    packageId,
    id: policyObjectId, // hex string e.g. "0xabc123..."
    data,
  });

  return { encryptedBytes: encryptedObject };
}

// ── Module 3: Decrypt Agent History ─────────────────────────────────────────

/**
 * Decrypts agent history using the Seal SDK.
 *
 * The official flow (from MystenLabs/seal examples):
 *   1. Create a SessionKey
 *   2. Sign a personal message via the wallet (sui:signPersonalMessage)
 *   3. Bind the signature to the session key
 *   4. Build a Transaction calling seal_approve
 *   5. Pass txBytes + sessionKey to sealClient.decrypt()
 *
 * @param encryptedBytes        - The Uint8Array from encryptAgentHistory
 * @param policyObjectId        - The on-chain JournalAccess object ID ("0x...")
 * @param packageId             - The deployed TuskOS Move package ID
 * @param walletAddress         - The current wallet's Sui address
 * @param signPersonalMessage   - Async fn: (msg: Uint8Array) => Promise<{ signature: string }>
 * @returns plaintext JSON string
 */
export async function decryptAgentHistory(
  encryptedBytes: Uint8Array,
  policyObjectId: string,
  packageId: string,
  walletAddress: string,
  signPersonalMessage: (msg: Uint8Array) => Promise<{ signature: string }>
): Promise<string> {
  const { SessionKey, EncryptedObject } = await getSealModule();
  const sealClient = await getSealClient();
  const suiClient = getSuiClient();

  // Parse the encrypted object to extract the identity
  const encObj = EncryptedObject.parse(encryptedBytes);
  // encObj.id is the hex string ID used during encryption (the policyObjectId)

  // Dynamically resolve the package ID from the policy object's on-chain type
  let effectivePackageId = packageId;
  try {
    const objDetails = await suiClient.getObject({
      id: encObj.id,
      options: { showType: true }
    });
    if (objDetails.data && objDetails.data.type) {
      const typeStr = objDetails.data.type; // e.g. "0x5714...::journal_access::JournalAccess"
      const parts = typeStr.split("::");
      if (parts.length > 0 && parts[0].startsWith("0x")) {
        effectivePackageId = parts[0];
        console.log(`Dynamically resolved policy package ID: ${effectivePackageId} for policy ${encObj.id}`);
      }
    }
  } catch (err) {
    console.warn(`Failed to dynamically resolve package ID for policy ${encObj.id}, falling back to default:`, err);
  }

  // Validate package ID compatibility before requesting shares from key servers.
  // In Identity-Based Encryption, the encryption identity (packageId + id) must
  // mathematically match the decryption identity.
  const normalizedEffective = effectivePackageId.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const normalizedEncObjPkg = encObj.packageId.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  if (normalizedEffective !== normalizedEncObjPkg) {
    console.warn(`Decryption package ID mismatch! Report encrypted with ${encObj.packageId}, but policy object belongs to ${effectivePackageId}.`);
    throw new Error(
      `Decryption failed due to contract upgrade mismatch. The report was encrypted under contract package ${encObj.packageId.slice(0, 10)}..., but the access policy belongs to package ${effectivePackageId.slice(0, 10)}... (these packages are incompatible).`
    );
  }

  // Create a time-limited session key (10 minute TTL)
  const sessionKey = await SessionKey.create({
    address: walletAddress,
    packageId: effectivePackageId,
    ttlMin: 10,
    suiClient,
  });

  // Step 2: Ask the user's wallet to sign the session key's personal message.
  // This is what proves to the Seal key servers that the user owns this address.
  const personalMessage = sessionKey.getPersonalMessage();
  const { signature } = await signPersonalMessage(personalMessage);

  // Step 3: Bind the signature to the session key
  await sessionKey.setPersonalMessageSignature(signature);

  // Step 4: Build the Transaction that calls seal_approve on the Move contract.
  // The key servers will dry_run this tx to verify the caller has access.
  //
  // IMPORTANT: tx.pure.vector('u8', fromHex(encObj.id)) uses the ID from the
  // parsed encrypted object, which is the exact identity used at encrypt time.
  const tx = new Transaction();
  tx.setSender(walletAddress);
  tx.moveCall({
    target: `${effectivePackageId}::journal_access::seal_approve`,
    arguments: [
      tx.pure.vector("u8", fromHex(encObj.id)), // id: vector<u8>
      tx.object(encObj.id),                     // policy: &JournalAccess (uses the policy object that encrypted the file)
    ],
  });

  // Step 5: Build the transaction bytes (needed by Seal for the dry_run check)
  const txBytes = await tx.build({ client: suiClient, onlyTransactionKind: true });

  // Step 6: Decrypt — Seal contacts key servers, they dry_run the seal_approve tx,
  // verify the sender matches the policy, and return key shares.
  // Seal recombines shares and decrypts locally (client-side).
  const decryptedBytes = await sealClient.decrypt({
    data: encryptedBytes,
    sessionKey,
    txBytes,
  });

  return new TextDecoder().decode(decryptedBytes);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a Uint8Array to a base64 string for storage (e.g., in localStorage).
 */
export function encryptedBytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Converts a base64 string back to Uint8Array for decryption.
 */
export function base64ToEncryptedBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}
