"use client";

import dynamic from "next/dynamic";

const EditorShell = dynamic(
  () => import("@/editor/editor-shell").then((m) => m.EditorShell),
  { ssr: false, loading: () => null },
);

export function EditorClient() {
  return <EditorShell />;
}
