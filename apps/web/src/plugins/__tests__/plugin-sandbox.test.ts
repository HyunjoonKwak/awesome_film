import { describe, expect, it } from "vitest";
import { normalizePluginUrl, parseSandboxedEffect } from "../plugin-sandbox";

const effect = {
  type: "test-effect",
  name: "Test effect",
  keywords: ["test"],
  category: "color",
  params: [
    { kind: "number", key: "amount", label: "Amount", min: 0, max: 1, step: 0.1, default: 1 },
  ],
  passes: [{ shader: "test-shader", uniforms: { u_amount: "amount", u_fixed: [1, 2] } }],
};

describe("plugin sandbox boundary", () => {
  it("allows HTTPS and loopback HTTP but rejects privileged or insecure URLs", () => {
    expect(normalizePluginUrl("/plugin.js", "https://editor.example/app")).toBe(
      "https://editor.example/plugin.js",
    );
    expect(normalizePluginUrl("http://localhost:3000/plugin.js", "https://editor.example")).toBe(
      "http://localhost:3000/plugin.js",
    );
    expect(
      normalizePluginUrl("http://plugins.example/plugin.js", "https://editor.example"),
    ).toBeNull();
    expect(normalizePluginUrl("javascript:alert(1)", "https://editor.example")).toBeNull();
  });

  it("turns declarative uniform bindings into a renderer definition", () => {
    const parsed = parseSandboxedEffect(effect);
    expect(parsed).not.toBeNull();
    expect(
      parsed?.passes[0]?.uniforms({ params: { amount: 0.25 }, width: 10, height: 10 }),
    ).toEqual({
      u_amount: 0.25,
      u_fixed: [1, 2],
    });
  });

  it("rejects executable callbacks and oversized definitions", () => {
    expect(
      parseSandboxedEffect({
        ...effect,
        passes: [{ shader: "test-shader", uniforms: () => ({ u_amount: 1 }) }],
      }),
    ).toBeNull();
    expect(parseSandboxedEffect({ ...effect, type: "x".repeat(65) })).toBeNull();
  });
});
