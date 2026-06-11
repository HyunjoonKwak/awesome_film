"use client";

import { useEffect } from "react";
import { useMediaImport } from "@/media/hooks";

// Window-level drag-and-drop guard. Without it, dropping a file outside a
// dedicated drop zone navigates the window to file:// — in the Electron
// shell that blanks the whole editor. Media files dropped anywhere are
// routed into the import pipeline; everything else is swallowed.
const isMediaFile = (file: File): boolean => /^(video|audio|image)\//.test(file.type);

export const useGlobalFileDrop = (): void => {
  const { importFiles } = useMediaImport();

  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      // A dedicated drop zone (e.g. the media bin) already handled this one.
      if (e.defaultPrevented) return;
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []).filter(isMediaFile);
      if (files.length > 0) void importFiles(files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [importFiles]);
};
