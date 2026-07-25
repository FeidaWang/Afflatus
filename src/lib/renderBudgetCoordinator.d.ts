export type RenderCost = 'low' | 'medium' | 'high';
export type RenderQualityTier = 'low' | 'balanced' | 'high';

export interface RenderPolicy {
  readonly qualityTier: RenderQualityTier;
  readonly refreshHz: number;
  readonly pixelBudget: number;
  readonly targetFps: number;
  readonly reducedMotion: boolean;
  computeDpr(
    cssWidth: number,
    cssHeight: number,
    limits?: { minDpr?: number; maxDpr?: number },
  ): number;
}

export interface RenderViewport {
  readonly width: number;
  readonly height: number;
  readonly deviceDpr: number;
}

export interface RenderSurfaceSpec {
  id: string;
  element?: Element | null;
  observe?: boolean;
  cost?: RenderCost;
  targetFps?: number;
  enabled?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onResize?: (viewport: RenderViewport) => void;
  onQualityChange?: (policy: RenderPolicy) => void;
  onDispose?: () => void;
}

export interface RenderSurfaceHandle {
  readonly id: string;
  pause(): void;
  resume(): void;
  unregister(): void;
  dispose(): void;
  reportFrame(durationMs: number): void;
  getPolicy(): RenderPolicy;
}

export interface RenderBudgetCoordinator {
  register(spec: RenderSurfaceSpec): RenderSurfaceHandle;
  destroy(): void;
  getPolicy(spec?: { cost?: RenderCost; targetFps?: number }): RenderPolicy;
  getTelemetry(): {
    readonly qualityTier: RenderQualityTier;
    readonly qualityCeiling: RenderQualityTier;
    readonly refreshHz: number;
    readonly pageFrozen: boolean;
    readonly activeSurfaces: number;
    readonly surfaces: ReadonlyArray<{
      readonly id: string;
      readonly active: boolean;
      readonly cost: RenderCost;
      readonly targetFps: number;
      readonly p95Ms: number;
    }>;
  };
}

export function createRenderBudgetCoordinator(options?: object): RenderBudgetCoordinator;
export function getRenderBudgetCoordinator(): RenderBudgetCoordinator;
