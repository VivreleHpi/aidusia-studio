import { useSyncExternalStore } from "react";
import { getPwaStatus, subscribePwaStatus } from "@/lib/offline";

export function usePwaStatus() {
  return useSyncExternalStore(subscribePwaStatus, getPwaStatus, getPwaStatus);
}
