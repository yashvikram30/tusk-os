import { NextResponse } from 'next/server';
import { Workspace } from 'tusk-memory';

/**
 * GET /api/admin/chain_reports?wallet=<address>
 *
 * Reads reports EXCLUSIVELY from the MemWal decentralized ledger.
 * Zero MongoDB dependency — works even when the database is nuked or unavailable.
 *
 * Response shape:
 * {
 *   ownReports: { blobId, topic, policyId: string|null, needsSync: boolean }[]
 *   sharedGrants: { fromAddress, policyId, blobId?: string }[]
 * }
 *
 * needsSync: true means the System_Archive note predates policyId embedding (v1 note).
 * These reports are still listed but cannot be decrypted until sync_ledger recovers policyId
 * from the Walrus blob via EncryptedObject.parse().
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    const walletLower = wallet.toLowerCase();
    const wsId = `wallet_${walletLower}`;

    const workspace = new Workspace(wsId);
    const history = await workspace.getHistory();

    const ownReports: {
      blobId: string;
      topic: string;
      policyId: string | null;
      needsSync: boolean;
    }[] = [];

    const sharedGrants: {
      fromAddress: string;
      policyId: string;
      blobId?: string;
    }[] = [];

    if (history && Array.isArray(history)) {
      for (const item of history) {
        if (!item) continue;

        // ── Own archived reports ──────────────────────────────────────────────
        if (item.author === 'System_Archive') {
          try {
            const parsed = JSON.parse(item.note);
            if (parsed && parsed.blobId && parsed.topic) {
              const hasPolicyId = !!parsed.policyId;
              ownReports.push({
                blobId: parsed.blobId,
                topic: parsed.topic,
                // v2 notes embed policyId; v1 legacy notes do not
                policyId: hasPolicyId ? parsed.policyId.toLowerCase() : null,
                needsSync: !hasPolicyId,
              });
            }
          } catch {
            // Malformed note — skip
          }
        }

        // ── Shared inbox grants ───────────────────────────────────────────────
        else if (item.author === 'SHARED_INBOX_GRANT') {
          try {
            const parsed = JSON.parse(item.note);
            if (parsed && parsed.fromAddress && parsed.policyId) {
              sharedGrants.push({
                fromAddress: parsed.fromAddress.toLowerCase(),
                policyId: parsed.policyId.toLowerCase(),
                ...(parsed.blobId ? { blobId: parsed.blobId } : {}),
              });
            }
          } catch {
            // Malformed note — skip
          }
        }
      }
    }

    // Deduplicate own reports by blobId (keep last seen, which is typically most recent)
    const seen = new Set<string>();
    const dedupedOwn = ownReports.filter((r) => {
      if (seen.has(r.blobId)) return false;
      seen.add(r.blobId);
      return true;
    });

    // ── Verify shared grants remain valid on-chain before returning them ──
    const verifiedSharedGrants: typeof sharedGrants = [];
    for (const grant of sharedGrants) {
      if (await verifyOnChainPolicyAccess(grant.policyId, walletLower)) {
        verifiedSharedGrants.push(grant);
      }
    }

    return NextResponse.json({
      ownReports: dedupedOwn,
      sharedGrants: verifiedSharedGrants,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('chain_reports: failed to read from MemWal:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Resolves the on-chain Sui policy object and checks if the given address is authorized
 * (either as the policy owner or as a recipient inside the shared_with list).
 */
async function verifyOnChainPolicyAccess(policyId: string, address: string): Promise<boolean> {
  try {
    const res = await fetch('https://fullnode.testnet.sui.io:443', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getObject',
        params: [
          policyId,
          { showContent: true }
        ]
      })
    });
    if (!res.ok) return false;
    const data = await res.json();
    const fields = data.result?.data?.content?.fields;
    if (!fields) return false;

    const owner = fields.owner?.toLowerCase();
    const sharedWith = Array.isArray(fields.shared_with)
      ? fields.shared_with.map((addr: string) => addr.toLowerCase())
      : [];
    const addressLower = address.toLowerCase();

    return owner === addressLower || sharedWith.includes(addressLower);
  } catch (err) {
    console.error(`Error verifying on-chain policy ${policyId}:`, err);
    return false;
  }
}

