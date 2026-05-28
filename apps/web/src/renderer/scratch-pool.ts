// Frame-sized scratch textures shared across render passes. Multiple passes
// (backdrop capture for overlay/soft-light blends, adjustment-layer capture,
// spatial-conform fit target) each used to keep their own private texture
// + framebuffer pair with duplicated lazy-alloc / resize logic. The pool
// consolidates that into a single, indexed cache.
//
// Slots are addressed by a stable integer so independent call sites can
// reserve "slot 0 = backdrop", "slot 1 = fit target" without coordination.
// Concurrent use of the SAME slot in one frame would alias — but the
// compositor's pipeline only ever holds one role at a time per slot.

import type { GL } from "./gl";
import { createTexture } from "./gl";

export interface ScratchSlot {
  readonly tex: WebGLTexture;
  readonly fbo: WebGLFramebuffer;
}

export class ScratchPool {
  private slots: ScratchSlot[] = [];
  private size = { w: 0, h: 0 };

  constructor(private readonly gl: GL) {}

  // Hand back the slot at `index`, reallocating all slots when the drawing
  // buffer has resized since the last call. Allocates new slots on demand.
  acquire(index: number): ScratchSlot {
    this.ensureSize();
    while (this.slots.length <= index) this.slots.push(this.allocSlot());
    return this.slots[index]!;
  }

  dispose(): void {
    for (const s of this.slots) {
      this.gl.deleteTexture(s.tex);
      this.gl.deleteFramebuffer(s.fbo);
    }
    this.slots = [];
    this.size = { w: 0, h: 0 };
  }

  private ensureSize(): void {
    const w = this.gl.drawingBufferWidth;
    const h = this.gl.drawingBufferHeight;
    if (w === this.size.w && h === this.size.h && this.slots.length > 0) return;
    // Viewport changed (or first call): blow away cached slots so the next
    // acquire reallocates at the correct size.
    this.dispose();
    this.size = { w, h };
  }

  private allocSlot(): ScratchSlot {
    const gl = this.gl;
    const tex = createTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.size.w,
      this.size.h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error("ScratchPool: createFramebuffer failed");
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo };
  }
}
