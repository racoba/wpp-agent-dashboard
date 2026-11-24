"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Se definido, a coluna fica ordenável (na página carregada). */
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
}

type SortState = { id: string; direction: "asc" | "desc" } | null;

export interface CursorPaginationControls {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export interface DataTableProps<T> {
  /** Texto para leitores de tela descrevendo a tabela. */
  caption: string;
  columns: DataTableColumn<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  isLoading?: boolean;
  /** Recarregando em segundo plano (mantém as linhas, reduz a opacidade). */
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: { title: string; description?: string; action?: React.ReactNode };
  pagination?: CursorPaginationControls;
  skeletonRows?: number;
}

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  isLoading,
  isFetching,
  error,
  onRetry,
  empty,
  pagination,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    if (!rows || !sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.sortValue!(a);
      const vb = column.sortValue!(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return collator.compare(String(va), String(vb)) * factor;
    });
  }, [rows, sort, columns]);

  const toggleSort = useCallback((id: string) => {
    setSort((current) => {
      if (current?.id !== id) return { id, direction: "asc" };
      if (current.direction === "asc") return { id, direction: "desc" };
      return null;
    });
  }, []);

  if (error && !rows) return <ErrorState error={error} onRetry={onRetry} />;

  if (!isLoading && rows && rows.length === 0 && (!pagination || pagination.page === 1)) {
    return <EmptyState title={empty?.title ?? t("table.empty")} description={empty?.description} action={empty?.action} />;
  }

  return (
    <div className="space-y-3">
      <div className={cn("rounded-xl border transition-opacity", isFetching && !isLoading && "opacity-70")}>
        <Table aria-busy={isLoading || isFetching ? true : undefined}>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const active = sort?.id === column.id ? sort.direction : null;
                return (
                  <TableHead
                    key={column.id}
                    className={column.headerClassName}
                    aria-sort={active ? (active === "asc" ? "ascending" : "descending") : column.sortValue ? "none" : undefined}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className="-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        title={active === "asc" ? t("table.sortDesc") : t("table.sortAsc")}
                      >
                        {column.header}
                        {active === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : active === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || !sortedRows
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((column) => (
                      <TableCell key={column.id}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : sortedRows.map((row) => (
                  <TableRow key={getRowId(row)}>
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
      {pagination && (pagination.hasNext || pagination.hasPrevious) ? (
        <nav className="flex items-center justify-end gap-2" aria-label="Paginação">
          <span className="mr-auto text-sm text-muted-foreground" aria-live="polite">
            {t("table.page", { page: pagination.page })}
          </span>
          <Button variant="outline" size="sm" onClick={pagination.onPrevious} disabled={!pagination.hasPrevious}>
            <ChevronLeft aria-hidden /> {t("common.previous")}
          </Button>
          <Button variant="outline" size="sm" onClick={pagination.onNext} disabled={!pagination.hasNext}>
            {t("common.next")} <ChevronRight aria-hidden />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}

/**
 * Pilha de cursores para paginação "anterior/próxima" sobre uma API que só
 * devolve `nextCursor`.
 */
export function useCursorPagination() {
  const [stack, setStack] = useState<Array<string | null>>([null]);
  const cursor = stack[stack.length - 1] ?? null;

  const controls = useCallback(
    (nextCursor: string | null | undefined): CursorPaginationControls => ({
      page: stack.length,
      hasPrevious: stack.length > 1,
      hasNext: !!nextCursor,
      onPrevious: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      onNext: () => {
        if (nextCursor) setStack((s) => [...s, nextCursor]);
      },
    }),
    [stack],
  );

  const reset = useCallback(() => setStack([null]), []);

  return { cursor, controls, reset };
}
