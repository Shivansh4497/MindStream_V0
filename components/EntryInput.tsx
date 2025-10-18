// components/EntryInput.tsx
import React, { useState, useRef, useEffect } from "react";

type Props = {
  onSave: (text: string) => Promise<void> | void;
  onStartRecord?: () => void;
  onStopRecord?: () => void;
  interimTranscript?: string;
  finalTranscript?: string;
  isRecording?: boolean;
  saving?: boolean;
};

export default function EntryInput({
  onSave,
  onStartRecord,
  onStopRecord,
  interimTranscript,
  finalTranscript,
  isRecording,
  saving,
}: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // If your voice transcription updates interim/final text, keep them in sync.
  useEffect(() => {
    if (interimTranscript && !finalTranscript) {
      setText(interimTranscript);
    }
    if (finalTranscript) {
      setText(finalTranscript);
    }
  }, [interimTranscript, finalTranscript]);

  const handleSave = async () => {
    if (!text.trim()) return;
    await onSave(text.trim());
    setText("");
  };

  return (
    <div className="ms-card ms-input-capsule p-5 relative transition-all">
      <div className="flex items-start gap-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What’s on your mind?"
          rows={2}
          className="w-full resize-none bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none focus-visible:ring-0"
          aria-label="Write your reflection"
        />

        <div className="flex flex-col gap-2 ms-safe-interactive">
          <button
            onMouseDown={onStartRecord}
            onMouseUp={onStopRecord}
            onTouchStart={onStartRecord}
            onTouchEnd={onStopRecord}
            disabled={saving}
            aria-label="Hold to record"
            title="Hold to record"
            className={`px-3 py-2 rounded-md text-sm border ms-focus-ring transition-colors ${
              isRecording
                ? "bg-teal-100 border-teal-300 text-teal-700"
                : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            {isRecording ? "●" : "🎙️"}
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            aria-label="Save reflection"
            title="Save reflection"
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm ms-cta-shimmer hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Tip: hold the mic to record or just type — everything stays in your browser.
      </div>
    </div>
  );
}
