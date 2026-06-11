"use client";

import { useEffect, useRef, useState } from "react";
import { computeHistogram, computeLumaWaveform, computeVectorscope } from "./scopes";
import { useT } from "@/i18n/use-t";
import { cn } from "@/lib/cn";

type ScopeKind = "histogram" | "waveform" | "vectorscope";

// Reads the preview canvas periodically and renders the chosen scope.
// The preview canvas is found via the shared selector below.
const PREVIEW_SELECTOR = "[data-preview-canvas]";

export function ScopesPanel() {
  const [kind, setKind] = useState<ScopeKind>("histogram");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t = useT();

  useEffect(() => {
    let raf = 0;
    const sample = document.createElement("canvas");
    const SW = 240;
    const draw = () => {
      const preview = document.querySelector<HTMLCanvasElement>(PREVIEW_SELECTOR);
      const out = canvasRef.current;
      if (preview && out && preview.width > 0) {
        const sh = Math.max(1, Math.round((preview.height / preview.width) * SW));
        sample.width = SW;
        sample.height = sh;
        const sctx = sample.getContext("2d", { willReadFrequently: true });
        const octx = out.getContext("2d");
        if (sctx && octx) {
          try {
            sctx.drawImage(preview, 0, 0, SW, sh);
            const px = sctx.getImageData(0, 0, SW, sh).data;
            paintScope(octx, out.width, out.height, kind, px, SW, sh);
          } catch {
            /* tainted canvas or not ready — skip this frame */
          }
        }
      }
      raf = requestAnimationFrame(() =>
        setTimeout(() => {
          raf = requestAnimationFrame(draw);
        }, 100),
      );
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [kind]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-white/5">
        {(["histogram", "waveform", "vectorscope"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "flex-1 px-2 py-1.5 text-2xs uppercase tracking-wide transition",
              kind === k ? "border-b-2 border-accent text-ink-1" : "text-ink-3 hover:text-ink-1",
            )}
          >
            {t(`scopes.${k}`)}
          </button>
        ))}
      </div>
      <div className="flex flex-1 items-center justify-center bg-black p-2">
        <canvas ref={canvasRef} width={256} height={200} className="size-full max-h-48 object-contain" />
      </div>
    </div>
  );
}

function paintScope(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  kind: ScopeKind,
  px: Uint8ClampedArray,
  sw: number,
  sh: number,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  if (kind === "histogram") {
    const hist = computeHistogram(px);
    const drawChannel = (bins: Uint32Array, color: string) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * w;
        const y = h - (bins[i]! / hist.max) * h;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    ctx.globalCompositeOperation = "lighter";
    drawChannel(hist.r, "rgba(255,80,80,0.8)");
    drawChannel(hist.g, "rgba(80,255,80,0.8)");
    drawChannel(hist.b, "rgba(80,120,255,0.8)");
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  if (kind === "waveform") {
    const { map, cols } = computeLumaWaveform(px, sw, sh);
    const img = ctx.createImageData(cols, 256);
    for (let i = 0; i < cols * 256; i++) {
      const v = map[i]!;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    const tmp = document.createElement("canvas");
    tmp.width = cols;
    tmp.height = 256;
    tmp.getContext("2d")!.putImageData(img, 0, 0);
    ctx.drawImage(tmp, 0, 0, w, h);
    return;
  }

  // vectorscope
  const size = 256;
  const grid = computeVectorscope(px, size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = grid[i]!;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  const tmp = document.createElement("canvas");
  tmp.width = size;
  tmp.height = size;
  tmp.getContext("2d")!.putImageData(img, 0, 0);
  const sq = Math.min(w, h);
  ctx.drawImage(tmp, (w - sq) / 2, (h - sq) / 2, sq, sq);
}
