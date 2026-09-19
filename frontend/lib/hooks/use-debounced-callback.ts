import { useEffect, useMemo, useRef } from "react";

/**
 * Returns a debounced version of `callback` that always calls the latest
 * reference, without re-creating the debounced function on every render.
 * Uso típico aquí: retrasar la búsqueda en el autocompletado de productos
 * mientras el usuario sigue escribiendo, para no pegarle a la API en cada tecla.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useMemo(
    () =>
      (...args: Args) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
      },
    [delayMs]
  );
}
