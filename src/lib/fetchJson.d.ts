export type JsonDataErrorCode =
  | 'ABORTED'
  | 'HTTP'
  | 'INVALID_KEY'
  | 'NETWORK'
  | 'PARSE'
  | 'SCHEMA'
  | 'TIMEOUT'
  | 'UNKNOWN_KEY';

export class JsonDataError extends Error {
  code: JsonDataErrorCode;
  key: string;
  url: string;
  status: number;
  retriable: boolean;
  validationErrors: string[];
}

export interface FetchJsonOptions {
  signal?: AbortSignal;
  freshness?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  forceRefresh?: boolean;
}

export function fetchJson<T = unknown>(key: string, options?: FetchJsonOptions): Promise<T>;
export function clearJsonCacheForTests(): void;
export const JSON_RESOURCE_KEYS: readonly string[];
