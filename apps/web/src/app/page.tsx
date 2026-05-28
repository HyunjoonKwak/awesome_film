import Link from "next/link";
import { ArrowRight, Film, Sparkles, Users, Wand2 } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-native",
    body: "Auto subtitles, silence removal, scene detection, and background removal run locally.",
  },
  {
    icon: Users,
    title: "Realtime co-edit",
    body: "Edit with your team like Figma — CRDT-backed, offline-first.",
  },
  {
    icon: Wand2,
    title: "Magnetic timeline",
    body: "Final Cut Pro craft, CapCut speed, in your browser.",
  },
];

export default function HomePage() {
  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <header className="flex items-center gap-3 text-ink-2">
          <Film className="size-6 text-accent" />
          <span className="text-sm uppercase tracking-[0.2em]">cut_editor</span>
        </header>

        <section className="mt-16 max-w-3xl">
          <h1 className="text-balance text-5xl font-semibold leading-tight text-ink-1 md:text-6xl">
            The video editor that's <span className="text-accent">open</span>,{" "}
            <span className="text-accent">AI-native</span>, and{" "}
            <span className="text-accent">collaborative</span>.
          </h1>
          <p className="mt-6 text-lg text-ink-2">
            Beat Final Cut Pro and CapCut on the four things neither can compete on at
            once: open source, AI-first workflow, realtime collaboration, and web-first
            reach.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/editor" className="btn-primary text-base">
              Open the editor
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="https://github.com/OpenCut-app/OpenCut"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost"
            >
              See the inspiration
            </a>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="panel rounded-xl p-5">
              <Icon className="size-5 text-accent" />
              <h3 className="mt-4 text-base font-medium text-ink-1">{title}</h3>
              <p className="mt-1 text-sm text-ink-2">{body}</p>
            </div>
          ))}
        </section>

        <footer className="mt-24 text-xs text-ink-3">
          Phase 0 — scaffold. See <code className="text-ink-2">docs/02-architecture.md</code>{" "}
          for the roadmap.
        </footer>
      </div>
    </main>
  );
}
