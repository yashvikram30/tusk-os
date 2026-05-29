import { NextResponse } from 'next/server';
import { Workspace, uploadToWalrus } from 'tusk-memory';
import { dbConnect, ReportIndex } from '@/app/lib/mongodb';

export async function POST(req: Request) {
  try {
    const { workspace_id, topic, encryptedData, owner_address, policy_id } = await req.json();

    if (!workspace_id || !topic || !encryptedData || !owner_address || !policy_id) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const ownerLower = owner_address.toLowerCase();
    const policyLower = policy_id.toLowerCase();
    const workspace = new Workspace(workspace_id);
    
    // 1. Upload report directly to Walrus Testnet to get blobId
    const blobId = await uploadToWalrus(encryptedData);

    // 2. Index in MongoDB (Walrus upload still succeeds if this fails)
    let indexed = false;
    try {
      await dbConnect();
      await ReportIndex.findOneAndUpdate(
        { blobId },
        {
          $set: {
            ownerAddress: ownerLower,
            policyId: policyLower,
            topic,
          },
          $setOnInsert: { sharedWith: [], timestamp: new Date() },
        },
        { upsert: true }
      );
      indexed = true;
    } catch (mongoErr) {
      console.error(`MongoDB index failed for blob ${blobId}:`, mongoErr);
    }

    // 3. MemWal archive note (non-blocking — ledger rebuild can recover)
    workspace
      .addNote({
        author: 'System_Archive',
        note: JSON.stringify({ blobId, topic }),
      })
      .catch((err) => {
        console.error(`MemWal System_Archive write failed for blob ${blobId}:`, err);
      });

    return NextResponse.json({ status: 'success', blobId, indexed });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Archive report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
