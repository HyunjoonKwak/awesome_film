import type { ID, MediaAsset } from "@cut/core";
import { runWith, type ProjectMutating, type SetFn } from "../store-helpers";

export interface MediaLibraryActions {
  addMediaAsset: (asset: MediaAsset) => void;
  setAssetProxy: (
    assetId: ID,
    proxy: { proxyPath: string; proxyWidth: number; proxyHeight: number },
  ) => void;
  removeMediaAsset: (assetId: ID) => void;
}

export const createMediaActions = <S extends ProjectMutating>(set: SetFn<S>): MediaLibraryActions => ({
  addMediaAsset: (asset) =>
    runWith(set, "Import media", (p) => ({
      ...p,
      mediaLibrary: [...p.mediaLibrary, asset],
    })),

  setAssetProxy: (assetId, proxy) =>
    runWith(set, "Attach proxy", (p) => ({
      ...p,
      mediaLibrary: p.mediaLibrary.map((a) =>
        a.id === assetId
          ? {
              ...a,
              proxyPath: proxy.proxyPath,
              proxyWidth: proxy.proxyWidth,
              proxyHeight: proxy.proxyHeight,
            }
          : a,
      ),
    })),

  removeMediaAsset: (assetId) =>
    runWith(set, "Remove media", (p) => {
      // Cascade: drop every timeline clip that referenced this asset.
      const tracks = p.timeline.tracks.map((tr) => ({
        ...tr,
        clips: tr.clips.filter((c) => c.kind !== "media" || c.assetId !== assetId),
      }));
      return {
        ...p,
        mediaLibrary: p.mediaLibrary.filter((a) => a.id !== assetId),
        timeline: { ...p.timeline, tracks },
      };
    }),
});
