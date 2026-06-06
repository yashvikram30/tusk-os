import { NextResponse } from 'next/server';
import { Workspace } from 'tusk-memory';
import { dbStatus, dbConnect, ReportIndex } from '@/app/lib/mongodb';
import { EncryptedObject } from '@mysten/seal';

/**
 * POST /api/admin/sync_ledger
 *
 * Two-phase decentralized → MongoDB sync:
 *   Phase 1: Read MemWal + Walrus (always succeeds, DB-independent)
 *   Phase 2: Upsert into MongoDB (graceful — DB failure does NOT abort the response)
 *
 * Response always includes parsedReports[] and dbAvailable so the caller
 * can display chain data even when MongoDB is nuked or unreachable.
 *
 * Response shape:
 * {
 *   status: "success"
 *   upserted: number          — records written to MongoDB (0 if DB unavailable)
 *   dbAvailable: boolean      — false when MongoDB is unconfigured or unreachable
 *   parsedReports: {          — parsed directly from MemWal + Walrus (always present)
 *     blobId: string
 *     topic: string
 *     policyId: string
 *     ownerAddress: string
 *   }[]
 * }
 */
export async function POST(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    const walletLower = wallet.toLowerCase();
    const wsId = `wallet_${walletLower}`;

    // ── Phase 1: Read MemWal (no MongoDB) ────────────────────────────────────
    const workspace = new Workspace(wsId);
    const history = await workspace.getHistory();

    const ownArchived: { blobId: string; topic: string; policyIdFromNote?: string }[] = [];
    const sharedGrants: { fromAddress: string; policyId: string; blobId?: string }[] = [];

    if (history && Array.isArray(history)) {
      for (const item of history) {
        if (!item) continue;
        if (item.author === 'System_Archive') {
          try {
            const parsed = JSON.parse(item.note);
            if (parsed && parsed.blobId && parsed.topic) {
              ownArchived.push({
                blobId: parsed.blobId,
                topic: parsed.topic,
                // v2 notes have policyId embedded; v1 legacy notes require Walrus fetch
                policyIdFromNote: parsed.policyId ? parsed.policyId.toLowerCase() : undefined,
              });
            }
          } catch {
            // Ignore malformed notes
          }
        } else if (item.author === 'SHARED_INBOX_GRANT') {
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
            // Ignore malformed notes
          }
        }
      }
    }

    // ── Phase 1b: Resolve policyId from Walrus for v1 legacy notes ────────────
    const parsedReports: {
      blobId: string;
      topic: string;
      policyId: string;
      ownerAddress: string;
    }[] = [];

    for (const report of ownArchived) {
      let policyId = report.policyIdFromNote;

      if (!policyId) {
        // Legacy v1 note — recover policyId from the Seal EncryptedObject in Walrus
        try {
          const walrusRes = await fetch(
            `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${report.blobId}`
          );
          if (!walrusRes.ok) {
            console.error(`sync_ledger: failed to fetch blob ${report.blobId} from Walrus`);
            continue;
          }
          const base64Text = await walrusRes.text();
          const encryptedBytes = new Uint8Array(Buffer.from(base64Text, 'base64'));
          const encObj = EncryptedObject.parse(encryptedBytes);
          policyId = encObj.id.toLowerCase();
        } catch (err) {
          console.error(`sync_ledger: error recovering policyId for blob ${report.blobId}:`, err);
          continue;
        }
      }

      parsedReports.push({
        blobId: report.blobId,
        topic: report.topic,
        policyId,
        ownerAddress: walletLower,
      });
    }

    // ── Phase 2: Upsert to MongoDB (graceful — never throws to the caller) ────
    const dbAvailable = (await dbStatus()) === 'connected';
    let upsertCount = 0;

    if (dbAvailable) {
      await dbConnect();

      // Sync own archived reports
      for (const report of parsedReports) {
        try {
          await ReportIndex.findOneAndUpdate(
            { blobId: report.blobId },
            {
              $set: {
                blobId: report.blobId,
                ownerAddress: report.ownerAddress,
                policyId: report.policyId,
                topic: report.topic,
              },
            },
            { upsert: true, new: true }
          );
          upsertCount++;
        } catch (err) {
          console.error(`sync_ledger: MongoDB upsert failed for blob ${report.blobId}:`, err);
        }
      }

      // Sync shared reports
      for (const grant of sharedGrants) {
        try {
          // ── Verify recipient still has access on-chain before restoring index ──
          const isAccessValid = await verifyOnChainPolicyAccess(grant.policyId, walletLower);
          if (!isAccessValid) {
            console.log(`sync_ledger: skipping revoked or invalid grant for policy ${grant.policyId}`);
            continue;
          }

          const sharerWsId = `wallet_${grant.fromAddress}`;
          const sharerWs = new Workspace(sharerWsId);
          const sharerHistory = await sharerWs.getHistory();

          for (const item of sharerHistory) {
            if (item && item.author === 'System_Archive') {
              try {
                const parsed = JSON.parse(item.note);
                if (parsed && parsed.blobId && parsed.topic) {
                  if (grant.blobId && parsed.blobId !== grant.blobId) {
                    continue;
                  }
                  await ReportIndex.findOneAndUpdate(
                    { blobId: parsed.blobId },
                    {
                      $set: {
                        blobId: parsed.blobId,
                        ownerAddress: grant.fromAddress,
                        policyId: grant.policyId,
                        topic: parsed.topic,
                      },
                      $addToSet: { sharedWith: walletLower },
                    },
                    { upsert: true, new: true }
                  );
                  upsertCount++;
                }
              } catch {
                // Ignore malformed notes
              }
            }
          }
        } catch (err) {
          console.error(`sync_ledger: failed to sync shared reports from ${grant.fromAddress}:`, err);
        }
      }
    } else {
      console.warn('sync_ledger: MongoDB unavailable — returning parsed chain data without persisting.');
    }

    return NextResponse.json({
      status: 'success',
      upserted: upsertCount,
      dbAvailable,
      parsedReports,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('sync_ledger: fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
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

