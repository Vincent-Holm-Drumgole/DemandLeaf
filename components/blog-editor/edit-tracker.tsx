"use client";

import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

interface EditTrackerProps {
  blogId: string;
  paragraphIndex: number;
  originalText: string;
  onEditRecorded?: () => void;
}

export interface EditTrackerHandle {
  getCurrentText: () => string;
}

const MIN_CHANGE_CHARS = 10;

export const EditTracker = forwardRef<EditTrackerHandle, EditTrackerProps>(
  function EditTracker({ blogId, paragraphIndex, originalText, onEditRecorded }, ref) {
    const divRef = useRef<HTMLDivElement>(null);
    const [showToast, setShowToast] = useState(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSentRef = useRef<string>(originalText);

    useImperativeHandle(ref, () => ({
      getCurrentText: () => divRef.current?.innerText ?? originalText,
    }));

    useEffect(() => {
      if (divRef.current && divRef.current.innerText !== originalText) {
        divRef.current.innerText = originalText;
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function computeCharDiff(a: string, b: string): number {
      // Simple character count difference as a proxy for change magnitude
      return Math.abs(a.length - b.length) + levenshteinApprox(a, b);
    }

    function levenshteinApprox(a: string, b: string): number {
      // Fast approximation: count differing chars at aligned positions
      const minLen = Math.min(a.length, b.length);
      let diff = 0;
      for (let i = 0; i < minLen; i++) {
        if (a[i] !== b[i]) diff++;
      }
      return diff;
    }

    async function handleBlur() {
      const currentText = divRef.current?.innerText ?? "";
      const delta = computeCharDiff(lastSentRef.current, currentText);

      if (delta < MIN_CHANGE_CHARS) return;
      if (currentText === originalText) return;

      try {
        const res = await fetch("/api/edits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blogId,
            paragraphIndex,
            originalText,
            editedText: currentText,
          }),
        });
        if (res.ok) {
          lastSentRef.current = currentText;
          showEditToast();
          onEditRecorded?.();
        }
      } catch {
        // Silent fail — edit recording is non-critical
      }
    }

    function showEditToast() {
      setShowToast(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setShowToast(false), 2500);
    }

    useEffect(() => {
      return () => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      };
    }, []);

    return (
      <div className="relative group">
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          className={[
            "outline-none rounded px-1 -mx-1",
            "focus:ring-2 focus:ring-primary/20 focus:bg-muted/30",
            "transition-colors",
          ].join(" ")}
          data-paragraph-index={paragraphIndex}
        />

        {showToast && (
          <div
            className={[
              "absolute -top-8 left-0",
              "bg-green-500 text-white text-xs rounded px-2 py-1",
              "pointer-events-none select-none",
              "animate-in fade-in slide-in-from-bottom-1 duration-150",
            ].join(" ")}
          >
            Edit recorded
          </div>
        )}
      </div>
    );
  }
);
