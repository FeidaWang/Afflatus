export interface WebGLContextState {
  id: string;
  leased: boolean;
  fallback: boolean;
  fallbackReason: string;
  lossCount: number;
}

export interface WebGLContextEvent {
  id: string;
  lossCount: number;
}

export interface WebGLFallbackEvent extends WebGLContextEvent {
  reason: string;
}

export interface WebGLContextLifecycle {
  readonly id: string;
  readonly canInitialize: boolean;
  readonly signal: AbortSignal;
  getState(): Readonly<WebGLContextState>;
  dispose(): void;
}

export function createWebGLContextLifecycle(options: {
  id: string;
  canvas: HTMLCanvasElement;
  window?: Window | null;
  document?: Document | null;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  contextLimit?: number;
  lossLimit?: number;
  showFallback?: boolean;
  reload?: () => void;
  onLost?: (event: Readonly<WebGLContextEvent>) => void;
  onRestore?: (event: Readonly<WebGLContextEvent>) => void;
  onFallback?: (event: Readonly<WebGLFallbackEvent>) => void;
  onDispose?: () => void;
}): WebGLContextLifecycle;

export function canAcquireWebGLContext(id: string, contextLimit?: number): boolean;

export function disposeThreeScene(
  root?: { traverse?: (callback: (object: any) => void) => void } | null,
  renderer?: {
    renderLists?: { dispose?: () => void };
    dispose?: () => void;
    forceContextLoss?: () => void;
  } | null,
  extras?: any[],
): void;

export function getWebGLContextTelemetry(): Readonly<{
  activeContexts: number;
  contextLimit: number;
  activeIds: readonly string[];
  fallbackIds: readonly string[];
}>;

export function resetWebGLLifecycleForTest(): void;
