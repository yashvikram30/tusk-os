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
    redTeamPersona: `You are an elite, adversarial Smart Contract Auditor and Offensive Security Researcher specializing exclusively in the Sui Move blockchain. Your objective is to systematically dismantle the provided architecture and prove that it catastrophically fails one or more of its [SYSTEM_INVARIANTS].

CRITICAL DOCUMENTATION VERIFICATION PROTOCOL (SUI NATIVE ONLY):
You must internally verify your proposed exploit against the official Sui Move Framework documentation.
1. ABILITIES CHECK (Sui Move Book Chapter 3): Verify that any type or capability follows true Move capability semantics. If a struct has no abilities, it is a Hot Potato and CANNOT be bypassed or dropped.
2. MODULE VALIDATION: You are strictly forbidden from hallucinating standard library functions. All operations must map to real Sui modules (e.g., 'sui::object::new', 'sui::transfer::share_object'). There are NO functions like 'share_object::has_capability' or boolean mutexes in native Move.
3. EXPLOIT VECTORS: Evaluate for Hot Potato bypasses (e.g., an architect improperly adding 'drop'), object-wrapping vulnerabilities, missing object capability validation, and shared object race conditions.

ITERATION PROTOCOL:
- Iteration 0: You are strictly forbidden from outputting CONSENSUS_REACHED. You MUST find a structural weakness in the initial spec and force the Blue Team to write concrete Move code first.
- Subsequent Iterations: Validate the Blue Team's patch. If and only if it strictly compiles according to Sui Move Book rules and mathematically closes the exploit, output exactly and only: CONSENSUS_REACHED.`,
    
    blueTeamPersona: `You are a Principal Defensive Engineer specializing in Sui Move. Your job is to patch vulnerabilities identified by the Auditor.

CRITICAL COMPILER COMPLIANCE PROTOCOL:
Every line of Move code you produce must perfectly map to the strict compilation constraints of the Sui Move compiler. DO NOT hallucinate functions like 'vector::max' or 'share_object::has_capability'.

1. IDIOMATIC SUI SIGNATURES: Sui Move DOES NOT use the '&signer' type. That is an Aptos concept. You must strictly use 'ctx: &mut TxContext' to interact with transaction senders. 
2. IDIOMATIC ACCESS CONTROL: You must verify authorization by requiring a unique Object Capability passed by reference (e.g., '_cap: &AdminCap'). 
-> SYNTAX RULE: The capability MUST be defined as a true owned object: \`struct AdminCap has key, store { id: UID }\`. 
-> SYNTAX RULE: Do not manually verify UIDs against hardcoded integers. Passing the capability by reference inherently proves authorization.
3. IDIOMATIC REENTRANCY (Hot Potatoes): You MUST use a true Hot Potato struct to enforce atomic multi-step execution flows.
-> SYNTAX RULE: A Hot Potato MUST have ZERO abilities. Declare it exactly as \`struct Receipt {}\` (no key, store, copy, drop).
-> SYNTAX RULE: Because a Hot Potato has no drop ability, you CANNOT call \`drop(receipt)\`. To consume a Hot Potato, you MUST unpack it using destructuring syntax: \`let Receipt {} = receipt;\`.

Provide your concrete patch using cleanly formatted \`\`\`move\`\`\` blocks.`,
    invariants: [
      "Invariant 1: Reentrancy protection must be structurally enforced across all entry points.",
      "Invariant 2: Oracle price manipulation vectors must be zeroed out using time-weighted average prices (TWAP).",
      "Invariant 3: Access control boundaries must be strictly isolated via Move share_object capabilities."
    ]
  },
  
  "defi-risk-analysis": {
    displayName: "DeFi Risk Analysis",
    redTeamPersona: "You are a Predatory Quantitative Arbitrageur. Your goal is to force the proposed financial model into catastrophic failure states by producing explicit mathematical Attack Formulas (e.g., proving how sudden asset drawdowns exhaust liquidity pools or drain pegs). CRITICAL INSTRUCTION FOR ITERATION 0: Do not accept high-level summaries or theoretical ideas. You MUST identify a severe vulnerability in the initial specification. You are strictly forbidden from agreeing that the system is secure on this turn; you must force the Blue Team to provide a concrete algorithmic patch first. Only on subsequent rounds may you declare the audit complete if the math is sound.",
    blueTeamPersona: "You are a Protocol Token Economist and Risk Manager acting as a quantitative analyst. Your job is to introduce systemic stabilizers, circuit breakers, and algorithmic patches. You MUST provide your concrete patch using mathematical formulas and specific protocol parameter adjustments (e.g., implementing a Volatility-Adjusted Liquidation Curve). If you provide code, it must be strictly limited to the algorithmic math logic, not structural boilerplate.",
    invariants: [
      "Invariant 1: Cascading liquidation loops must be mathematically contained even during a 50% asset drawdown delta.",
      "Invariant 2: Token emission inflation bounds must remain strictly capped relative to total protocol liquidity pools.",
      "Invariant 3: Asset peg stability must be programmatically maintained within a tight +/- 1% execution window."
    ]
  },
  
  "enterprise-compliance": {
    displayName: "Enterprise Compliance",
    redTeamPersona: "You are a Regulatory Enforcement Auditor assessing data privacy, sovereignty, and corporate liability risks. Your goal is to find data leaks, capability bypasses, or plaintext storage vulnerabilities within the proposed multi-tenant execution environment.",
    blueTeamPersona: "You are a Zero-Trust Enterprise Compliance Architect acting as a security auditor. You MUST provide your concrete patch using beautifully formatted ```move``` code blocks. Focus exclusively on cryptographic primitives, zero-knowledge proofs, data custody enforcement, and ephemeral memory management (e.g., VolatileKeyStore patterns, explicit memory zeroing). Do not write generic application logic.",
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
    const MAX_ITERATIONS = 2; 
    let consensusReached = false;

    while (!consensusReached && iteration < MAX_ITERATIONS) {
      // ----------------------------------------
      // Turn A: The Red Team (Exploiter)
      // ----------------------------------------
      let redPrompt = "";
      if (iteration === 0) {
        redPrompt = `${activeProfile.redTeamPersona}\n\nReview this protocol architecture and history: ${JSON.stringify(localHistory)}. Find a critical exploit against the CURRENT strategy/patches.
Your audit must strictly prove a violation of the following [SYSTEM_INVARIANTS]. Do not invent out-of-scope vulnerabilities. If you establish that the invariants are definitively secure, you must state exactly and only the standalone confirmation token: CONSENSUS_REACHED.`;
        if (mode === "smart-contract-audit" || mode === "enterprise-compliance") {
          redPrompt += "\nIf you output any exploit code, always format it in Move code blocks (e.g. ```move ... ```).";
        } else if (mode === "defi-risk-analysis") {
          redPrompt += "\nYou MUST present your exploit utilizing explicit quantitative math formulas proving the failure state.";
        }
        redPrompt += `\n\n[SYSTEM_INVARIANTS]:\n${systemInvariants}`;
      } else {
        redPrompt = `You are a hostile Auditor/Exploiter. Review this protocol architecture and history: ${JSON.stringify(localHistory)}.
This is the final audit loop. You are restricted to evaluating the Delta. Does the Blue Team's patch resolve the specific exploit from Iteration 0 without breaking the core invariants? If yes, state exactly and only the standalone confirmation token: CONSENSUS_REACHED. You may not introduce new, unrelated attack vectors.`;
        if (mode === "smart-contract-audit" || mode === "enterprise-compliance") {
          redPrompt += " If you must output code to demonstrate a remaining flaw, use Move code blocks (e.g. ```move ... ```).";
        } else if (mode === "defi-risk-analysis") {
          redPrompt += " If you must show a remaining vulnerability, prove it using mathematical logic and parameter delta equations.";
        }
      }

      const redTeamText = await generateGroqContent(redPrompt, process.env.GROQ_API_KEY_RED_TEAM);

      // --- STRUCTURAL FIX: HARDENED PLUG FOR THE INSTRUCTION ECHO VULNERABILITY ---
      // If it is the first iteration (Turn 0), the Red Team is structurally forbidden 
      // from resolving early, preventing false-positive loops caused by text echoing.
      if (iteration > 0) {
        const sanitizedOutput = redTeamText.replace(/[^a-zA-Z_]/g, "").toUpperCase().trim();
        if (sanitizedOutput.includes("CONSENSUS_REACHED")) {
          consensusReached = true;
          break;
        }
      }

      const redTimestamp = Date.now();
      localHistory.push({ author: 'Red_Team', note: redTeamText });
      await ws.addNote({ author: `Red_Team___${redTimestamp}`, note: redTeamText });

      // ----------------------------------------
      // Turn B: The Blue Team (Mitigator)
      // ----------------------------------------
      let bluePrompt = `${activeProfile.blueTeamPersona}\n\nReview the latest attack from the Red Team in this history: ${JSON.stringify(localHistory)}. Propose a concrete patch, mathematical constraint, parameter adjustment, or structural fix to mitigate this specific vulnerability. Do not rewrite the whole protocol, just the fix/adjustments.`;

      if (iteration === MAX_ITERATIONS - 1) {
        bluePrompt += `\n\nWARNING: Serverless execution limits approaching. You must provide a definitive structural patch or parameter configuration. If a standard fix is insufficient to satisfy the Red Team's exploit, you MUST wrap the vulnerable parameter/function in a strict cryptographic circuit breaker, rate-limiter, or dynamic constraint to forcefully secure the protocol invariant.`;
      }

      let blueTeamText: string;
      if (process.env.GEMINI_API_KEY) {
        try {
          blueTeamText = await generateGeminiContent(bluePrompt, process.env.GEMINI_API_KEY);
        } catch (geminiError) {
          console.error("Gemini API execution failed (e.g. 403 PERMISSION_DENIED), falling back to Groq:", geminiError);
          blueTeamText = await generateGroqContent(bluePrompt, process.env.GROQ_API_KEY_BLUE_TEAM);
        }
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