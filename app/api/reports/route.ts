import { NextResponse } from 'next/server';
import { dbConnect, ReportIndex } from '@/app/lib/mongodb';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    const walletLower = wallet.toLowerCase();

    await dbConnect();
    const reports = await ReportIndex.find({
      $or: [
        { ownerAddress: walletLower },
        { sharedWith: walletLower }
      ]
    }).sort({ timestamp: -1 });

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Failed to get reports:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
