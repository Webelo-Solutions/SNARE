import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/client/api";

export function useRequestScreenshot() {
  return useMutation({
    mutationFn: ({ domain, target }: { domain: string; target: string }) =>
      api.requestScreenshot(domain, target),
  });
}
