"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { FeedbackModal } from "./FeedbackModal";
import { cn } from "../../lib/utils";

export function FeedbackButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm",
          "text-[var(--text-muted)] hover:text-[var(--accent-purple)]",
          "border border-[var(--border)] hover:border-[var(--accent-purple-dim)]",
          "rounded-md transition-all",
          "hover:shadow-[0_0_10px_rgba(155,109,255,0.2)]"
        )}
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <FeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
