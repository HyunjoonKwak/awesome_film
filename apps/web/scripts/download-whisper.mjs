#!/usr/bin/env node
// Pre-fetches the Whisper transcription model used by the AI panel and
// drops it under public/whisper/Xenova/whisper-tiny.en/. With these files
// present the desktop bundle can transcribe audio offline from first launch
// — `env.localModelPath = "/whisper/"` in apps/web/src/ai/transcribe.ts
// makes the runtime check this directory before reaching out to the network.
//
// Re-run safely: existing files are skipped unless --force is passed.
//
// Usage:
//   node apps/web/scripts/download-whisper.mjs
//   node apps/web/scripts/download-whisper.mjs --force

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit } from "node:process";

const REPO = "Xenova/whisper-tiny.en";
// q8 quantised variant — matches `dtype: "q8"` in transcribe.ts.
const FILES = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];

const force = argv.includes("--force");
const here = dirname(fileURLToPath(import.meta.url));
const targetRoot = resolve(here, "..", "public", "whisper", REPO);

const fmtMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const fileExists = async (p) => {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
};

const download = async (relPath) => {
  const url = `https://huggingface.co/${REPO}/resolve/main/${relPath}`;
  const dest = join(targetRoot, relPath);
  if (!force && (await fileExists(dest))) {
    const size = (await stat(dest)).size;
    console.log(`  ✓ ${relPath} (cached, ${fmtMb(size)})`);
    return 0;
  }
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  await writeFile(dest, buf);
  console.log(`  ↓ ${relPath} (${fmtMb(buf.byteLength)})`);
  return buf.byteLength;
};

const main = async () => {
  console.log(`Downloading ${REPO} (q8) → ${targetRoot}`);
  await mkdir(targetRoot, { recursive: true });
  let total = 0;
  for (const f of FILES) {
    try {
      total += await download(f);
    } catch (err) {
      console.error(`  ✗ ${f}: ${err instanceof Error ? err.message : err}`);
      exit(1);
    }
  }
  console.log(`Done. ${fmtMb(total)} newly downloaded.`);
};

main().catch((err) => {
  console.error(err);
  exit(1);
});
