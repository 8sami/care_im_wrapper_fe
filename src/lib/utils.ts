import { type ClassValue, clsx } from "clsx";
import type { KeyboardEvent } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Makes a non-native clickable element (e.g. a whole table row) keyboard-operable:
// spread the result alongside onClick and it fires the same handler on Enter/Space.
export function activateOnKey(handler: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handler();
      }
    },
  };
}

// Abortable so a debounced call can be cancelled the moment it's superseded, instead of
// waiting out the full delay and then firing a request that is already stale.
export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
