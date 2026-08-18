import type { CityPackageValidationResult } from './validateCityPackages.js';

export function validateCityPackageReleaseReferences(
  registry: unknown,
  packagesByPath: unknown,
  ledger: unknown,
  realityContracts?: unknown,
  releaseArtifactsByUri?: unknown,
): CityPackageValidationResult;
