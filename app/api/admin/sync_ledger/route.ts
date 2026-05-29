import { NextResponse } from 'next/server';
import { Workspace } from 'tusk-memory';
import { dbConnect, ReportIndex } from '@/app/lib/mongodb';
import { EncryptedObject } from '@mysten/seal';

export async function POST(req: Request) {
  try {
    const { wallet } = await req.json();

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    const walletLower = wallet.toLowerCase();
    const wsId = `wallet_${walletLower}`;

    // 1. Connect to MemWal history
    const workspace = new Workspace(wsId);
    const history = await workspace.getHistory();

    const ownArchived: { blobId: string; topic: string }[] = [];
    const sharedGrants: { fromAddress: string; policyId: string; blobId?: string }[] = [];

    if (history && Array.isArray(history)) {
      for (const item of history) {
        if (!item) continue;
        if (item.author === 'System_Archive') {
          try {
            const parsed = JSON.parse(item.note);
            if (parsed && parsed.blobId && parsed.topic) {
              ownArchived.push(parsed);
            }
          } catch {
            // Ignore parse errors
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
            // Ignore parse errors
          }
        }
      }
    }

    await dbConnect();
    let upsertCount = 0;

    // 2. Sync own archived reports
    for (const report of ownArchived) {
      try {
        // Fetch from Walrus aggregator to recover policyId from the Seal object
        const walrusRes = await fetch(
          `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${report.blobId}`
        );
        if (!walrusRes.ok) {
          console.error(`Failed to fetch blob ${report.blobId} from Walrus during sync`);
          continue;
        }
        const base64Text = await walrusRes.text();
        const encryptedBytes = new Uint8Array(Buffer.from(base64Text, 'base64'));

        const encObj = EncryptedObject.parse(encryptedBytes);
        const policyId = encObj.id.toLowerCase(); // recovers the creator's policyObjectId hex string!

        await ReportIndex.findOneAndUpdate(
          { blobId: report.blobId },
          {
            $set: {
              blobId: report.blobId,
              ownerAddress: walletLower,
              policyId,
              topic: report.topic,
            }
          },
          { upsert: true, new: true }
        );
        upsertCount++;
      } catch (err) {
        console.error(`Failed to sync report ${report.blobId}:`, err);
      }
    }

    // 3. Sync shared reports (fetch from sharers and reconstruct shared grants)
    for (const grant of sharedGrants) {
      try {
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
                      ownerAddress: grant.fromAddress.toLowerCase(),
                      policyId: grant.policyId.toLowerCase(),
                      topic: parsed.topic,
                    },
                    $addToSet: { sharedWith: walletLower }
                  },
                  { upsert: true, new: true }
                );
                upsertCount++;
              }
            } catch {
              // Ignore
            }
          }
        }
      } catch (err) {
        console.error(`Failed to sync shared reports from ${grant.fromAddress}:`, err);
      }
    }

    return NextResponse.json({ status: 'success', upserted: upsertCount });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Ledger sync failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
