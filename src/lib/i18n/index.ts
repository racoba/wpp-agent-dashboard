import { ptBR, type Messages } from "./pt-BR";

/**
 * i18n mínimo: um dicionário por idioma e chaves tipadas ("auth.login.title").
 * Só pt-BR por enquanto; para outro idioma, criar um objeto com o mesmo
 * formato de `Messages` e registrar em `dictionaries`.
 */
export type Locale = "pt-BR";

const dictionaries: Record<Locale, Messages> = { "pt-BR": ptBR };

export const locale: Locale = "pt-BR";

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Leaves<T> = T extends string ? never : { [K in keyof T]: T[K] extends string ? K : Join<K, Leaves<T[K]>> }[keyof T];

export type MessageKey = Leaves<Messages>;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let value: unknown = dictionaries[locale];
  for (const part of key.split(".")) {
    value = (value as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof value !== "string") return key;
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
