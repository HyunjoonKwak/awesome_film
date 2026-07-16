import {
  activeTransitionFor,
  clipTransform,
  isMediaClip,
  isTextClip,
  isShapeClip,
  isAdjustmentClip,
  isBackdropBlend,
  isWipe,
  type Clip,
  type AdjustmentClip,
  type EffectInstance,
  type ID,
  type MediaAsset,
  type MediaClip,
  type Project,
  type TextClip,
  type ShapeClip,
  type TransitionFrame,
} from "@cut/core";
import { sourceOffsetForRamp, textAnimAt, visibleAt } from "@cut/core";
import { getEffect } from "@/effects/registry";
import { getSegmenter } from "@/ai/bg-remove";
import { readMediaFile } from "@/persistence/opfs";
import { createGL, createQuad, createTexture, uploadSource, type GL } from "./gl";
import { ShaderRegistry, type Program } from "./shader-registry";
import { PingPong } from "./ping-pong";
import { ScratchPool } from "./scratch-pool";
import { FrameSourcePool } from "./frame-source";
import { renderTextToCanvas } from "./text-source";
import { renderShapeToCanvas } from "./shape-source";
import { getFrameProvider } from "./webcodecs-decoder";
import { uploadLutTexture } from "./lut-texture";
import { useLutStore } from "@/effects/lut/lut-store";
import {
  animateEffects,
  setBlendMode,
  setMaskUniforms,
  setTransformUniforms,
  setWipeUniforms,
} from "./compositor-uniforms";

// Per-clip ping-pong effect chain + final composite to the screen. Effect
// chain is data-driven by `effects/registry.ts`. Bg-remove receives a mask
// texture computed by MediaPipe; everything else just runs as fragment passes.
export class Compositor {
  private readonly gl: GL;
  private readonly shaders: ShaderRegistry;
  private readonly quad: ReturnType<typeof createQuad>;
  private readonly assetTextures = new Map<string, WebGLTexture>();
  private readonly textTextures = new Map<string, WebGLTexture>();
  private readonly bgMaskTextures = new Map<string, WebGLTexture>();
  // asset.id -> source time (s) the cached mask was computed at. MediaPipe
  // segmentation is the single most expensive per-frame op, so we skip it when
  // the underlying source frame hasn't advanced (idle re-renders, edits while
  // paused). Videos re-segment as currentTime moves; still images (no
  // currentTime) segment once and stay cached.
  private readonly bgMaskTime = new Map<string, number>();
  private readonly pingPong: PingPong;
  private readonly scratch: ScratchPool;
  // Stable slot indices for the scratch pool. Slot 0 holds the captured
  // backdrop (adjustment layer + overlay/soft-light blend); slot 1 holds
  // the spatial-conform (fit) target. They never alias in a single iteration.
  private static readonly SCRATCH_BACKDROP = 0;
  private static readonly SCRATCH_FIT = 1;
  readonly sources: FrameSourcePool;

