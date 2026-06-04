import { NextResponse } from 'next/server';
import Workspace from 'tusk-memory';
import { MemWal } from '@mysten-incubation/memwal';
import { GoogleGenAI } from '@google/genai';


const SWARM_PROFILES: Record<string, {
  displayName: string;
  redTeamPersona: string;
  blueTeamPersona: string;
  invariants: string[];
}> = {
  "smart-contract-audit": {
    displayName: "Smart Contract Audit",
    redTeamPersona: "You are an adversarial Smart Contract Auditor specializing in high-severity exploits. Your goal is to systematically find catastrophic flaws in the provided Sui Move architecture, and if you include code examples, write them in Move code blocks.",
    blueTeamPersona: "You are a Principal Defensive Engineer. Your job is to patch vulnerabilities identified by the Auditor by providing concrete, gas-optimized structural code fixes. You MUST write your code fixes or patches inside Move code blocks (e.g. ```move ... ```). Ensure all code is written in Sui Move.",
    invariants: [
      "Invariant 1: Reentrancy protection must be structurally enforced across all entry points.",
      "Invariant 2: Oracle price manipulation vectors must be zeroed out using time-weighted average prices (TWAP).",
      "Invariant 3: Access control boundaries must be strictly isolated via Move share_object capabilities."
    ]
  },
  "defi-risk-analysis": {
    displayName: "DeFi Risk Analysis",
    redTeamPersona: "You are a Predatory Quantitative Arbitrageur. Your goal is to force the proposed financial model into catastrophic failure states. CRITICAL INSTRUCTION FOR ITERATION 0: Do not accept high-level summaries or proposed ideas. The Lead Architect's initial specification is inherently theoretical and lacks concrete mathematical or code-level proof. Therefore, you MUST find a vulnerability in the initial specification. You are strictly forbidden from outputting CONSENSUS_REACHED on Iteration 0. You must force the Blue Team to provide a concrete structural patch first.",
    blueTeamPersona: "You are a Protocol Token Economist and Risk Manager. Your job is to introduce systemic stabilizers, circuit breakers, and algorithmic patches.",
    invariants: [
      "Invariant 1: Cascading liquidation loops must be mathematically contained even during a 50% asset drawdown delta.",
      "Invariant 2: Token emission inflation bounds must remain strictly capped relative to total protocol liquidity pools.",
      "Invariant 3: Asset peg stability must be programmatically maintained within a tight +/- 1% execution window."
    ]
  },
  "enterprise-compliance": {
    displayName: "Enterprise Compliance",
    redTeamPersona: "You are a Regulatory Enforcement Auditor assessing data privacy and corporate liability risks.",
    blueTeamPersona: "You are a Zero-Trust Enterprise Compliance Architect specializing in secure cloud data isolation.",
    invariants: [
      "Invariant 1: Strict data custody boundary alignment with high-risk EU AI Act compliance mandates.",
      "Invariant 2: Zero-residual plaintext trails across multi-tenant execution sandboxes.",
      "Invariant 3: Hard cryptographic tenant isolation preventing cross-session vector leakage."
    ]
  }
};

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

