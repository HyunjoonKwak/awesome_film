"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useViewStore } from "@/stores/view-store";
import { useT } from "@/i18n/use-t";
import type { MessageKey } from "@/i18n/messages";

const mod = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

const SHORTCUTS: readonly { keys: string; labelKey: MessageKey }[] = [
  { keys: "Space", labelKey: "sc.play" },
  { keys: "J K L", labelKey: "sc.shuttle" },
  { keys: "← →", labelKey: "sc.nudge" },
  { keys: "Home / End", labelKey: "sc.homeEnd" },
  { keys: "M", labelKey: "sc.marker" },
  { keys: ", .", labelKey: "sc.markerNav" },
  { keys: "S", labelKey: "sc.split" },
  { keys: `${mod} B`, labelKey: "sc.blade" },
  { keys: "Del", labelKey: "sc.delete" },
  { keys: "⇧ Del", labelKey: "sc.rippleDelete" },
  { keys: `${mod} Z`, labelKey: "sc.undo" },
  { keys: `${mod} ⇧ Z`, labelKey: "sc.redo" },
  { keys: `${mod} A`, labelKey: "sc.selectAll" },
  { keys: `${mod} G`, labelKey: "sc.group" },
  { keys: "I / O", labelKey: "sc.inout" },
  { keys: "Esc", labelKey: "sc.clear" },
  { keys: "?", labelKey: "sc.help" },
];

export function ShortcutCheatsheet() {
  const open = useViewStore((s) => s.showShortcuts);
  const setOpen = useViewStore((s) => s.setShowShortcuts);
  const t = useT();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/10 bg-panel-1 p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-medium text-ink-1">
              {t("sc.title")}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="rounded p-1 text-ink-3 hover:bg-white/10 hover:text-ink-1">
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <ul className="mt-4 space-y-1.5">
            {SHORTCUTS.map((s) => (
              <li key={s.labelKey} className="flex items-center justify-between text-sm">
                <span className="text-ink-2">{t(s.labelKey)}</span>
                <kbd className="rounded border border-white/10 bg-panel-2 px-2 py-0.5 font-mono text-[11px] text-ink-1">
                  {s.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