  constructor(canvas: HTMLCanvasElement) {
    this.gl = createGL(canvas);
    this.shaders = new ShaderRegistry(this.gl);
    this.quad = createQuad(this.gl);
    this.pingPong = new PingPong(this.gl);
    this.scratch = new ScratchPool(this.gl);
    this.sources = new FrameSourcePool();
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  private playheadFn: () => number = () => 0;
  setPlayheadGetter(fn: () => number) {
    this.playheadFn = fn;
  }

  resize(cssWidth: number, cssHeight: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    this.pingPong.resize(w, h);
  }

  async renderFrame(project: Project, getAsset: (id: ID) => MediaAsset | undefined) {
    const gl = this.gl;
    getFrameProvider().retain(
      new Set(
        project.mediaLibrary.filter((asset) => asset.kind === "video").map((asset) => asset.id),
      ),
    );
    const visible = visibleAt(project, project.timeline.playhead);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (visible.length === 0) return;
    const ordered = [...visible].reverse();

    for (const clip of ordered) {
      // Adjustment layers re-process the frame already drawn beneath them.
      if (isAdjustmentClip(clip)) {
        this.applyAdjustmentLayer(clip, project);
        continue;
      }
      // Text clips may animate (typewriter changes the rendered glyphs).
      const textAnim = isTextClip(clip)
        ? textAnimAt(clip, Math.max(0, project.timeline.playhead - clip.start))
        : null;
      let sourceTex = await this.uploadClip(clip, getAsset, project, textAnim?.charFrac ?? 1);
      if (!sourceTex) continue;

      // Spatial conform: resample media into the frame aspect (fill/fit) so it
      // isn't stretched. Skipped for the default "stretch".
      if (isMediaClip(clip) && clip.fit && clip.fit !== "stretch") {
        const asset = getAsset(clip.assetId);
        if (asset?.width && asset?.height) {
          sourceTex = this.applyFit(sourceTex, asset.width / asset.height, clip.fit);
        }
      }

      let maskTexture: WebGLTexture | null = null;
      if (isMediaClip(clip) && clip.effects.some((e) => e.enabled && e.type === "bg-remove")) {
        const asset = getAsset(clip.assetId);
        if (asset) maskTexture = await this.uploadBgMask(asset);
      }

      // Resolve keyframe-driven effect param overrides at the current clip
      // time so animations actually move. Targets are dotted paths into the
      // params, e.g. "effects.<id>.amount".
      const { effects: animatedEffects, kfValues } = animateEffects(clip, project);
      const finalTex = this.applyEffectChain(sourceTex, animatedEffects, maskTexture);

      // Final composite to screen with clip transform applied. Slides/fades
      // fold into the transform; wipes drive a GPU mask instead. Transform
      // keyframes (transform.x/y/scale/rotation/opacity) override the static
      // transform when present.
      // Text animations override the base transform (fade/slide/pop); other
      // clips use their static transform plus any keyframe overrides.
      const baseTf = textAnim ? textAnim.transform : clipTransform(clip);
      const tf = {
        x: kfValues["transform.x"] ?? baseTf.x,
        y: kfValues["transform.y"] ?? baseTf.y,
        scale: kfValues["transform.scale"] ?? baseTf.scale,
        rotation: kfValues["transform.rotation"] ?? baseTf.rotation,
        opacity: kfValues["transform.opacity"] ?? baseTf.opacity,
      };
      const transition = activeTransitionFor(clip, project.timeline.playhead);
      const wipe = transition && isWipe(transition.type) ? transition : null;
      const composed = wipe ? tf : applyTransitionToTransform(tf, transition);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      if (isBackdropBlend(clip.blendMode)) {
        this.compositeBackdropBlend(
          finalTex,
          composed,
          clip.mask,
          clip.blendMode as "overlay" | "soft-light",
        );
      } else {
        setBlendMode(gl, clip.blendMode);
        const prog = this.shaders.get("blit");
        prog.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, finalTex);
        gl.uniform1i(prog.uniform("u_tex"), 0);
        setTransformUniforms(gl, prog, composed);
        setWipeUniforms(gl, prog, wipe);
        setMaskUniforms(gl, prog, clip.mask);
        this.quad.draw();
      }
    }
    // Restore default premultiplied-over blending for the next frame.
    setBlendMode(gl, "normal");
  }

  // Composites a clip with overlay/soft-light by capturing the backdrop and
  // blending it in a shader (fixed-function GL blending can't express these).
  private compositeBackdropBlend(
    finalTex: WebGLTexture,
    tf: { x: number; y: number; scale: number; rotation: number; opacity: number },
    mask: Clip["mask"],
    mode: "overlay" | "soft-light",
  ) {
    const gl = this.gl;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const backdrop = this.scratch.acquire(Compositor.SCRATCH_BACKDROP);
    gl.bindTexture(gl.TEXTURE_2D, backdrop.tex);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    setBlendMode(gl, "normal");
    const prog = this.shaders.get("blend-overlay");
    prog.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, finalTex);
    gl.uniform1i(prog.uniform("u_tex"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, backdrop.tex);
    gl.uniform1i(prog.uniform("u_backdrop"), 1);
    const resLoc = prog.uniform("u_resolution");
    if (resLoc) gl.uniform2f(resLoc, w, h);
    const modeLoc = prog.uniform("u_mode");
    if (modeLoc) gl.uniform1i(modeLoc, mode === "soft-light" ? 1 : 0);
    setTransformUniforms(gl, prog, tf);
    setMaskUniforms(gl, prog, mask);
    this.quad.draw();
  }