async function generateGroqContent(prompt: string, specificApiKey?: string): Promise<string> {
  const apiKey = specificApiKey || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("No Groq API key (GROQ_API_KEY) available in environment");
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

async function generateGeminiContent(prompt: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });
  const text = res.text;
  if (!text) {
    throw new Error("Empty response received from Gemini API");
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
    const { workspaceId, topic, mode = "smart-contract-audit" } = await req.json();

    if (!workspaceId || !topic) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const activeProfile = SWARM_PROFILES[mode] || SWARM_PROFILES["smart-contract-audit"];
    const systemInvariantsText = activeProfile.invariants.join("\n");

    const ws = new Workspace(workspaceId, process.env.MEMWAL_API_KEY);

    // Fetch initial history exactly ONCE before starting the workflow
    const initialHistory = await ws.getHistory();
    let localHistory = processAndSortHistory(initialHistory);

    const liveProtocolState = JSON.stringify({
      name: topic,
      tvl: "$45,000,000",
      category: activeProfile.displayName + " / Smart Contract Spec",
      status: "SIMULATED_SPEC_ACTIVE",
      note: "Speculative architecture specification sandbox parameters loaded."
    });

    // ==========================================
    // PHASE 1: THE ARCHITECT
    // ==========================================
    const architectPrompt = `You are the Lead Architect for ${activeProfile.displayName}. Review this live protocol state payload: ${liveProtocolState}. Outline a specific structural architecture and design strategy for the protocol "${topic}" based on these sandbox parameters, and highlight any immediate surface-level design or security concerns. Do not force the protocol to be a yield aggregator or yield optimization strategy unless the topic is specifically about yield. Adapt your strategy entirely to the nature of the topic. If this relates to smart contracts, you MUST provide structural outlines or code blocks using the Move language (e.g., in \`\`\`move ... \`\`\` blocks). Keep it under 3 paragraphs.

At the end of your response, you MUST include a section titled '[SYSTEM_INVARIANTS]' listing the following strict mathematical or logical rules this protocol must never violate:
${systemInvariantsText}`;

    const architectText = await generateGroqContent(architectPrompt, process.env.GROQ_API_KEY_ARCHITECT);

    // Extract invariants from the architect spec
    let systemInvariants = "";
    const invariantIndex = architectText.indexOf("[SYSTEM_INVARIANTS]");
    if (invariantIndex !== -1) {
      systemInvariants = architectText.substring(invariantIndex + "[SYSTEM_INVARIANTS]".length).trim();
    } else {
      systemInvariants = systemInvariantsText;
    }

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
      let redPrompt = "";
      if (iteration === 0) {
        redPrompt = `${activeProfile.redTeamPersona} Review this protocol architecture and history: ${JSON.stringify(localHistory)}. Find a critical exploit against the CURRENT strategy/patches.
Your audit must strictly prove a violation of the following [SYSTEM_INVARIANTS]. Do not invent out-of-scope vulnerabilities. If you output any exploit code, always format it in Move code blocks (e.g. \`\`\`move ... \`\`\`). If the invariants hold, output exactly and only: CONSENSUS_REACHED.

[SYSTEM_INVARIANTS]:
${systemInvariants}`;
      } else {
        redPrompt = `You are a hostile Auditor. Review this protocol architecture and history: ${JSON.stringify(localHistory)}.
This is the final audit loop. You are restricted to evaluating the Delta. Does the Blue Team's patch resolve the specific exploit from Iteration 0 without breaking the core invariants? If yes, output exactly and only: CONSENSUS_REACHED. You may not introduce new, unrelated attack vectors. If you must output code to demonstrate a remaining flaw, use Move code blocks (e.g. \`\`\`move ... \`\`\`).`;
      }

      const redTeamText = await generateGroqContent(redPrompt, process.env.GROQ_API_KEY_RED_TEAM);

      const sanitizedOutput = redTeamText.replace(/[^a-zA-Z_]/g, "").toUpperCase().trim();
      if (sanitizedOutput.includes("CONSENSUS_REACHED")) {
        consensusReached = true;
        break;
      }

      const redTimestamp = Date.now();
      localHistory.push({ author: 'Red_Team', note: redTeamText });
      await ws.addNote({ author: `Red_Team___${redTimestamp}`, note: redTeamText });

      // ----------------------------------------
      // Turn B: The Blue Team (Mitigator)
      // ----------------------------------------
      let bluePrompt = `You are a Lead Smart Contract Engineer. Review the latest attack from the Red Team in this history: ${JSON.stringify(localHistory)}. Propose a concrete logical patch, mathematical constraint, or structural fix to mitigate this specific vulnerability. You MUST write your code fixes or patches inside Move code blocks (e.g. \`\`\`move ... \`\`\`). Do not rewrite the whole protocol, just the fix.`;

      if (iteration === MAX_ITERATIONS - 1) {
        bluePrompt += `\n\nWARNING: Serverless execution limits approaching. You must provide a definitive structural patch. If a standard logical fix is insufficient to satisfy the Red Team's exploit, you MUST wrap the vulnerable function in a strict cryptographic circuit breaker (e.g., automated pause modifiers, strict withdrawal limits, or reentrancy guards) to forcefully secure the protocol invariant. Use Move code blocks for the code implementation (e.g. \`\`\`move ... \`\`\`).`;
      }

      let blueTeamText: string;
      if (process.env.GEMINI_API_KEY) {
        blueTeamText = await generateGeminiContent(bluePrompt, process.env.GEMINI_API_KEY);
      } else {
        blueTeamText = await generateGroqContent(bluePrompt, process.env.GROQ_API_KEY_BLUE_TEAM);
      }

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