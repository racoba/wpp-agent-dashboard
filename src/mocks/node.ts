import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/** Mesmo mock da API, para os testes (Vitest). */
export const server = setupServer(...handlers);
