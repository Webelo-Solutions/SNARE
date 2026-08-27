import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type { ResultStatus } from "@/lib/types";

export function useUpdateResultStatus() {
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ResultStatus }) =>
      api.updateResultStatus(id, status),
  });
}
