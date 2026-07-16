import type { EffectDefinition } from "@/effects/types";
import { z } from "zod";

export const MAX_PLUGIN_BYTES = 256 * 1024;
export const MAX_SHADER_BYTES = 128 * 1024;

const finite = z.number().finite();
const uniformBinding = z.union([finite, z.array(finite).min(1).max(16), z.string().min(1).max(64)]);
const numberParam = z.object({
  kind: z.literal("number"),
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  min: finite,
  max: finite,
  step: finite.positive(),
  default: finite,
});
const booleanParam = z.object({
  kind: z.literal("boolean"),
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  default: z.boolean(),
});
const colorParam = z.object({
  kind: z.literal("color"),
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  default: z.string().min(1).max(32),
});
const enumParam = z.object({
  kind: z.literal("enum"),
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  options: z
    .array(z.object({ value: z.string().max(64), label: z.string().max(128) }))
    .min(1)
    .max(64),
  default: z.string().max(64),
});
const serializedEffectSchema = z.object({
  type: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  name: z.string().min(1).max(128),
  keywords: z.array(z.string().max(64)).max(32),
  category: z.enum(["color", "blur", "stylize", "transform", "audio"]),
  params: z
    .array(z.discriminatedUnion("kind", [numberParam, booleanParam, colorParam, enumParam]))
    .max(64),
  passes: z
    .array(
      z.object({
        shader: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
        uniforms: z.record(uniformBinding),
      }),
    )
    .min(1)
    .max(8),
});

const isLoopback = (hostname: string): boolean =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export const normalizePluginUrl = (raw: string, baseUrl: string): string | null => {
  try {
    const url = new URL(raw, baseUrl);
    if (url.username || url.password || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname))) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
};

export const parseSandboxedEffect = (raw: unknown): EffectDefinition | null => {
  const parsed = serializedEffectSchema.safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...parsed.data,
    passes: parsed.data.passes.map((pass) => ({
      shader: pass.shader,
      uniforms: ({ params }) => {
        const uniforms: Record<string, number | readonly number[]> = {};
        for (const [name, binding] of Object.entries(pass.uniforms)) {
          if (typeof binding === "number" || Array.isArray(binding)) {
            uniforms[name] = binding;
            continue;
          }
          const value = params[binding];
          uniforms[name] = typeof value === "number" ? value : value === true ? 1 : 0;
        }
        return uniforms;
      },
    })),
  };
};
