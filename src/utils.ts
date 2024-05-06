import { std } from "./deps/mod.ts";

declare const __brand: unique symbol;
export type Brand<K, T> = K & { [__brand]: T }

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

export const hashString =
    async (algorithm: AlgorithmIdentifier, input: string) =>
        std.encoding.encodeHex(await crypto.subtle.digest(algorithm, textEncoder.encode(input)));

export const isAbortError =
    (error: unknown): error is DOMException =>
        ((error instanceof DOMException) && `${ error }`.startsWith("AbortError:"));
