import { NextResponse } from 'next/server';
import { Workspace } from 'tusk-memory';
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

    const workspace = new Workspace(workspaceId);
    const now = Date.now();

    // Persist all notes concurrently. Stagger the timestamps by the array index
    // to prevent millisecond collisions and guarantee chronological sorting order.
    await Promise.all(
      history.map((item: any, index: number) => {
        const staggeredAuthor = `${item.author}___${now + index}`;
        return workspace.addNote({
          author: staggeredAuthor,
          note: item.note,
        });
      })
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to import history:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

