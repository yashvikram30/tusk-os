import { NextResponse } from 'next/server';
import Workspace from 'tusk-memory';
import { MemWal } from '@mysten-incubation/memwal';

// Monkey patch Workspace to avoid waiting for on-chain indexing jobs.
Workspace.prototype.addNote = async function(this: any, { author, note }: { author: string; note: string }) {
  const payload = { author, note };
  // Synchronous local push ensures local continuity without network lag
  this.sessionNotes = this.sessionNotes || [];
  this.sessionNotes.push(payload);

  if (!this.memwalClient) {
    const key = this.apiKey || process.env.MEMWAL_PRIVATE_KEY;
    const accountId = process.env.MEMWAL_ACCOUNT_ID;
    if (!key || !accountId) {
      throw new Error("MemWal credentials missing in environment");
    }
    this.memwalClient = MemWal.create({ key, accountId });
  }

  // Fire remember asynchronously to prevent blocking HTTP response
  this.memwalClient.remember(JSON.stringify(payload), this.workspaceId).catch((err: any) => {
    console.error("Asynchronous MemWal sync failed:", err);
  });
};

async function generateGroqContent(prompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set in environment");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(`Groq API error (${res.status}): ${JSON.stringify(errorData)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response received from Groq API");
  }
  return text;
}

export function processAndSortHistory(rawHistory: any[]): any[] {
  const timestamped: any[] = [];
  const legacy: any[] = [];

  rawHistory.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const authorStr = item.author || '';
    const noteStr = item.note || '';

    const parts = authorStr.split('___');
    const author = parts[0];
    const timestamp = parts[1] ? parseInt(parts[1], 10) : null;

    if (timestamp !== null && !isNaN(timestamp)) {
      timestamped.push({ author, note: noteStr, timestamp });
    } else {
      legacy.push({ author, note: noteStr });
    }
  });

  timestamped.sort((a, b) => a.timestamp - b.timestamp);

  const legacyArchitects = legacy.filter(n => n.author.toLowerCase().includes('architect'));
  const legacyRedTeams = legacy.filter(n => n.author.toLowerCase().includes('red'));
  const legacyBlueTeams = legacy.filter(n => n.author.toLowerCase().includes('blue'));
  const legacyResearchers = legacy.filter(n => n.author.toLowerCase().includes('researcher'));
  const legacyRiskManagers = legacy.filter(n => n.author.toLowerCase().includes('risk'));
  const legacyOthers = legacy.filter(n => 
    !n.author.toLowerCase().includes('architect') && 
    !n.author.toLowerCase().includes('red') && 
    !n.author.toLowerCase().includes('blue') && 
    !n.author.toLowerCase().includes('researcher') && 
    !n.author.toLowerCase().includes('risk')
  );

  const interleavedLegacy: any[] = [];
  const maxLen = Math.max(
    legacyArchitects.length, 
    legacyRedTeams.length, 
    legacyBlueTeams.length,
    legacyResearchers.length,
    legacyRiskManagers.length
  );
  
  for (let i = 0; i < maxLen; i++) {
    if (i < legacyResearchers.length) interleavedLegacy.push(legacyResearchers[i]);
    if (i < legacyRiskManagers.length) interleavedLegacy.push(legacyRiskManagers[i]);
    if (i < legacyArchitects.length) interleavedLegacy.push(legacyArchitects[i]);
    if (i < legacyRedTeams.length) interleavedLegacy.push(legacyRedTeams[i]);
    if (i < legacyBlueTeams.length) interleavedLegacy.push(legacyBlueTeams[i]);
  }

  return [
    ...interleavedLegacy,
    ...legacyOthers,
    ...timestamped.map(({ author, note }) => ({ author, note }))
  ];
}

export async function POST(req: Request) {
  try {
    const { workspaceId, topic } = await req.json();

    if (!workspaceId || !topic) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const ws = new Workspace(workspaceId, process.env.MEMWAL_API_KEY);

    // Fetch initial history exactly ONCE before starting the workflow
    const initialHistory = await ws.getHistory();
    let localHistory = processAndSortHistory(initialHistory);

    const liveProtocolState = JSON.stringify({
      name: topic,
      tvl: "$45,000,000",
      category: "Leverage Yield / Capital Primitive",
      status: "SIMULATED_SPEC_ACTIVE",
      note: "Speculative architecture specification sandbox parameters loaded."
    });

    // ==========================================
    // PHASE 1: THE ARCHITECT
    // ==========================================
    const architectPrompt = `You are an elite DeFi Risk Analyst & Architect. Review this live protocol state payload: ${liveProtocolState}. Outline a specific yield optimization strategy or structural architecture based on these current metrics, and highlight any immediate surface-level concerns. Keep it under 3 paragraphs.`;

    const architectText = await generateGroqContent(architectPrompt);

    // Track state locally for the immediate response; update memory in background
    const architectTimestamp = Date.now();
    localHistory.push({ author: 'Architect', note: architectText });
    await ws.addNote({ author: `Architect___${architectTimestamp}`, note: architectText });

    // ==========================================
    // PHASE 2: THE CONSENSUS LOOP
    // ==========================================
    let iteration = 0;
    // Capped at 2 iterations to confidently complete within a Serverless 10-second limit
    const MAX_ITERATIONS = 2; 
    let consensusReached = false;

    while (!consensusReached && iteration < MAX_ITERATIONS) {
      // ----------------------------------------
      // Turn A: The Red Team (Exploiter)
      // ----------------------------------------
      const redPrompt = `You are a hostile Smart Contract Auditor. Review this protocol architecture and history: ${JSON.stringify(localHistory)}. Find a critical exploit (e.g., oracle manipulation, flash loan attack, or cascading liquidation) against the CURRENT strategy/patches. If you find a fatal flaw, explain the attack vector. IF the system is completely secure and no critical flaws remain, output EXACTLY and ONLY the phrase: 'CONSENSUS_REACHED'.`;

      const redTeamText = await generateGroqContent(redPrompt);

      const cleanText = redTeamText.trim().replace(/[.'"`‘’“”]/g, "");
      if (cleanText === 'CONSENSUS_REACHED') {
        consensusReached = true;
        break;
      }

      const redTimestamp = Date.now();
      localHistory.push({ author: 'Red_Team', note: redTeamText });
      await ws.addNote({ author: `Red_Team___${redTimestamp}`, note: redTeamText });

      // ----------------------------------------
      // Turn B: The Blue Team (Mitigator)
      // ----------------------------------------
      const bluePrompt = `You are a Lead Smart Contract Engineer. Review the latest attack from the Red Team in this history: ${JSON.stringify(localHistory)}. Propose a concrete logical patch, mathematical constraint, or structural fix to mitigate this specific vulnerability. Do not rewrite the whole protocol, just the fix.`;

      const blueTeamText = await generateGroqContent(bluePrompt);

      const blueTimestamp = Date.now();
      localHistory.push({ author: 'Blue_Team', note: blueTeamText });
      await ws.addNote({ author: `Blue_Team___${blueTimestamp}`, note: blueTeamText });

      iteration++;
    }

    return NextResponse.json({
      status: 'success',
      history: localHistory,
      consensus: consensusReached,
      iterations: iteration
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Consensus Loop Agentic Workflow Error:", err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}