import { NextResponse } from 'next/server';
import { Workspace } from 'tusk-memory';
import { dbConnect, ReportIndex } from '@/app/lib/mongodb';

type ShareAction = 'grant' | 'revoke';

/**
 * POST /api/share_report
 * Indexes wallet access in MongoDB (+ MemWal inbox pointer).
 * Uses upsert so sharing works even if the archive step skipped MongoDB.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      policyId,
      recipientAddress,
      senderAddress,
      blobId,
      topic,
      action = 'grant',
    } = body as {
      policyId?: string;
      recipientAddress?: string;
      senderAddress?: string;
      blobId?: string;
      topic?: string;
      action?: ShareAction;
    };

    if (!policyId || !recipientAddress || !senderAddress) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (action !== 'grant' && action !== 'revoke') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const policyLower = policyId.toLowerCase();
    const recipientLower = recipientAddress.toLowerCase();
    const senderLower = senderAddress.toLowerCase();
    const blobIdExact = blobId?.trim() || undefined;
    const reportTopic = topic?.trim() || 'Shared Journal';

    await dbConnect();

    if (action === 'grant') {
      if (!blobIdExact) {
        const result = await ReportIndex.updateMany(
          { policyId: policyLower, ownerAddress: senderLower },
          { $addToSet: { sharedWith: recipientLower } }
        );
        const matchedCount = result.matchedCount ?? 0;
        if (matchedCount === 0) {
          return NextResponse.json(
            {
              error:
                'No archived report in the index. Archive to Walrus first, or pass a blobId when sharing.',
            },
            { status: 404 }
          );
        }
        await writeInboxGrant(senderLower, recipientLower, policyLower);
        return NextResponse.json({
          status: 'success',
          action,
          matchedCount,
          modifiedCount: result.modifiedCount ?? 0,
          indexed: true,
        });
      }

      // Upsert: create index row if archive never wrote MongoDB (e.g. missing MONGODB_URI earlier)
      const report = await ReportIndex.findOneAndUpdate(
        { blobId: blobIdExact },
        {
          $set: {
            ownerAddress: senderLower,
            policyId: policyLower,
            topic: reportTopic,
          },
          $addToSet: { sharedWith: recipientLower },
          $setOnInsert: { timestamp: new Date() },
        },
        { upsert: true, new: true }
      );

      await writeInboxGrant(
        senderLower,
        recipientLower,
        policyLower,
        report?.blobId ?? blobIdExact
      );

      return NextResponse.json({
        status: 'success',
        action,
        matchedCount: 1,
        modifiedCount: 1,
        indexed: true,
        upserted: true,
      });
    }

    // revoke
    const revokeFilter = blobIdExact
      ? { blobId: blobIdExact, ownerAddress: senderLower }
      : { policyId: policyLower, ownerAddress: senderLower };

    const result = blobIdExact
      ? await ReportIndex.updateOne(revokeFilter, {
          $pull: { sharedWith: recipientLower },
        })
      : await ReportIndex.updateMany(revokeFilter, {
          $pull: { sharedWith: recipientLower },
        });

    const matchedCount = result.matchedCount ?? 0;

    return NextResponse.json({
      status: 'success',
      action,
      matchedCount,
      modifiedCount: result.modifiedCount ?? 0,
      indexed: matchedCount > 0,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to update share index:', err);

    if (err.message?.includes('MONGODB_URI')) {
      return NextResponse.json(
        {
          error:
            'MongoDB is not configured. Add MONGODB_URI to .env.local and restart the dev server.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function writeInboxGrant(
  senderLower: string,
  recipientLower: string,
  policyLower: string,
  blobId?: string
) {
  const recipientWorkspace = new Workspace(`wallet_${recipientLower}`);
  await recipientWorkspace
    .addNote({
      author: 'SHARED_INBOX_GRANT',
      note: JSON.stringify({
        fromAddress: senderLower,
        policyId: policyLower,
        ...(blobId ? { blobId } : {}),
      }),
    })
    .catch((err) => {
      console.error(
        `Failed to write SHARED_INBOX_GRANT pointer to MemWal for ${recipientLower}:`,
        err
      );
    });
}
