import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

/**
 * Wraps useMutation with a default onError that shows a toast.
 * Use for consistent error feedback across the app (replaces alert()).
 */
export function useMutationWithToast<TData, TError = Error, TVariables = void>(
  options: UseMutationOptions<TData, TError, TVariables>
): ReturnType<typeof useMutation<TData, TError, TVariables>> {
  const { onError, ...rest } = options;
  return useMutation({
    ...rest,
    onError: (err, variables, context) => {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      onError?.(err, variables, context);
    },
  });
}
