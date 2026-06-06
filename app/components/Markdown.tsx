"use client";
import React from "react";

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  // Translate standard LaTeX mathematical symbols and format subscripts
  const formatMathSymbols = (mathText: string): React.ReactNode => {
    // Intercept cases blocks first
    if (mathText.includes("\\begin{cases}")) {
      const match = mathText.match(/([\s\S]*?)=\s*\\begin{cases}([\s\S]*?)\\end{cases}/);
      if (match) {
        const leftSide = match[1].trim();
        const casesContent = match[2].trim();
        const caseLines = casesContent.split(/\\\\/).map(l => l.trim()).filter(Boolean);

        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", overflowX: "auto" }}>
            <div style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{formatMathSymbols(leftSide)} = </div>
            <div style={{ fontSize: "2rem", fontWeight: 100, color: "var(--purple)", display: "flex", alignItems: "center", transform: "scaleY(1.3)", userSelect: "none" }}>{"{"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingLeft: "0.4rem" }}>
              {caseLines.map((line, lineIdx) => {
                const parts = line.split("&").map(p => p.trim());
                const value = parts[0] || "";
                const condition = parts[1] || "";
                return (
                  <div key={lineIdx} style={{ display: "flex", gap: "1.5rem", fontSize: "0.82rem", alignItems: "center" }}>
                    <div style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{formatMathSymbols(value)}</div>
                    {condition && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {formatMathSymbols(condition)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      const casesOnlyMatch = mathText.match(/\\begin{cases}([\s\S]*?)\\end{cases}/);
      if (casesOnlyMatch) {
        const casesContent = casesOnlyMatch[1].trim();
        const caseLines = casesContent.split(/\\\\/).map(l => l.trim()).filter(Boolean);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflowX: "auto" }}>
            <div style={{ fontSize: "2rem", fontWeight: 100, color: "var(--purple)", display: "flex", alignItems: "center", transform: "scaleY(1.3)", userSelect: "none" }}>{"{"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", paddingLeft: "0.4rem" }}>
              {caseLines.map((line, lineIdx) => {
                const parts = line.split("&").map(p => p.trim());
                const value = parts[0] || "";
                const condition = parts[1] || "";
                return (
                  <div key={lineIdx} style={{ display: "flex", gap: "1.5rem", fontSize: "0.82rem", alignItems: "center" }}>
                    <div style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>{formatMathSymbols(value)}</div>
                    {condition && (
                      <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {formatMathSymbols(condition)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
    }

    let formatted = mathText
      .replace(/\\text\s*{(.*?)}/g, "$1") // Strip LaTeX text blocks
      .replace(/\\beta/g, "β")
      .replace(/\\sigma/g, "σ")
      .replace(/\\times/g, " × ")
      .replace(/\\leq/g, " ≤ ")
      .replace(/\\geq/g, " ≥ ")
      .replace(/\\delta/g, "δ")
      .replace(/\\Delta/g, "Δ")
      .replace(/\\alpha/g, "α")
      .replace(/\\gamma/g, "γ")
      .replace(/\\theta/g, "θ")
      .replace(/\\lambda/g, "λ")
      .replace(/\\mu/g, "μ")
      .replace(/\\phi/g, "φ")
      .replace(/\\pi/g, "π")
      .replace(/\\rho/g, "ρ")
      .replace(/\\tau/g, "τ")
      .replace(/\\omega/g, "ω")
      .replace(/\\infty/g, "∞")
      .replace(/\\approx/g, " ≈ ")
      .replace(/\\neq/g, " ≠ ");

    // Replace fractions: \frac{A}{B} -> (A) / (B)
    let lastFormatted = "";
    let iterations = 0;
    while (formatted.includes("\\frac{") && formatted !== lastFormatted && iterations < 10) {
      lastFormatted = formatted;
      formatted = formatted.replace(/\\frac{([^{}]+)}{([^{}]+)}/g, "($1) / ($2)");
      iterations++;
    }

    // Convert variables like CRnew, Vcrash, Ainitial to latex subscript notation after fraction parsing
    formatted = formatted
      .replace(/\b(CR|V|A|LR)(new|crash|initial|base|adjusted)\b/g, "$1_{$2}")
      .replace(/\b([a-zA-Z0-9\-]+)_([a-zA-Z0-9\-]+)\b/g, "$1_{$2}");

    // Parse subscripts: variable_{subscript}
    const parts: React.ReactNode[] = [];
    const regex = /([a-zA-Z0-9\-]+)_{([^{}]+)}/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(formatted)) !== null) {
      parts.push(formatted.substring(lastIndex, match.index));
      parts.push(
        <React.Fragment key={`sub-${match.index}`}>
          {match[1]}
          <sub style={{ fontSize: "0.75em", bottom: "-0.25em" }}>{match[2]}</sub>
        </React.Fragment>
      );
      lastIndex = regex.lastIndex;
    }
    parts.push(formatted.substring(lastIndex));

    return (
      <span style={{ fontFamily: "var(--font-mono)", fontStyle: "italic", letterSpacing: "0.03em" }}>
        {parts}
      </span>
    );
  };

  const parseLine = (text: string) => {
    // Parse bold: **text**
    let parts: React.ReactNode[] = [text];

    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const regex = /\*\*(.*?)\*\*/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        subparts.push(part.substring(lastIndex, match.index));
        subparts.push(<strong key={`bold-${match.index}`}>{match[1]}</strong>);
        lastIndex = regex.lastIndex;
      }
      subparts.push(part.substring(lastIndex));
      return subparts;
    });

    // Parse inline math: \\( math \\) or \( math \)
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const regex = /\\\\?\((.*?)\\\\?\)/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        subparts.push(part.substring(lastIndex, match.index));
        subparts.push(
          <span
            key={`math-${match.index}`}
            style={{
              padding: "0 4px",
              background: "rgba(168, 85, 247, 0.06)",
              borderRadius: "2px",
              borderBottom: "1px dotted var(--purple)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {formatMathSymbols(match[1])}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      subparts.push(part.substring(lastIndex));
      return subparts;
    });

    // Parse unwrapped math variables: CRnew, Vcrash, Ainitial, etc.
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const regex = /\b(CRnew|Vcrash|Ainitial|LRbase|LRadjusted|CR_new|V_crash|A_initial|LR_base|LR_adjusted)\b/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        subparts.push(part.substring(lastIndex, match.index));
        subparts.push(
          <span
            key={`unwrapped-math-${match.index}`}
            style={{
              padding: "0 2px",
              fontFamily: "var(--font-mono)",
              fontStyle: "italic",
            }}
          >
            {formatMathSymbols(match[1])}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      subparts.push(part.substring(lastIndex));
      return subparts;
    });

    // Parse links: [text](url)
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const regex = /\[(.*?)\]\((.*?)\)/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        subparts.push(part.substring(lastIndex, match.index));
        subparts.push(
          <a
            key={`link-${match.index}`}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--accent-blue)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            {match[1]}
          </a>
        );
        lastIndex = regex.lastIndex;
      }
      subparts.push(part.substring(lastIndex));
      return subparts;
    });

    // Parse inline code: `code`
    parts = parts.flatMap((part) => {
      if (typeof part !== "string") return part;
      const regex = /`(.*?)`/g;
      const subparts = [];
      let lastIndex = 0;
      let match;
      while ((match = regex.exec(part)) !== null) {
        subparts.push(part.substring(lastIndex, match.index));
        subparts.push(
          <code
            key={`code-${match.index}`}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid var(--border-dim)",
              padding: "1px 4px",
              fontFamily: "var(--font-mono)",
              fontSize: "0.85em",
              color: "var(--accent-orange)",
            }}
          >
            {match[1]}
          </code>
        );
        lastIndex = regex.lastIndex;
      }
      subparts.push(part.substring(lastIndex));
      return subparts;
    });

    return parts;
  };

  // Preprocess cases blocks to consolidate them onto a single line
  const casesRegex = /\\begin{cases}([\s\S]*?)\\end{cases}/g;
  const preprocessed = content.replace(casesRegex, (match) => {
    return match.replace(/\n/g, " ");
  });

  // Split content by fenced code blocks and block math formulas first
  const blocks = preprocessed.split(/(```[\s\S]*?```|\\\\?\[[\s\S]*?\\\\?\]|\$\$[\s\S]*?\$\$)/g);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {blocks.map((block, blockIdx) => {
        if (block.startsWith("```")) {
          const lines = block.split("\n");
          const codeLines = lines.slice(1, -1).join("\n");
          const lang = lines[0].replace("```", "").trim();

          return (
            <pre
              key={blockIdx}
              style={{
                background: "#0d0d0f",
                border: "2px solid var(--border-dim)",
                padding: "1rem",
                overflowX: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                color: "var(--text-primary)",
                margin: "0.5rem 0",
                lineHeight: 1.5,
              }}
            >
              {lang && (
                <div
                  style={{
                    fontSize: "0.55rem",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    marginBottom: "0.5rem",
                    fontFamily: "var(--font-head)",
                    fontWeight: 700,
                  }}
                >
                  {lang}
                </div>
              )}
              <code>{codeLines}</code>
            </pre>
          );
        } else if (/^\s*\\\\?\[/.test(block) || block.trim().startsWith("$$")) {
          const mathContent = block
            .trim()
            .replace(/^\\\\?\[/, "")
            .replace(/\\\\?\]$/, "")
            .replace(/^\$\$/, "")
            .replace(/\$\$$/, "")
            .trim();

          return (
            <div
              key={blockIdx}
              style={{
                margin: "0.8rem 0",
                padding: "0.8rem 1rem",
                background: "rgba(168, 85, 247, 0.02)",
                borderLeft: "3px solid var(--purple)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                overflowX: "auto",
              }}
            >
              <div style={{ width: "100%" }}>
                {formatMathSymbols(mathContent)}
              </div>
            </div>
          );
        } else {
          const lines = block.split("\n");
          const elements: React.ReactNode[] = [];
          let currentList: React.ReactNode[] = [];
          let currentNumList: React.ReactNode[] = [];
          let currentQuote: React.ReactNode[] = [];
          let currentQuoteType: string | null = null;
          let currentTableRows: string[][] = [];
          let isTableAlignRowFound = false;

          const flushList = (key: string | number) => {
            if (currentList.length > 0) {
              elements.push(
                <ul
                  key={`list-${key}`}
                  style={{
                    margin: "0.4rem 0 0.8rem 1.5rem",
                    padding: 0,
                    listStyleType: "square",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                  }}
                >
                  {currentList}
                </ul>
              );
              currentList = [];
            }
          };

          const flushNumList = (key: string | number) => {
            if (currentNumList.length > 0) {
              elements.push(
                <ol
                  key={`numlist-${key}`}
                  style={{
                    margin: "0.4rem 0 0.8rem 1.5rem",
                    padding: 0,
                    listStyleType: "decimal",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.3rem",
                  }}
                >
                  {currentNumList}
                </ol>
              );
              currentNumList = [];
            }
          };

          const flushQuote = (key: string | number) => {
            if (currentQuote.length > 0) {
              let alertStyle: React.CSSProperties = {
                margin: "0.8rem 0",
                padding: "0.8rem 1rem",
                borderLeft: "4px solid var(--border-dim)",
                background: "rgba(255, 255, 255, 0.02)",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
              };

              let titleColor = "var(--text-primary)";
              let prefix = "";

              if (currentQuoteType === "NOTE") {
                alertStyle.borderLeftColor = "#3b82f6";
                alertStyle.background = "rgba(59, 130, 246, 0.04)";
                titleColor = "#3b82f6";
                prefix = "ℹ️ NOTE";
              } else if (currentQuoteType === "TIP") {
                alertStyle.borderLeftColor = "#10b981";
                alertStyle.background = "rgba(16, 185, 129, 0.04)";
                titleColor = "#10b981";
                prefix = "💡 TIP";
              } else if (currentQuoteType === "IMPORTANT") {
                alertStyle.borderLeftColor = "#a855f7";
                alertStyle.background = "rgba(168, 85, 247, 0.04)";
                titleColor = "#a855f7";
                prefix = "🔔 IMPORTANT";
              } else if (currentQuoteType === "WARNING") {
                alertStyle.borderLeftColor = "#f59e0b";
                alertStyle.background = "rgba(245, 158, 11, 0.04)";
                titleColor = "#f59e0b";
                prefix = "⚠️ WARNING";
              } else if (currentQuoteType === "CAUTION") {
                alertStyle.borderLeftColor = "#ef4444";
                alertStyle.background = "rgba(239, 68, 68, 0.04)";
                titleColor = "#ef4444";
                prefix = "🔥 CAUTION";
              }

              elements.push(
                <div key={`quote-${key}`} style={alertStyle}>
                  {currentQuoteType && currentQuoteType !== "GENERIC" && (
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "0.68rem",
                        color: titleColor,
                        marginBottom: "0.3rem",
                        fontFamily: "var(--font-head)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {prefix}
                    </div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {currentQuote}
                  </div>
                </div>
              );

              currentQuote = [];
              currentQuoteType = null;
            }
          };

          const flushTable = (key: string | number) => {
            if (currentTableRows.length > 0) {
              const hasHeader = currentTableRows.length > 1 || isTableAlignRowFound;
              const headerRow = hasHeader ? currentTableRows[0] : null;
              const bodyRows = hasHeader ? currentTableRows.slice(1) : currentTableRows;

              elements.push(
                <div key={`table-wrapper-${key}`} style={{ overflowX: "auto", margin: "1rem 0" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.78rem",
                      fontFamily: "var(--font-mono)",
                      border: "1px solid var(--border-dim)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {headerRow && (
                      <thead>
                        <tr
                          style={{
                            background: "rgba(255, 255, 255, 0.03)",
                            borderBottom: "2px solid var(--border-dim)",
                          }}
                        >
                          {headerRow.map((cell, cellIdx) => (
                            <th
                              key={`th-${cellIdx}`}
                              style={{
                                padding: "0.5rem 0.75rem",
                                fontWeight: "bold",
                                textAlign: "left",
                                borderRight: "1px solid var(--border-dim)",
                              }}
                            >
                              {parseLine(cell)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {bodyRows.map((row, rowIdx) => (
                        <tr
                          key={`tr-${rowIdx}`}
                          style={{
                            borderBottom: "1px solid var(--border-dim)",
                            background:
                              rowIdx % 2 === 1 ? "rgba(255, 255, 255, 0.01)" : "transparent",
                          }}
                        >
                          {row.map((cell, cellIdx) => (
                            <td
                              key={`td-${cellIdx}`}
                              style={{
                                padding: "0.5rem 0.75rem",
                                borderRight: "1px solid var(--border-dim)",
                              }}
                            >
                              {parseLine(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );

              currentTableRows = [];
              isTableAlignRowFound = false;
            }
          };

          const flushAll = (key: string | number) => {
            flushList(key);
            flushNumList(key);
            flushQuote(key);
            flushTable(key);
          };

          lines.forEach((line, lineIdx) => {
            const trimmed = line.trim();

            if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
              flushList(lineIdx);
              flushNumList(lineIdx);
              flushQuote(lineIdx);

              const cells = trimmed
                .split("|")
                .map((c) => c.trim())
                .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
              const isAlignRow = cells.every((c) => /^:?-+:?$/.test(c));

              if (isAlignRow) {
                isTableAlignRowFound = true;
              } else {
                currentTableRows.push(cells);
              }
            } else if (trimmed.startsWith(">")) {
              flushList(lineIdx);
              flushNumList(lineIdx);
              flushTable(lineIdx);

              let quoteText = trimmed.substring(1).trim();
              const alertMatch = quoteText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
              if (alertMatch) {
                currentQuoteType = alertMatch[1].toUpperCase();
                const remainingText = quoteText
                  .replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i, "")
                  .trim();
                if (remainingText) {
                  currentQuote.push(
                    <p key={`quote-line-${lineIdx}`} style={{ margin: 0, lineHeight: 1.6 }}>
                      {parseLine(remainingText)}
                    </p>
                  );
                }
              } else {
                if (!currentQuoteType) {
                  currentQuoteType = "GENERIC";
                }
                currentQuote.push(
                  <p key={`quote-line-${lineIdx}`} style={{ margin: 0, lineHeight: 1.6 }}>
                    {parseLine(quoteText)}
                  </p>
                );
              }
            } else if (trimmed.includes("\\begin{cases}")) {
              flushAll(lineIdx);
              elements.push(
                <div
                  key={lineIdx}
                  style={{
                    margin: "0.8rem 0",
                    padding: "0.8rem 1rem",
                    background: "rgba(168, 85, 247, 0.02)",
                    borderLeft: "3px solid var(--purple)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    overflowX: "auto",
                  }}
                >
                  <div style={{ width: "100%" }}>
                    {formatMathSymbols(trimmed)}
                  </div>
                </div>
              );
            } else if (
              (trimmed.includes("=") || trimmed.includes("≤") || trimmed.includes("≥") || trimmed.includes("<") || trimmed.includes(">") || trimmed.includes("\\leq") || trimmed.includes("\\geq")) &&
              (/\\(frac|beta|sigma|times|delta|Delta|alpha|gamma|theta|lambda|mu|phi|pi|rho|tau|omega|infty|approx|neq|begin|end)\b/.test(trimmed) || 
               /\b(CRnew|Vcrash|Ainitial|LRbase|LRadjusted)\b/.test(trimmed) ||
               /\b([a-zA-Z0-9\-]+)_([a-zA-Z0-9\-]+)\b/.test(trimmed))
            ) {
              flushAll(lineIdx);
              elements.push(
                <div
                  key={lineIdx}
                  style={{
                    margin: "0.6rem 0",
                    padding: "0.6rem 1rem",
                    background: "rgba(168, 85, 247, 0.01)",
                    borderLeft: "2px solid var(--purple)",
                    display: "flex",
                    alignItems: "center",
                    overflowX: "auto",
                  }}
                >
                  <div style={{ width: "100%" }}>
                    {formatMathSymbols(trimmed)}
                  </div>
                </div>
              );
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
              flushNumList(lineIdx);
              flushQuote(lineIdx);
              flushTable(lineIdx);

              currentList.push(
                <li
                  key={lineIdx}
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.6,
                  }}
                >
                  {parseLine(trimmed.substring(2))}
                </li>
              );
            } else if (/^\d+\.\s/.test(trimmed)) {
              flushList(lineIdx);
              flushQuote(lineIdx);
              flushTable(lineIdx);

              const match = trimmed.match(/^(\d+)\.\s(.*)/);
              if (match) {
                currentNumList.push(
                  <li
                    key={lineIdx}
                    style={{
                      fontSize: "0.8rem",
                      color: "var(--text-primary)",
                      lineHeight: 1.6,
                    }}
                  >
                    {parseLine(match[2])}
                  </li>
                );
              }
            } else if (trimmed.startsWith("### ")) {
              flushAll(lineIdx);
              elements.push(
                <h4
                  key={lineIdx}
                  style={{
                    fontFamily: "var(--font-head)",
                    fontWeight: 900,
                    fontSize: "0.82rem",
                    color: "var(--accent-orange)",
                    margin: "1rem 0 0.4rem 0",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {parseLine(trimmed.substring(4))}
                </h4>
              );
            } else if (trimmed.startsWith("## ")) {
              flushAll(lineIdx);
              elements.push(
                <h3
                  key={lineIdx}
                  style={{
                    fontFamily: "var(--font-head)",
                    fontWeight: 900,
                    fontSize: "0.95rem",
                    color: "var(--accent-blue)",
                    margin: "1.2rem 0 0.5rem 0",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {parseLine(trimmed.substring(3))}
                </h3>
              );
            } else if (trimmed.startsWith("# ")) {
              flushAll(lineIdx);
              elements.push(
                <h2
                  key={lineIdx}
                  style={{
                    fontFamily: "var(--font-head)",
                    fontWeight: 900,
                    fontSize: "1.1rem",
                    color: "var(--purple)",
                    margin: "1.5rem 0 0.6rem 0",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {parseLine(trimmed.substring(2))}
                </h2>
              );
            } else if (trimmed === "") {
              flushAll(lineIdx);
              elements.push(<div key={lineIdx} style={{ height: "0.4rem" }} />);
            } else {
              flushAll(lineIdx);
              elements.push(
                <p
                  key={lineIdx}
                  style={{
                    margin: "0.2rem 0",
                    fontSize: "0.8rem",
                    color: "var(--text-primary)",
                    lineHeight: 1.7,
                  }}
                >
                  {parseLine(line)}
                </p>
              );
            }
          });

          flushAll(`end-${blockIdx}`);
          return <React.Fragment key={blockIdx}>{elements}</React.Fragment>;
        }
      })}
    </div>
  );
}
