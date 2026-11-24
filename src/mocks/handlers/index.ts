import { adminHandlers } from "./admin";
import { authHandlers } from "./auth";
import { clinicHandlers } from "./clinic";

export const handlers = [...authHandlers, ...clinicHandlers, ...adminHandlers];