  // Renders `src` into a frame-sized scratch slot, resampled to cover (fill)
  // or be contained (fit) at the source's aspect ratio instead of stretched.
  private applyFit(src: WebGLTexture, sourceAspect: number, mode: "fill" | "fit"): WebGLTexture {
    const gl = this.gl;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    const frameAspect = w / h;
    const slot = this.scratch.acquire(Compositor.SCRATCH_FIT);
    // UV scale: <1 crops (cover), >1 letterboxes (contain).
    let sx = 1;
    let sy = 1;
    if (mode === "fill") {
      if (sourceAspect > frameAspect) sx = frameAspect / sourceAspect;
      else sy = sourceAspect / frameAspect;
    } else {
      if (sourceAspect > frameAspect) sy = sourceAspect / frameAspect;
      else sx = frameAspect / sourceAspect;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, slot.fbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const prog = this.shaders.get("fit");
    prog.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(prog.uniform("u_tex"), 0);
    // Neutralise the shared vertex transform so we draw fullscreen.
    gl.uniform4f(prog.uniform("u_dest"), 0, 0, 1, 1);
    gl.uniform2f(prog.uniform("u_translate"), 0, 0);
    gl.uniform1f(prog.uniform("u_scale"), 1);
    gl.uniform1f(prog.uniform("u_rotation"), 0);
    gl.uniform2f(prog.uniform("u_uv_scale"), sx, sy);
    this.quad.draw();
    return slot.tex;
  }

  // Captures the frame drawn so far, runs the adjustment's effect chain over
  // it, then redraws the result with the clip's mask + opacity. No-op when the
  // adjustment has no enabled effects.
  private applyAdjustmentLayer(clip: AdjustmentClip, project: Project) {
    const gl = this.gl;
    if (!clip.effects.some((e) => e.enabled)) return;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;

    const backdrop = this.scratch.acquire(Compositor.SCRATCH_BACKDROP);
    gl.bindTexture(gl.TEXTURE_2D, backdrop.tex);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, w, h, 0);

    const { effects, kfValues } = animateEffects(clip, project);
    const resultTex = this.applyEffectChain(backdrop.tex, effects, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    setBlendMode(gl, "normal");
    const prog = this.shaders.get("blit");
    prog.use();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, resultTex);
    gl.uniform1i(prog.uniform("u_tex"), 0);
    const tf = clipTransform(clip);
    const opacity = kfValues["transform.opacity"] ?? tf.opacity;
    setTransformUniforms(gl, prog, { x: 0, y: 0, scale: 1, rotation: 0, opacity });
    setWipeUniforms(gl, prog, null);
    setMaskUniforms(gl, prog, clip.mask);
    this.quad.draw();
  }

  private async uploadClip(
    clip: Clip,
    getAsset: (id: ID) => MediaAsset | undefined,
    project: Project,
    charFrac = 1,
  ): Promise<WebGLTexture | null> {
    if (isMediaClip(clip)) {
      const asset = getAsset(clip.assetId);
      if (!asset) return null;
      return this.uploadClipSource(clip, asset);
    }
    if (isTextClip(clip)) return this.uploadTextClip(clip, project, charFrac);
    if (isShapeClip(clip)) return this.uploadShapeClip(clip, project);
    return null;
  }

  private uploadTextClip(clip: TextClip, project: Project, charFrac = 1): WebGLTexture {
    const w = project.resolution.w;
    const h = project.resolution.h;
    const canvas = renderTextToCanvas(clip, w, h, charFrac);
    let tex = this.textTextures.get(clip.id);
    if (!tex) {
      tex = createTexture(this.gl);
      this.textTextures.set(clip.id, tex);
    }
    uploadSource(this.gl, tex, canvas);
    return tex;
  }

  private uploadShapeClip(clip: ShapeClip, project: Project): WebGLTexture {
    const w = project.resolution.w;
    const h = project.resolution.h;
    const canvas = renderShapeToCanvas(clip, w, h);
    let tex = this.textTextures.get(clip.id);
    if (!tex) {
      tex = createTexture(this.gl);
      this.textTextures.set(clip.id, tex);
    }
    uploadSource(this.gl, tex, canvas);
    return tex;
  }

