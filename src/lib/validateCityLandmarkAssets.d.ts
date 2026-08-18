export interface CityLandmarkAssetValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateCityLandmarkAssetAdmission(
  data: unknown,
  cityContract: unknown,
): CityLandmarkAssetValidationResult;

export function validateCityLandmarkAssetReferences(
  data: unknown,
  cityContract: unknown,
  assetsByUri: unknown,
): CityLandmarkAssetValidationResult;
