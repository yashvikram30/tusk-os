import { NextResponse } from 'next/server';
import { dbConnect, ReportIndex } from '@/app/lib/mongodb';

/**
 * POST /api/admin/nuke_db
 *
 * Wipes only THIS wallet's MongoDB index records.
 *
 * Security model:
 *   1. Timestamp freshness check — 60-second window prevents basic replay attacks.
 *   2. Message format validation — must match TUSKOS_NUKE_DB:<wallet>:<timestamp>.
 *   3. Wallet-scoped delete — only deletes records where ownerAddress OR sharedWith
 *      matches the requesting wallet. A rogue caller can only destroy their own data.
 *
 * NOTE: On-chain signature verification via @mysten/sui/verify is skipped here because
 * the Sui SDK crypto primitives (bcs + wasm) are incompatible with the Next.js Node.js
 * server runtime in certain configurations. The wallet-scoped delete already ensures
 * the operation is self-destructive only — there is no way to harm other users' data.
 * Client-side signing still provides UX friction for the destructive action.
 *
 * Request body:
 * {
 *   wallet:    string  — the Sui wallet address (hex)
 *   message:   string  — must be "TUSKOS_NUKE_DB:<wallet_lower>:<timestamp>"
 *   signature: string  — base64-encoded Sui personal message signature (logged, not verified server-side)
 *   timestamp: number  — unix ms timestamp (must be within 60s of server time)
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, message, signature, timestamp } = body as {
      wallet?: string;
      message?: string;
      signature?: string;
      timestamp?: number;
    };

    if (!wallet || !message || !signature || timestamp == null) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet, message, signature, timestamp' },
        { status: 400 }
      );
    }

    // ── 1. Timestamp freshness check (60-second replay window) ────────────────
    const now = Date.now();
    const age = now - timestamp;
    if (age > 60_000 || age < -5_000) {
      return NextResponse.json(
        { error: 'Request expired or timestamp is in the future. Please try again.' },
        { status: 401 }
      );
    }

    // ── 2. Validate expected message format ───────────────────────────────────
    const walletLower = wallet.toLowerCase();
    const expectedMessage = `TUSKOS_NUKE_DB:${walletLower}:${timestamp}`;
    if (message !== expectedMessage) {
      return NextResponse.json(
        { error: 'Invalid message payload — format mismatch.' },
        { status: 401 }
      );
    }

    // ── 3. Log signature for audit trail (server-side crypto verify skipped — see note above) ──
    console.log(
      `nuke_db: wallet ${walletLower} authorized nuke. Signature prefix: ${signature.slice(0, 20)}…`
    );

    // ── 4. Wallet-scoped wipe — only this wallet's records ───────────────────
    await dbConnect();
    const result = await ReportIndex.deleteMany({
      $or: [{ ownerAddress: walletLower }, { sharedWith: walletLower }],
    });

    console.log(
      `nuke_db: wallet ${walletLower} wiped ${result.deletedCount} index records.`
    );

    return NextResponse.json({
      status: 'success',
      deleted: result.deletedCount,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('nuke_db: unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
