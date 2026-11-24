import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { errorMessage, isApiError } from "./errors";

/**
 * Leva um 400 VALIDATION_ERROR do backend para os campos do formulário.
 * SUPOSIÇÃO: details = { fields: { campo: mensagem } }.
 * Erros sem campo viram erro "root". Devolve true se tratou algo.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly string[],
): boolean {
  if (isApiError(error) && error.code === "VALIDATION_ERROR") {
    const fields = (error.details as { fields?: Record<string, string> } | undefined)?.fields ?? {};
    let handled = false;
    for (const [field, message] of Object.entries(fields)) {
      if (knownFields.includes(field)) {
        setError(field as Path<T>, { type: "server", message });
        handled = true;
      } else {
        setError("root.server" as Path<T>, { type: "server", message });
        handled = true;
      }
    }
    if (handled) return true;
  }
  setError("root.server" as Path<T>, { type: "server", message: errorMessage(error) });
  return true;
}
