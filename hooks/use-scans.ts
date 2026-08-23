import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";

export function useScanHistory(limit = 50) {
  return useQuery({
    queryKey: ["scans", "history", limit],
    queryFn: () => api.getScanHistory(limit),
    refetchInterval: 30_000,
  });
}

export function useLatestScan() {
  return useQuery({ queryKey: ["scans", "latest"], queryFn: api.getLatestScan });
}

export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targets?: string[]) => api.startScan(targets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans", "history"] });
    },
  });
}

export function useStopScan() {
  return useMutation({
    mutationFn: (scanId: number) => api.stopScan(scanId),
  });
}