  private applyEffectChain(
    input: WebGLTexture,
    effects: readonly EffectInstance[],
    maskTexture: WebGLTexture | null = null,
  ): WebGLTexture {
    const gl = this.gl;
    const enabled = effects.filter((e) => e.enabled);
    if (enabled.length === 0) return input;
    const { w, h } = this.pingPong.size();
    let current = input;

    for (const fx of enabled) {
      const def = getEffect(fx.type);
      if (!def) continue;
      for (const pass of def.passes) {
        const [, dst] = this.pingPong.current();
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
        gl.viewport(0, 0, w, h);
        const prog = this.shaders.get(pass.shader);
        prog.use();

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, current);
        gl.uniform1i(prog.uniform("u_tex"), 0);
        gl.uniform1f(prog.uniform("u_opacity"), 1);
        gl.uniform4f(prog.uniform("u_dest"), 0, 0, 1, 1);
        // Effect passes always draw fullscreen — neutralise any transform
        // uniforms that the shared vertex shader might still consume.
        const translate = prog.uniform("u_translate");
        if (translate) gl.uniform2f(translate, 0, 0);
        const scaleLoc = prog.uniform("u_scale");
        if (scaleLoc) gl.uniform1f(scaleLoc, 1);
        const rotLoc = prog.uniform("u_rotation");
        if (rotLoc) gl.uniform1f(rotLoc, 0);
        const aspectLoc = prog.uniform("u_aspect");
        if (aspectLoc) gl.uniform1f(aspectLoc, 1);
        const texel = prog.uniform("u_texel");
        if (texel) gl.uniform2f(texel, 1 / w, 1 / h);
        // Disable any wipe mask the shared blit shader might consume.
        const wipeModeLoc = prog.uniform("u_wipe_mode");
        if (wipeModeLoc) gl.uniform1i(wipeModeLoc, 0);
        const maskShapeLoc = prog.uniform("u_mask_shape");
        if (maskShapeLoc) gl.uniform1i(maskShapeLoc, 0);

        const maskLoc = prog.uniform("u_mask");
        const hasMaskLoc = prog.uniform("u_has_mask");
        if (maskLoc) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, maskTexture ?? current);
          gl.uniform1i(maskLoc, 1);
          if (hasMaskLoc) gl.uniform1i(hasMaskLoc, maskTexture ? 1 : 0);
        }

        // LUT binding — only for the lut shader when a stored LUT is selected.
        if (fx.type === "lut") {
          const lutId = String(fx.params.lutId ?? "");
          const stored = lutId ? useLutStore.getState().getLut(lutId) : undefined;
          if (stored) {
            try {
              const { tex, size } = uploadLutTexture(gl, lutId, stored.raw);
              gl.activeTexture(gl.TEXTURE2);
              gl.bindTexture(gl.TEXTURE_2D, tex);
              const lutLoc = prog.uniform("u_lut");
              const sizeLoc = prog.uniform("u_lut_size");
              if (lutLoc) gl.uniform1i(lutLoc, 2);
              if (sizeLoc) gl.uniform1f(sizeLoc, size);
            } catch {
              /* malformed LUT — skip this pass's mapping */
            }
          }
        }

