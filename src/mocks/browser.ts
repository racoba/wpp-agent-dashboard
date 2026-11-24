import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

export async function startMockWorker() {
  await worker.start({
    // Não registrar requisições no console: corpos têm tokens e telefones.
    quiet: true,
    onUnhandledFrame: "bypass",
  });
}
