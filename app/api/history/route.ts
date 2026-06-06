import { NextResponse } from 'next/server';
import { Workspace } from 'tusk-memory';
import { MemWal } from '@mysten-incubation/memwal';
import { processAndSortHistory } from '../run_crew/route';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspace_id = searchParams.get('workspace_id');

  if (!workspace_id) {
    return NextResponse.json({ error: 'Missing workspace_id parameter' }, { status: 400 });
  }

  try {
    const workspace = new Workspace(workspace_id);
    const history = await workspace.getHistory();
    const sortedHistory = processAndSortHistory(history);
    return NextResponse.json({ history: sortedHistory });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to get history:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { workspaceId, history } = await req.json();

    if (!workspaceId || !Array.isArray(history)) {
      return NextResponse.json({ error: 'Missing workspaceId or history' }, { status: 400 });
    }

    const key = process.env.MEMWAL_PRIVATE_KEY;
    const accountId = process.env.MEMWAL_ACCOUNT_ID;

    if (!key || !accountId) {
      throw new Error('MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID must be set in the environment');
    }

    const memwalClient = MemWal.create({
      key,
      accountId,
    });

    const now = Date.now();

    // Map history items to MemWal bulk format
    const items = history.map((item: any, index: number) => {
      const staggeredAuthor = `${item.author}___${now + index}`;
      return {
        text: JSON.stringify({
          author: staggeredAuthor,
          note: item.note,
        }),
        namespace: workspaceId,
      };
    });

    // Bulk remember max 20 items per API call to stay under MemWal limits and avoid 429 rate limits
    const chunkSize = 20;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const bulkResult = await memwalClient.rememberBulkAndWait(chunk);
      if (bulkResult.failed > 0) {
        const failedItem = bulkResult.results.find(r => r.status !== 'done');
        throw new Error(`Failed to import notes to MemWal: ${failedItem?.error || 'Unknown error'}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to import history:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}


