import { useQuery } from "@tanstack/react-query";
import type { AggregateStats } from "@/lib/types";

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: (): Promise<AggregateStats> => fetch("/api/stats").then((r) => r.json()),
    refetchInterval: 60_000,
  });
}
