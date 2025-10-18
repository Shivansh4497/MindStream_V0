// components/EntryInput.tsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Regression-proof EntryInput
 * Accepts both:
 *  - Old props used by legacy pages/index.tsx:
 *      finalText, setFinalText, interim, startRecording, stopRecording, saveTextEntry
 *  - New props from refactor:
 *      finalTranscript, interimTranscript, onStartRecord, onStopRecord, onSave, saving
 *
 * The component bridges them so you can swap gradually.
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
};

type Props = OldProps & NewProps;

export default function EntryInput(props: Props) {
  // bridge old/new props
  const {
    // old
    finalText,
    setFinalText,
    interim,
    startRecording,
    stopRecording,
    saveTextEntry,
    status,
    setStatus,
    showToast,
    // new
    finalTranscript,
    interimTranscript,
    onStartRecord,
    onStopRecord,
    onSave,
    isRecording: isRecordingProp,
    saving: savingProp,
  } = props;

  // Effective handlers / values (compatibility layer)
  const effectiveFinal = finalTranscript ?? finalText ?? "";
  const effectiveInterim = interimTranscript ?? interim ?? "";
  const effectiveOnStart = onStartRecord ?? startRecording;
  const effectiveOnStop = onStopRecord ?? stopRecording;
  const effectiveOnSave = onSave ?? (async (text: string) => saveTextEntry && saveTextEntry(text, "manual"));
  const effectiveIsRecording = typeof isRecordingProp === "boolean" ? isRecordingProp : false;
  const effectiveSaving = typeof savingProp === "boolean" ? savingProp : false;

  // local state: primary editable text field
  const [text, setText] = useState<string>(effectiveFinal || "");
  const [localRecording, setLocalRecording] = useState<boolean>(effectiveIsRecording);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // keep local state in sync when upstream final/interim changes
  useEffect(() => {
    // If an interim transcript arrives and there is no overriding final text, show it
    if (effectiveInterim && !effectiveFinal) {
      setText(effectiveInterim);
      return;
    }
    // If final transcript arrives, merge or replace as appropriate
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
        } catch (e) {
          // ignore
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveInterim, effectiveFinal]);

  // If parent tells us isRecording, reflect it.
  useEffect(() => {
    setLocalRecording(effectiveIsRecording);
  }, [effectiveIsRecording]);

  // Handlers
  const handleSaveClicked = async () => {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      showToast?.("Nothing to save", "info");
      return;
    }
    try {
      setStatus?.("saving");
    } catch (e) {}
    try {
      await effectiveOnSave?.(trimmed);
      try {
        setFinalText?.("");
      } catch (e) {}
      setText("");
      showToast?.("Saved reflection", "success");
    } catch (err) {
      console.error("[EntryInput] save error", err);
      showToast?.("Error saving reflection", "error");
    } finally {
      try {
        setStatus?.("");
      } catch (e) {}
    }
  };

  const handleStart = () => {
    setLocalRecording(true);
    try {
      effectiveOnStart?.();
    } catch (e) {}
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

  // Render: keeps the refined UI (capsule, rounded, safe-interactive)
  return (
    <div className="ms-card ms-input-capsule relative transition-all" data-testid="entry-input">
      <div className="flex items-start gap-4">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            try {
              setFinalText?.(e.target.value);
            } catch (err) {
              // ignore
            }
          }}
          placeholder="What’s on your mind?"
          rows={2}
          className="w-full resize-none bg-transparent text-gray-800 placeholder-gray-400 focus:outline-none"
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
            title="Hold to record"
            className={`px-3 py-2 rounded-md text-sm border ms-focus-ring transition-transform duration-150 transform ${localRecording ? 'scale-95 bg-teal-100 ring-2 ring-teal-200 ms-mic-recording' : 'hover:scale-105 bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100'}`}
          >
            {localRecording ? "●" : "🎙️"}
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