        const uniforms = pass.uniforms({ params: fx.params, width: w, height: h });
        for (const [name, value] of Object.entries(uniforms)) {
          const loc = prog.uniform(name);
          if (!loc) continue;
          if (Array.isArray(value)) {
            if (value.length === 2) gl.uniform2f(loc, value[0]!, value[1]!);
            else if (value.length === 3) gl.uniform3f(loc, value[0]!, value[1]!, value[2]!);
            else if (value.length === 4)
              gl.uniform4f(loc, value[0]!, value[1]!, value[2]!, value[3]!);
          } else if (typeof value === "number") {
            gl.uniform1f(loc, value);
          }
        }
        this.quad.draw();
        current = dst.tex;
        this.pingPong.swap();
      }
    }
    return current;
  }

  private readonly decodePrepared = new Set<string>();

  private async uploadClipSource(clip: MediaClip, asset: MediaAsset): Promise<WebGLTexture | null> {
    // Map timeline time → source time. A frozen clip always shows one source
    // frame; otherwise this is the speed-ramp integral (or constant-speed).
    const clipRel = this.playheadFn() - clip.start;
    const relativeMs =
      clip.freeze !== undefined
        ? clip.freeze
        : (clip.trimIn ?? 0) + sourceOffsetForRamp(clip, Math.max(0, clipRel));

    // WebCodecs fast path: if we have a decoded frame near this timestamp,
    // upload it instead of seeking the <video>.
    if (asset.kind === "video") {
      const provider = getFrameProvider();
      // Prepare the decoder once per asset, asynchronously.
      if (!this.decodePrepared.has(asset.id)) {
        this.decodePrepared.add(asset.id);
        void readMediaFile(asset.opfsPath).then((blob) => {
          if (blob) void provider.prepare(asset.id, blob);
        });
      }
      const frame = provider.framesFor(asset.id, Math.max(0, relativeMs));
      if (frame) {
        let tex = this.assetTextures.get(asset.id);
        if (!tex) {
          tex = createTexture(this.gl);
          this.assetTextures.set(asset.id, tex);
        }
        uploadSource(this.gl, tex, frame);
        return tex;
      }
    }

    // Fallback: <video> / <img> element seek.
    const source = await this.sources.get(asset);
    if (!source) return null;
    if (source instanceof HTMLVideoElement) {
      const targetSec = Math.max(0, relativeMs / 1000);
      if (Math.abs(source.currentTime - targetSec) > 0.04) {
        source.currentTime = targetSec;
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            source.removeEventListener("seeked", onSeeked);
            resolve();
          };
          source.addEventListener("seeked", onSeeked);
        });
      }
    }
    let tex = this.assetTextures.get(asset.id);
    if (!tex) {
      tex = createTexture(this.gl);
      this.assetTextures.set(asset.id, tex);
    }
    uploadSource(this.gl, tex, source);
    return tex;
  }

  private async uploadBgMask(asset: MediaAsset): Promise<WebGLTexture | null> {
    const source = await this.sources.get(asset);
    if (!source) return null;

    // Reuse the last mask when the source frame hasn't moved. `currentTime`
    // is stable across idle re-renders of a paused clip and identical for
    // still images (which lack it, so they key on 0).
    const srcTime = "currentTime" in source ? source.currentTime : 0;
    const cached = this.bgMaskTextures.get(asset.id);
    if (cached && this.bgMaskTime.get(asset.id) === srcTime) return cached;

    try {
      const segmenter = await getSegmenter();
      const mask = await segmenter.segmentFor(source);
      if (!mask) return null;
      let tex = cached;
      if (!tex) {
        tex = createTexture(this.gl);
        this.bgMaskTextures.set(asset.id, tex);
      }
      uploadSource(this.gl, tex, mask);
      this.bgMaskTime.set(asset.id, srcTime);
      return tex;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("bg-remove mask failed:", err);
      return null;
    }
  }

  // (helper kept outside the class for testability)
  // ----

  dispose() {
    for (const tex of this.assetTextures.values()) this.gl.deleteTexture(tex);
    this.assetTextures.clear();
    for (const tex of this.textTextures.values()) this.gl.deleteTexture(tex);
    this.textTextures.clear();
    for (const tex of this.bgMaskTextures.values()) this.gl.deleteTexture(tex);
    this.bgMaskTextures.clear();
    this.bgMaskTime.clear();
    this.scratch.dispose();
    this.shaders.dispose();
    this.pingPong.dispose();
    this.sources.dispose();
  }
}

// Fold the transition's effect into the clip transform we hand to GL.
// `progress` is 1 when the clip is fully opaque and 0 when fully gone.
function applyTransitionToTransform(
  tf: { x: number; y: number; scale: number; rotation: number; opacity: number },
  transition: TransitionFrame | null,
): typeof tf {
  if (!transition) return tf;
  const p = transition.progress;
  switch (transition.type) {
    case "fade":
    case "cross-dissolve":
    case "dip-to-black":
    case "dip-to-white": {
      return { ...tf, opacity: tf.opacity * p };
    }
    case "slide-left":
      return { ...tf, x: tf.x + (1 - p), opacity: tf.opacity * Math.min(1, p * 1.2) };
    case "slide-right":
      return { ...tf, x: tf.x - (1 - p), opacity: tf.opacity * Math.min(1, p * 1.2) };
    case "slide-up":
      return { ...tf, y: tf.y + (1 - p), opacity: tf.opacity * Math.min(1, p * 1.2) };
    case "slide-down":
      return { ...tf, y: tf.y - (1 - p), opacity: tf.opacity * Math.min(1, p * 1.2) };
    case "zoom-in":
      // Grows from small to full while fading in.
      return { ...tf, scale: tf.scale * (0.5 + 0.5 * p), opacity: tf.opacity * p };
    case "zoom-out":
      // Shrinks from oversized to full while fading in.
      return { ...tf, scale: tf.scale * (1.5 - 0.5 * p), opacity: tf.opacity * p };
    case "spin":
      // Rotates into place (half turn) while fading in.
      return { ...tf, rotation: tf.rotation + (1 - p) * Math.PI, opacity: tf.opacity * p };
    default:
      // Wipe variants are handled by the GPU mask path, never reaching here.
      // Any unknown type falls back to a plain fade.
      return { ...tf, opacity: tf.opacity * p };
  }
}
