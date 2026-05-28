export function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

export function never(value: never, message = "unexpected value"): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
