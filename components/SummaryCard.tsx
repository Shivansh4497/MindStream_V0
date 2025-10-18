// components/SummaryCard.tsx
import React, { useState } from "react";
import { markDownLike } from "../lib/ui";

type SummaryCardProps = {
  summary: string;
  generatedAt?: string | null;
  isSavingRating?: boolean;
  hoverRating?: number;
  setHoverRating?: (n: number) => void;
  saveRatedSummary?: (rating: number) => Promise<void>;
  discardSummary?: () => void;
};

export default function SummaryCard({
  summary,
  generatedAt,
  isSavingRating = false,
  hoverRating = 0,
  setHoverRating = () => {},
  saveRatedSummary = async () => {},
  discardSummary = () => {},
}: SummaryCardProps) {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [localSaving, setLocalSaving] = useState(false);
  const sections = parseSummary(summary);

  const handleSave = async () => {
    if (localSaving || isSavingRating) return;
    const ratingToSave = selectedRating || hoverRating || 5;
    try {
      setLocalSaving(true);
      await saveRatedSummary(Number(ratingToSave));
    } catch (err) {
      console.error("[SummaryCard] save error", err);
    } finally {
      setLocalSaving(false);
    }
  };

  const handleDiscard = () => {
    try {
      discardSummary();
    } catch (err) {
      console.error("[SummaryCard] discard error", err);
    }
  };

  return (
    <article
      className="ms-summary-card relative mb-8 transition-all duration-300 ease-out"
      aria-live="polite"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-indigo-800 flex items-center gap-1">
            ✨ Reflection generated
            {generatedAt ? (
              <span className="text-xs text-gray-400">
                — {new Date(generatedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-500">
            Read, rate, then save — or discard it permanently.
          </div>
        </div>

        <button
          type="button"
          onClick={handleDiscard}
          aria-label="Dismiss reflection"
          className="text-xs text-gray-400 underline ms-safe-interactive"
        >
          Dismiss
        </button>
      </div>

      <div
        className="mt-4 space-y-4 bg-white/90 rounded-md p-5 text-gray-800 leading-relaxed"
        style={{ pointerEvents: "none" }}
      >
        {sections.map((sec, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{sec.icon}</span>
              <h3 className="font-semibold text-indigo-700 text-sm">
                {sec.title}
              </h3>
            </div>
            <div
              className="text-[15px] whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: markDownLike(sec.text) }}
            />
          </div>
        ))}
      </div>

      <div
        className="absolute left-0 right-0 bottom-4 flex items-center justify-between px-6"
        style={{
          zIndex: 20,
          pointerEvents: "auto",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Rate:</span>
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = selectedRating ? n <= selectedRating : n <= (hoverRating || 0);
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSelectedRating((cur) => (cur === n ? null : n))}
                onMouseEnter={() => setHoverRating?.(n)}
                onMouseLeave={() => setHoverRating?.(0)}
                onFocus={() => setHoverRating?.(n)}
                onBlur={() => setHoverRating?.(0)}
                aria-label={`Rate ${n} star`}
                title={`${n} star`}
                className="text-lg transition-colors"
              >
                <span style={{ color: filled ? "#facc15" : "#cbd5e1" }}>
                  {filled ? "★" : "☆"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 ms-safe-interactive">
          <button
            onClick={handleDiscard}
            disabled={localSaving || isSavingRating}
            className="px-3 py-1 border rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-60"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={localSaving || isSavingRating}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {localSaving || isSavingRating ? "Saving…" : "Save Reflection"}
          </button>
        </div>
      </div>
    </article>
  );
}

function parseSummary(summary: string) {
  try {
    const parts = summary.split(/\n(?=\*\*|\d\.|[-–] )/g);
    const icons = ["🪞", "📋", "🌱", "💡", "❤️"];
    return parts.map((p, i) => {
      const titleMatch = p.match(/\*\*(.*?)\*\*/);
      const title = titleMatch ? titleMatch[1].trim() : "Reflection";
      const text = p.replace(/\*\*(.*?)\*\*/, "").trim();
      return { title, text, icon: icons[i % icons.length] };
    });
  } catch (err) {
    return [{ title: "Reflection", text: summary || "", icon: "🪞" }];
  }
}
