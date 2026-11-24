import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { _resetSessionForTests } from "@/lib/auth/session";
import { tabSync } from "@/lib/auth/tab-sync";
import { resetDb } from "@/mocks/db";
import { server } from "@/mocks/node";

// jsdom não implementa estas APIs de layout (usadas pelo input-otp e pelo Radix).
document.elementFromPoint ??= () => null;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
beforeEach(() => {
  resetDb();
  _resetSessionForTests();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  tabSync._reset();
});
afterAll(() => server.close());
