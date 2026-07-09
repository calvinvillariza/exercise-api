import { Result } from "../types/result";

export const mapResult = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => {
  if (!result.ok) return result;

  return { ok: true, value: fn(result.value) };
};
