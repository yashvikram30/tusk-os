"use client";
import React, { useState } from "react";

interface NewBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, topic: string) => void;
}

export default function NewBoardModal({ isOpen, onClose, onCreate }: NewBoardModalProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a board name.");
      return;
    }
    if (!topic.trim()) {
      setError("Please enter a DeFi concept/topic.");
      return;
    }
    onCreate(name.trim(), topic.trim());
    setName("");
    setTopic("");
    setError(null);
    onClose();
  };

  return (
    <>
      <style>{`
        .board-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.88);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: boardIn 0.2s ease-out;
        }
        @keyframes boardIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .board-modal {
          background: #000;
          border: 2px solid #F8FAFC;
          width: 90%;
          max-width: 460px;
          padding: 2rem;
          position: relative;
          box-shadow: 6px 6px 0 0 #FF4F00;
          animation: boardSlide 0.25s cubic-bezier(0.16,1,0.3,1);
          font-family: 'IBM Plex Mono', monospace;
        }
        @keyframes boardSlide {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .board-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 900;
          font-size: 1.1rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #F8FAFC;
          margin: 0 0 0.35rem;
        }
        .board-desc {
          font-size: 0.72rem;
          color: #6b7280;
          margin: 0 0 1.5rem;
          line-height: 1.6;
        }
        .board-label {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          color: #6b7280;
          margin-bottom: 0.4rem;
          margin-top: 1rem;
        }
        .board-input {
          width: 100%;
          background: #0d0d0f;
          border: 2px solid #2a2a2e;
          color: #F8FAFC;
          padding: 0.65rem 0.9rem;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.78rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .board-input:focus {
          border-color: #F8FAFC;
        }
        .board-input::placeholder {
          color: #6b7280;
        }
        .board-textarea {
          width: 100%;
          background: #0d0d0f;
          border: 2px solid #2a2a2e;
          color: #F8FAFC;
          padding: 0.65rem 0.9rem;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.78rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
          resize: vertical;
          min-height: 80px;
        }
        .board-textarea:focus {
          border-color: #F8FAFC;
        }
        .board-textarea::placeholder {
          color: #6b7280;
        }
        .board-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }
        .board-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 900;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 0.65rem 1.1rem;
          border: 2px solid;
          background: #000;
          cursor: pointer;
          transition: transform 0.1s ease, background 0.1s ease;
          flex: 1;
        }
        .board-btn:hover:not(:disabled) {
          transform: translate(-2px, -2px);
        }
        .board-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .board-btn-create { border-color: #FF4F00; color: #FF4F00; }
        .board-btn-create:hover:not(:disabled) { background: rgba(255,79,0,0.07); }
        .board-btn-cancel { border-color: #2a2a2e; color: #6b7280; flex: 0 0 auto; }
        .board-btn-cancel:hover { background: #0d0d0f; }
        .board-error {
          margin-top: 0.85rem;
          padding: 0.6rem 0.75rem;
          border: 2px solid #ef4444;
          background: rgba(239,68,68,0.05);
          color: #ef4444;
          font-size: 0.72rem;
          line-height: 1.5;
        }
        .board-close {
          position: absolute;
          top: 0.85rem;
          right: 0.85rem;
          background: transparent;
          border: none;
          color: #6b7280;
          font-size: 1.1rem;
          cursor: pointer;
          transition: color 0.15s;
          line-height: 1;
          padding: 0.25rem;
        }
        .board-close:hover { color: #F8FAFC; }
      `}</style>

      <div className="board-overlay" onClick={onClose}>
        <div className="board-modal" onClick={(e) => e.stopPropagation()}>
          <button className="board-close" onClick={onClose}>
            ✕
          </button>

          <h2 className="board-title">Create New Board</h2>
          <p className="board-desc">
            Instantiate a new sovereign actor-critic debate board. Each board works with its own clean workspace history state.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="board-label">Board Name</div>
            <input
              className="board-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Yield Optimizer Audit"
              spellCheck={false}
              autoFocus
            />

            <div className="board-label">DeFi Concept / Topic</div>
            <textarea
              className="board-textarea"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., A capital-efficient leverage yield aggregator on Sui"
              spellCheck={false}
            />

            <div className="board-actions">
              <button
                type="submit"
                className="board-btn board-btn-create"
                disabled={!name.trim() || !topic.trim()}
              >
                CREATE BOARD
              </button>
              <button type="button" className="board-btn board-btn-cancel" onClick={onClose}>
                CANCEL
              </button>
            </div>
          </form>

          {error && <div className="board-error">⚠ {error}</div>}
        </div>
      </div>
    </>
  );
}
