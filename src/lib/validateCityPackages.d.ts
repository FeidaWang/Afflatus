export interface CityPackageValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateCityPackageManifest(data: unknown): CityPackageValidationResult;
export function canPublishCityPackage(data: unknown): boolean;
