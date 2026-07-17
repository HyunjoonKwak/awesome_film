"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project-store";
import { t } from "@/i18n/use-t";
import { importMediaFile } from "./import";
import { useImportProgressStore } from "./import-progress-store";

export interface ImportState {
  importing: boolean;
  importFiles: (files: FileList | File[]) => Promise<void>;
}

export const useMediaImport = (): ImportState => {
  const [importing, setImporting] = useState(false);
  const addMediaAsset = useProjectStore((s) => s.addMediaAsset);

  const importFiles = useCallback(
    async (input: FileList | File[]) => {
      const files = Array.from(input);
      if (files.length === 0) return;
      const progress = useImportProgressStore.getState();
      if (progress.active) {
        toast.info(t("media.importBusy"));
        return;
      }
      setImporting(true);
      progress.start(files.length);
      let done = 0;
      let failed = 0;
      let cancelled = false;
      try {
        for (const file of files) {
          if (useImportProgressStore.getState().cancelRequested) {
            cancelled = true;
            break;
          }
          useImportProgressStore.getState().beginFile(file.name);
          try {
            // process serially to keep memory bounded
            const { asset, releaseLease } = await importMediaFile(file);
            try {
              addMediaAsset(asset);
            } finally {
              releaseLease();
            }
            done++;
            useImportProgressStore.getState().fileDone();
          } catch {
            // One bad file must not abort the whole batch.
            failed++;
            useImportProgressStore.getState().fileFailed();
          }
        }
        const skipped = files.length - done - failed;
        if (cancelled) {
          toast.info(t("media.importCancelled", { done, skipped }));
        } else if (failed > 0) {
          toast.warning(t("media.importedPartial", { done, failed }));
        } else {
          toast.success(t("media.imported", { n: done }));
        }
      } finally {
        useImportProgressStore.getState().finish();
        setImporting(false);
      }
    },
    [addMediaAsset],
  );

  return { importing, importFiles };
};
