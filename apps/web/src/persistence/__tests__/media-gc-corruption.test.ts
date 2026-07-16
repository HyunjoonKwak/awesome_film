import { createEmptyProject } from "@cut/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteMediaFile: vi.fn(),
  listMediaKeys: vi.fn(),
  listProjectsLibrary: vi.fn(),
  loadStoredProject: vi.fn(),
}));

vi.mock("../opfs", () => ({
  deleteMediaFile: mocks.deleteMediaFile,
  listMediaKeys: mocks.listMediaKeys,
}));

vi.mock("../project-library", () => ({
  listProjectsLibrary: mocks.listProjectsLibrary,
  loadStoredProject: mocks.loadStoredProject,
}));

import { collectMediaGarbage } from "../media-gc";

describe("media GC with damaged project storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listProjectsLibrary.mockResolvedValue([{ id: "damaged" }]);
    mocks.loadStoredProject.mockResolvedValue({ status: "corrupt" });
    mocks.listMediaKeys.mockResolvedValue(["possibly-recoverable.mov"]);
  });

  it("aborts without deleting media referenced by recoverable raw data", async () => {
    await expect(collectMediaGarbage(createEmptyProject())).resolves.toBe(0);
    expect(mocks.listMediaKeys).not.toHaveBeenCalled();
    expect(mocks.deleteMediaFile).not.toHaveBeenCalled();
  });
});
