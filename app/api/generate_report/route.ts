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
    // Always write archive index notes to the default primary workspace
    // to ensure they can be recovered during a blockchain rebuild.
    const primaryWorkspaceId = `wallet_${ownerLower}`;
    const workspace = new Workspace(primaryWorkspaceId);
    
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

    // 3. MemWal archive note (blocking to ensure on-chain permanence in serverless runtimes)
    await workspace.addNote({
      author: 'System_Archive',
      // v2: policyId embedded so chain_reports can recover it without localStorage
      note: JSON.stringify({ blobId, topic, policyId: policyLower }),
    });

    return NextResponse.json({ status: 'success', blobId, indexed });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Archive report error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
