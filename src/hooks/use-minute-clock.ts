"use client";

import { useSyncExternalStore } from "react";

// The current time, rounded down to the minute, that re-renders its users
// once a minute. Reading the clock through a store keeps rendering pure, and
// the rounding keeps the value stable between reads.

const MINUTE = 60_000;

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, MINUTE);
  return () => clearInterval(timer);
}

function currentMinute(): number {
  return Math.floor(Date.now() / MINUTE) * MINUTE;
}

/** Milliseconds since the epoch, to the minute; 0 during server rendering. */
export function useMinuteClock(): number {
  return useSyncExternalStore(subscribe, currentMinute, () => 0);
}
