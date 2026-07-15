"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

// Next.js route error boundary for /editor. Catches render/runtime errors
// that escape the panel-level boundaries (e.g. a throw during initial mount)
// so the user gets a recovery action instead of a blank screen. The project
// autosaves to Yjs/IndexedDB, so `reset()` re-mounts onto the saved state.
export default function EditorError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // biome-ignore lint/suspicious/noConsole: intentional, diagnosable crash log
    console.error("[cut] editor crashed:", error);
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-panel-0 p-8 text-center text-ink-1">
      <TriangleAlert className="size-9 text-amber-400" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-base font-semibold">The editor hit an error</h1>
        <p className="mx-auto max-w-sm text-sm text-ink-3">
          Your project is autosaved. Reloading the editor should pick up where you left off.
        </p>
      </div>
      {error.message && (
        <p className="max-w-md break-words font-mono text-xs text-ink-3/80">{error.message}</p>
      )}
      <button type="button" onClick={reset} className="btn-ghost gap-2 text-sm">
        <RotateCcw className="size-4" aria-hidden />
        Reload editor
      </button>
    </div>
  );
}
