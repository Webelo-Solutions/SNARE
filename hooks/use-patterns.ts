import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { Pattern } from "@/lib/types";

export const patternsKey = ["patterns"] as const;

export function usePatterns() {
  return useQuery({ queryKey: patternsKey, queryFn: api.getPatterns });
}

export function useCreatePattern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pattern: Omit<Pattern, "id">) => api.createPattern(pattern),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patternsKey }),
  });
}

export function useUpdatePattern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pattern> }) =>
      api.updatePattern(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patternsKey }),
  });
}

export function useDeletePattern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePattern(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patternsKey }),
  });
}
