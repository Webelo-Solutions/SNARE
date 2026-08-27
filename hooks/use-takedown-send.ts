import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/client/api";

export function useSendTakedown() {
  return useMutation({
    mutationFn: ({ resultId, to, notice }: { resultId: number | undefined; to: string; notice: string }) =>
      api.sendTakedown(resultId, to, notice),
  });
}
