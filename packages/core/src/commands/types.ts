import type { Project } from "../model/project";

// A command is a pure project -> project transform. The history layer captures
// before/after snapshots so undo/redo and collab broadcast are uniform.
export interface Command {
  readonly label: string;
  readonly apply: (project: Project) => Project;
}

export interface AppliedCommand {
  readonly label: string;
  readonly before: Project;
  readonly after: Project;
  readonly at: number;
}
