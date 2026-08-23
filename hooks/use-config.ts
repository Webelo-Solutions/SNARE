import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { Config } from "@/lib/types";

export const configKey = ["config"] as const;

export function useConfig() {
  return useQuery({ queryKey: configKey, queryFn: api.getConfig });
}

export function useSaveConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Config) => api.saveConfig(config),
    onSuccess: (saved) => {
      queryClient.setQueryData(configKey, saved);
    },
  });
}

export function useAddTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => api.addTarget(domain),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configKey }),
  });
}

export function useRemoveTarget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => api.removeTarget(domain),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: configKey }),
  });
}
