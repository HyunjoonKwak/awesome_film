"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project-store";
import { t } from "@/i18n/use-t";
import { importMediaFile } from "./import";

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
      setImporting(true);
      const toastId = toast.loading(t("media.importing", { n: files.length }));
      try {
        for (const file of files) {
          // process serially to keep memory bounded
          const { asset, releaseLease } = await importMediaFile(file);
          try {
            addMediaAsset(asset);
          } finally {
            releaseLease();
          }
        }
        toast.success(t("media.imported", { n: files.length }), { id: toastId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(t("media.importFailed", { msg }), { id: toastId });
      } finally {
        setImporting(false);
      }
    },
    [addMediaAsset],
  );

  return { importing, importFiles };
};
