"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedback.trim()) return;

    setStatus("sending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedback.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send feedback");
      }

      setStatus("success");
      setFeedback("");

      // Auto-close after success
      setTimeout(() => {
        onClose();
        setStatus("idle");
      }, 2000);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const handleClose = () => {
    if (status !== "sending") {
      onClose();
      setStatus("idle");
      setFeedback("");
      setErrorMessage("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl">
        {/* Corner accents */}
        <div className="absolute -top-[1px] -left-[1px] w-4 h-4 border-t-2 border-l-2 border-[var(--accent-purple-dim)] rounded-tl-md" />
        <div className="absolute -top-[1px] -right-[1px] w-4 h-4 border-t-2 border-r-2 border-[var(--accent-purple-dim)] rounded-tr-md" />
        <div className="absolute -bottom-[1px] -left-[1px] w-4 h-4 border-b-2 border-l-2 border-[var(--accent-purple-dim)] rounded-bl-md" />
        <div className="absolute -bottom-[1px] -right-[1px] w-4 h-4 border-b-2 border-r-2 border-[var(--accent-purple-dim)] rounded-br-md" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] font-[family-name:var(--font-cinzel)]">
            Send Feedback
          </h2>
          <button
            onClick={handleClose}
            disabled={status === "sending"}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {status === "success" ? (
            <div className="py-8 text-center">
              <div className="text-[var(--success)] text-lg mb-2">Thank you!</div>
              <p className="text-[var(--text-muted)] text-sm">Your feedback has been sent.</p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="feedback" className="block text-sm text-[var(--text-muted)] mb-2">
                  Share your thoughts, suggestions, or bug reports
                </label>
                <textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={5}
                  disabled={status === "sending"}
                  className={cn(
                    "w-full px-3 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-md",
                    "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                    "focus:outline-none focus:border-[var(--accent-purple-dim)] focus:ring-1 focus:ring-[var(--accent-purple-dim)]",
                    "resize-none disabled:opacity-50",
                    "custom-scrollbar"
                  )}
                />
              </div>

              {status === "error" && (
                <p className="text-sm text-[var(--error)]">{errorMessage}</p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={status === "sending"}
                  className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!feedback.trim() || status === "sending"}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-all",
                    "bg-[var(--accent-purple)] text-white",
                    "hover:bg-[var(--accent-purple-dim)] hover:shadow-[0_0_10px_rgba(155,109,255,0.3)]",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                  )}
                >
                  {status === "sending" ? "Sending..." : "Send Feedback"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
