export type CityPackageCityId = 'shanghai' | 'melbourne' | 'hong-kong';
export type CityPackageDecision = 'review' | 'approved' | 'blocked' | 'rejected';
export type CityPackageRight = 'review' | 'allowed' | 'prohibited';

export interface CityPackageApproval {
  status: CityPackageDecision;
  by: string | null;
  at: string | null;
  evidence: string | null;
}

export interface CityPackageProvenance {
  ledgerLayerId: string;
  datasetId: string;
  provider: string;
  sourceUrl: string;
  datasetVersion: string;
  capturedAt: string | null;
  retrievedAt: string;
  sourceCrs: {
    status: 'declared' | 'review';
    identifier: string | null;
    axisOrder: string | null;
    unit: 'degree' | 'metre' | null;
  };
  verticalDatum: {
    status: 'declared' | 'not-applicable' | 'review';
    name: string | null;
    unit: 'metre' | null;
    transformPipeline: string | null;
  };
  spatialVerification: 'review' | 'verified';
  licenceSpdx: string | null;
  licenceUrl: string;
  licenceSnapshotSha256: string;
  attribution: string;
  sourceArtifactSha256: string;
  rights: {
    cache: CityPackageRight;
    derivatives: CityPackageRight;
    redistribution: CityPackageRight;
    commercialUse: CityPackageRight;
  };
  truthClass: 'authoritative' | 'community' | 'inferred' | 'art-directed';
  confidence: 'surveyed' | 'official' | 'community' | 'estimated';
  transformHistory: readonly string[];
}

export interface CityPackageAsset {
  id: string;
  kind: 'entities-index' | 'geometry' | 'properties' | 'texture' | 'poster';
  uri: string;
  sha256: string;
  byteLength: number;
  lod: 0 | 1 | 2 | null;
}

export interface CityPackageManifest {
  schemaVersion: 1;
  packageId: string;
  packageVersion: string;
  cityId: CityPackageCityId;
  truthClass: 'licensed-real-data';
  status: 'candidate' | 'production-approved';
  precinct: {
    status: 'candidate-unverified' | 'frozen';
    labels: { en: string; zh: string };
    boundsWgs84: { west: number; south: number; east: number; north: number };
    anchorWgs84: { longitude: number; latitude: number; ellipsoidHeight: number };
    localFrame: 'ENU';
    ianaTimeZone: 'Asia/Shanghai' | 'Australia/Melbourne' | 'Asia/Hong_Kong';
  };
  sourceLayers: readonly CityPackageProvenance[];
  assets: readonly CityPackageAsset[];
  generatedAt: string;
  approvals: {
    dataOwner: CityPackageApproval;
    legal: CityPackageApproval;
    engineering: CityPackageApproval;
    productRelease: CityPackageApproval;
  };
  release: {
    featureFlag: string;
    withdrawalOwner: string;
    rollbackPackageId: string | null;
  };
}

export interface CityPackageRegistryReference {
  packageId: string;
  manifestPath: string;
  manifestSha256: string;
}

export interface CityPackageRegistry {
  schemaVersion: 1;
  registryId: string;
  cityOrder: readonly CityPackageCityId[];
  productionPackages: Readonly<Record<CityPackageCityId, CityPackageRegistryReference | null>>;
}
