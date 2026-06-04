"use client";
import React from "react";

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
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
        subparts.push(<strong key={match.index}>{match[1]}</strong>);
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
            key={match.index}
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

  // Split content by fenced code blocks first
  const blocks = content.split(/(```[\s\S]*?```)/g);

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
        } else {
          const lines = block.split("\n");
          const elements: React.ReactNode[] = [];
          let currentList: React.ReactNode[] = [];

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

          lines.forEach((line, lineIdx) => {
            const trimmed = line.trim();

            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
              currentList.push(
                <li key={lineIdx} style={{ fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.6 }}>
                  {parseLine(trimmed.substring(2))}
                </li>
              );
            } else if (/^\d+\.\s/.test(trimmed)) {
              flushList(lineIdx);
              const match = trimmed.match(/^(\d+)\.\s(.*)/);
              if (match) {
                elements.push(
                  <div
                    key={lineIdx}
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      fontSize: "0.8rem",
                      color: "var(--text-primary)",
                      paddingLeft: "0.5rem",
                      margin: "0.2rem 0",
                      lineHeight: 1.6,
                    }}
                  >
                    <span style={{ color: "var(--accent-orange)", fontWeight: "bold" }}>{match[1]}.</span>
                    <div>{parseLine(match[2])}</div>
                  </div>
                );
              }
            } else if (trimmed.startsWith("### ")) {
              flushList(lineIdx);
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
              flushList(lineIdx);
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
              flushList(lineIdx);
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
              flushList(lineIdx);
              elements.push(<div key={lineIdx} style={{ height: "0.4rem" }} />);
            } else {
              flushList(lineIdx);
              elements.push(
                <p key={lineIdx} style={{ margin: "0.2rem 0", fontSize: "0.8rem", color: "var(--text-primary)", lineHeight: 1.7 }}>
                  {parseLine(line)}
                </p>
              );
            }
          });

          flushList(`end-${blockIdx}`);
          return <React.Fragment key={blockIdx}>{elements}</React.Fragment>;
        }
      })}
    </div>
  );
}
