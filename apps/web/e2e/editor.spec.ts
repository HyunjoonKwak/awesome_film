import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const configurePage = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    localStorage.setItem("cut.locale.v1", JSON.stringify({ state: { locale: "en" }, version: 0 }));
    localStorage.setItem("cut.collab.welcomed", "1");
  });
};

const projectNamesInLibrary = async (page: Page): Promise<string[]> =>
  page.evaluate(
    async () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open("cut_editor.library.v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const request = db.transaction("projects", "readonly").objectStore("projects").getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            db.close();
            resolve(
              request.result.map((row: { name?: unknown }) =>
                typeof row.name === "string" ? row.name : "",
              ),
            );
          };
        };
      }),
  );

test.beforeEach(async ({ page }) => {
  await configurePage(page);
});

test("opens the editor from the landing page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open the editor" }).click();

  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByRole("button", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export", exact: true })).toBeVisible();
});

test("persists a newly named project across a reload", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("button", { name: "Projects" }).click();
  await page.getByRole("button", { name: "New", exact: true }).click();

  const projectName = page.locator('header input[type="text"]').first();
  await expect(projectName).toHaveValue("Untitled");
  await projectName.fill("E2E persistence project");
  await projectName.press("Enter");
  await expect(page).toHaveTitle("E2E persistence project — Reelog");

  await expect.poll(() => projectNamesInLibrary(page)).toContain("E2E persistence project");
  await page.reload();

  await expect(projectName).toHaveValue("E2E persistence project");
  await expect(page).toHaveTitle("E2E persistence project — Reelog");
});

test("synchronizes project edits between isolated browser sessions", async ({ browser, page }) => {
  let peerContext: BrowserContext | null = null;
  try {
    peerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const peerPage = await peerContext.newPage();
    await configurePage(peerPage);

    await Promise.all([page.goto("/editor"), peerPage.goto("/editor")]);
    const room = `e2e-${crypto.randomUUID()}`;
    for (const editorPage of [page, peerPage]) {
      await editorPage.getByLabel("room").fill(room);
      await editorPage.getByRole("button", { name: "Share" }).click();
      await expect(editorPage.getByTestId("collab-status")).toHaveAttribute(
        "data-status",
        "connected",
      );
    }

    const sourceName = page.locator('header input[type="text"]').first();
    const peerName = peerPage.locator('header input[type="text"]').first();
    await sourceName.fill("Shared E2E project");
    await sourceName.press("Enter");

    await expect(peerName).toHaveValue("Shared E2E project");

    const imageBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );
    await page.locator('input[type="file"][accept="video/*,audio/*,image/*"]').setInputFiles({
      name: "shared-pixel.png",
      mimeType: "image/png",
      buffer: imageBytes,
    });

    await expect(peerPage.getByText("shared-pixel.png", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        peerPage.evaluate(async (filename) => {
          const root = await navigator.storage.getDirectory();
          const keys = (root as unknown as { keys: () => AsyncIterable<string> }).keys();
          for await (const key of keys) {
            if (!key.endsWith(`__${filename}`)) continue;
            const file = await (await root.getFileHandle(key)).getFile();
            return Array.from(new Uint8Array(await file.arrayBuffer()));
          }
          return null;
        }, "shared-pixel.png"),
      )
      .toEqual(Array.from(imageBytes));
  } finally {
    await peerContext?.close();
  }
});
