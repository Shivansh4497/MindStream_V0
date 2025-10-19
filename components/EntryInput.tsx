// components/EntryInput.tsx
import React, { useEffect, useRef, useState } from "react";

/**
 * EntryInput (full file)
 * - Compatibility bridge: supports older props used in pages/index.tsx
 * - Designed to stretch to parent height/width when placed in grid
 */

type OldProps = {
  finalText?: string;
  setFinalText?: (text: string) => void;
  interim?: string;
  startRecording?: () => void;
  stopRecording?: () => Promise<void> | void;
  saveTextEntry?: (text: string, source?: string) => Promise<void> | void;
  status?: string;
  setStatus?: React.Dispatch<React.SetStateAction<string>>;
  showToast?: (text: string, kind?: "error" | "success" | "info") => void;
};

type NewProps = {
  finalTranscript?: string;
  interimTranscript?: string;
  onStartRecord?: () => void;
  onStopRecord?: () => Promise<void> | void;
  onSave?: (text: string) => Promise<void> | void;
  isRecording?: boolean;
  saving?: boolean;
  /**
   * Optional: make the wrapper stretch vertically (used to ensure equal-height with the button).
   */
  stretch?: boolean;
};

type Props = OldProps & NewProps;

export default function EntryInput(props: Props) {
  // old props
  const {
    finalText,
    setFinalText,
    interim,
    startRecording,
    stopRecording,
    saveTextEntry,
    status,
    setStatus,
    showToast,
  } = props;

  // new props (optional)
  const {
    finalTranscript,
    interimTranscript,
    onStartRecord,
    onStopRecord,
    onSave,
    isRecording: isRecordingProp,
    saving: savingProp,
    stretch,
  } = props as NewProps;

  const effectiveFinal = finalTranscript ?? finalText ?? "";
  const effectiveInterim = interimTranscript ?? interim ?? "";
  const effectiveOnStart = onStartRecord ?? startRecording;
  const effectiveOnStop = onStopRecord ?? stopRecording;
  const effectiveOnSave =
    onSave ?? (async (text: string) => saveTextEntry && saveTextEntry(text, "manual"));
  const effectiveIsRecording = typeof isRecordingProp === "boolean" ? isRecordingProp : false;
  const effectiveSaving = typeof savingProp === "boolean" ? savingProp : false;

  const [text, setText] = useState<string>(effectiveFinal || "");
  const [localRecording, setLocalRecording] = useState<boolean>(effectiveIsRecording);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (effectiveInterim && !effectiveFinal) {
      setText(effectiveInterim);
      return;
    }
    if (effectiveFinal) {
      setText((prev) => {
        if (!prev || prev.trim() === "" || effectiveFinal.includes(prev.trim())) {
          return effectiveFinal;
        }
        return prev;
      });
      if (setFinalText && effectiveFinal !== finalText) {
        try {
          setFinalText(effectiveFinal);
        } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveInterim, effectiveFinal]);

  useEffect(() => {
    setLocalRecording(effectiveIsRecording);
  }, [effectiveIsRecording]);

  const handleSaveClicked = async () => {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      showToast?.("Nothing to save", "info");
      return;
    }
    try {
      setStatus?.("saving");
    } catch {}
    try {
      await effectiveOnSave?.(trimmed);
      try {
        setFinalText?.("");
      } catch {}
      setText("");
      showToast?.("Saved reflection", "success");
      // focus back to textarea for momentum
      setTimeout(() => textareaRef.current?.focus(), 60);
    } catch (err) {
      console.error("[EntryInput] save error", err);
      showToast?.("Error saving reflection", "error");
    } finally {
      try {
        setStatus?.("");
      } catch {}
    }
  };

  const handleStart = () => {
    setLocalRecording(true);
    try {
      effectiveOnStart?.();
    } catch {}
  };

  const handleStop = async () => {
    try {
      await effectiveOnStop?.();
    } catch (e) {
      console.warn("[EntryInput] stop handler error", e);
    } finally {
      setLocalRecording(false);
    }
  };

  return (
    <div
      className={`ms-card ms-input-capsule relative transition-all flex flex-col justify-between ${
        stretch ? "h-full" : ""
      }`}
      data-testid="entry-input"
    >
      <div className="flex gap-4 items-stretch">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            try {
              setFinalText?.(e.target.value);
            } catch {}
          }}
          placeholder="What’s on your mind?"
          rows={4}
          style={{ minHeight: 92 }}
          className="w-full resize-none bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none text-base"
          aria-label="Write your reflection"
        />

        <div className="flex flex-col gap-2 ms-safe-interactive">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              handleStart();
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              handleStop();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              handleStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleStop();
            }}
            disabled={effectiveSaving}
            aria-label="Hold to record"
            aria-pressed={localRecording}
            title="Hold to record"
            className={`w-12 h-12 flex items-center justify-center rounded-md text-sm border ms-focus-ring transition-transform duration-150 transform ${
              localRecording
                ? "scale-95 bg-teal-100 ring-2 ring-teal-200 ms-mic-recording"
                : "hover:scale-105 bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
            }`}
          >
            <span className="text-lg" aria-hidden>
              {localRecording ? "●" : "🎙️"}
            </span>
          </button>

          <button
            onClick={handleSaveClicked}
            disabled={effectiveSaving || !text.trim()}
            aria-label="Save reflection"
            title="Save reflection"
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm ms-cta-shimmer hover:bg-indigo-700 disabled:opacity-60"
          >
            {effectiveSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Tip: hold the mic to record or just type — everything stays in your browser.
      </div>
    </div>
  );
}
