// The spec runs in Node, but the page.evaluate callback below runs in the browser and needs DOM types.
/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

/**
 * Browser smoke test for the current prototype shell.
 *
 * What this verifies: the production build loads, the menu renders, Enter district starts the walk,
 * nothing overflows horizontally, and the browser reports no console errors, uncaught exceptions
 * or failed requests.
 *
 * What it does NOT verify: that the 3D scene looks correct or runs at a good frame rate. A canvas
 * element being mounted does not prove anything was drawn. WebGL support also depends on the machine
 * running the test, so the test records which path was taken instead of assuming one.
 */

type BrowserProblems = { consoleErrors: string[]; pageErrors: string[]; failedRequests: string[] };

function watchForBrowserProblems(page: Page): BrowserProblems {
  const problems: BrowserProblems = { consoleErrors: [], pageErrors: [], failedRequests: [] };

  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    problems.pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    problems.failedRequests.push(`${request.method()} ${request.url()} (${request.failure()?.errorText ?? "failed"})`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  return problems;
}

test.describe("Naija Hunt shell", () => {
  test("loads the production build and renders the main menu", async ({ page }) => {
    const problems = watchForBrowserProblems(page);

    const response = await page.goto("/");
    expect(response, "page navigation returned no response").not.toBeNull();
    expect(response?.ok(), `navigation status was ${response?.status()}`).toBe(true);

    await expect(page).toHaveTitle(/naija hunt/i);
    await expect(page.getByRole("heading", { level: 1, name: /naija hunt/i })).toBeVisible();
    await expect(page.getByText(/^palm mile$/i)).toBeVisible();
    await expect(page.getByText(/fictional district · visual preview/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /palm mile cache/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /enter district/i })).toBeEnabled();
    await expect(page.getByRole("navigation", { name: /primary/i })).toBeVisible();

    // Let the lazy 3D chunk and any late requests settle before judging the browser output.
    await page.waitForLoadState("networkidle");

    expect(problems.pageErrors, "uncaught page errors").toEqual([]);
    expect(problems.consoleErrors, "browser console errors").toEqual([]);
    expect(problems.failedRequests, "failed or error-status requests").toEqual([]);
  });

  test("starts the walk from Enter district and returns to the menu", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /enter district/i }).click();

    await expect(page.getByRole("status")).toContainText(/find the gold marker on palm plaza/i);
    await expect(page).toHaveURL(/play=1/);

    await page.getByRole("button", { name: /^menu$/i }).click();

    await expect(page.getByRole("button", { name: /enter district/i })).toBeVisible();
    await expect(page).not.toHaveURL(/play=1/);
  });

  test("does not overflow horizontally", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /naija hunt/i })).toBeVisible();

    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll, `scrollWidth ${widths.scroll} exceeds clientWidth ${widths.client}`).toBeLessThanOrEqual(
      widths.client,
    );
  });

  test("shows the 3D preview region, with either a canvas or the honest fallback", async ({ page }, testInfo) => {
    await page.goto("/");

    const region = page.getByRole("region", { name: /live 3d preview of palm mile/i });
    await expect(region).toBeAttached();

    const canvas = region.locator("canvas");
    const fallback = region.getByText(/3d preview unavailable on this device/i);

    // Wait for whichever outcome applies on this machine.
    await expect(canvas.or(fallback).first()).toBeAttached({ timeout: 15_000 });

    const hasCanvas = (await canvas.count()) > 0;
    testInfo.annotations.push({
      type: "webgl",
      description: hasCanvas
        ? "A canvas element was mounted. This does NOT prove the scene rendered correctly."
        : "WebGL was unavailable, so the app showed its text fallback. The 3D scene was NOT exercised.",
    });
  });
});
