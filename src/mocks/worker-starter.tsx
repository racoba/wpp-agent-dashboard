"use client";

import { useEffect } from "react";
import { startMockWorker } from "./browser";

let started: Promise<void> | null = null;

/** Carregado só no navegador (next/dynamic com ssr: false): msw/browser não existe no Node. */
export default function MockWorkerStarter({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    started ??= startMockWorker();
    void started.then(onReady);
  }, [onReady]);
  return null;
}
