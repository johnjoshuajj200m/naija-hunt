// Adds DOM matchers such as toBeInTheDocument() to Vitest's expect().
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only cleans up automatically when test globals are enabled.
// We run with globals: false, so unmount rendered components after each test here.
afterEach(() => {
  cleanup();
});
