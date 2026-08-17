import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canAcquireCityLayer,
  canPublishCityLayer,
  validateCityDataLedger,
  validateCityLedgerEvidenceReferences,
  validateCityLicenceEvidenceBundle,
} from '../src/lib/validateCityDataLedger.js';

const LEDGER_PATH = resolve(import.meta.dirname, '../data/city/city-data-ledger.json');
const MELBOURNE_EVIDENCE_PATH = resolve(
  import.meta.dirname,
  '../data/city/melbourne-p0-licence-evidence-2026-08-15.json',
);
const MELBOURNE_CONTROL_DEM_EVIDENCE_PATH = resolve(
  import.meta.dirname,
  '../data/city/melbourne-control-dem-licence-evidence-2026-08-16.json',
);
const MELBOURNE_EVIDENCE_RELATIVE_PATH = 'data/city/melbourne-p0-licence-evidence-2026-08-15.json';
const MELBOURNE_CONTROL_DEM_EVIDENCE_RELATIVE_PATH = 'data/city/melbourne-control-dem-licence-evidence-2026-08-16.json';

function ledgerFixture() {
  return JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
}

function evidenceFixture(path = MELBOURNE_EVIDENCE_PATH) {
  const bytes = readFileSync(path);
  return {
    data: JSON.parse(bytes.toString('utf8')),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function allEvidenceFixtures() {
  return {
    [MELBOURNE_EVIDENCE_RELATIVE_PATH]: evidenceFixture(),
    [MELBOURNE_CONTROL_DEM_EVIDENCE_RELATIVE_PATH]: evidenceFixture(MELBOURNE_CONTROL_DEM_EVIDENCE_PATH),
  };
}

describe('city data ledger', () => {
  it('validates the three-city fail-closed candidate registry', () => {
    const ledger = ledgerFixture();
    expect(validateCityDataLedger(ledger)).toEqual({ ok: true, errors: [] });
    expect(ledger.cities.map(({ id }) => id)).toEqual(['shanghai', 'melbourne', 'hong-kong']);
    expect(new Set(ledger.cities.flatMap(({ layers }) => layers.map(({ id }) => id))).size).toBe(
      ledger.cities.flatMap(({ layers }) => layers).length,
    );
  });

  it('allows only the signed Melbourne acquisitions and no production publication', () => {
    const acquisitionApproved = [];
    for (const city of ledgerFixture().cities) {
      for (const layer of city.layers) {
        if (canAcquireCityLayer(layer)) acquisitionApproved.push(layer.id);
        expect(canPublishCityLayer(city, layer), layer.id).toBe(false);
      }
    }
    expect(acquisitionApproved).toEqual([
      'melbourne-buildings-2023',
      'melbourne-vicmap-roads',
      'melbourne-pedestrian-network',
      'melbourne-vicmap-hydro',
      'melbourne-vicmap-survey-control',
      'melbourne-vicmap-dem10m',
      'melbourne-urban-forest-trees',
    ]);
  });

  it('validates normalized evidence independently from the signed acquisition decision', () => {
    const ledger = ledgerFixture();
    const evidence = evidenceFixture();
    const relativePath = MELBOURNE_EVIDENCE_RELATIVE_PATH;
    const melbourne = ledger.cities.find(({ id }) => id === 'melbourne');
    const evidencedLayers = melbourne.layers.filter(({ licence }) => licence.snapshotPath === relativePath);

    expect(validateCityLicenceEvidenceBundle(evidence.data)).toEqual({ ok: true, errors: [] });
    expect(evidencedLayers).toHaveLength(5);
    expect(new Set(evidence.data.records.map(({ layerId }) => layerId))).toEqual(
      new Set(evidencedLayers.map(({ id }) => id)),
    );
    expect(validateCityLedgerEvidenceReferences(ledger, allEvidenceFixtures()))
      .toEqual({ ok: true, errors: [] });
    for (const layer of evidencedLayers) {
      expect(layer.licence.snapshotSha256).toBe(evidence.sha256);
      expect(layer.approvals.legal.evidence).not.toBe(relativePath);
      expect(canAcquireCityLayer(layer), `${layer.id} has a separate signed decision`).toBe(true);
      expect(canPublishCityLayer(melbourne, layer), layer.id).toBe(false);
    }
  });

  it('pins the separately approved survey-control and DEM evidence bundle', () => {
    const ledger = ledgerFixture();
    const evidence = evidenceFixture(MELBOURNE_CONTROL_DEM_EVIDENCE_PATH);
    const melbourne = ledger.cities.find(({ id }) => id === 'melbourne');
    const evidencedLayers = melbourne.layers.filter(({ licence }) => (
      licence.snapshotPath === MELBOURNE_CONTROL_DEM_EVIDENCE_RELATIVE_PATH
    ));

    expect(validateCityLicenceEvidenceBundle(evidence.data)).toEqual({ ok: true, errors: [] });
    expect(evidencedLayers.map(({ id }) => id)).toEqual([
      'melbourne-vicmap-survey-control',
      'melbourne-vicmap-dem10m',
    ]);
    expect(evidencedLayers.every(({ licence }) => licence.snapshotSha256 === evidence.sha256)).toBe(true);
  });

  it('fails closed when evidence bytes or record ownership drift from the ledger', () => {
    const ledger = ledgerFixture();
    const evidence = evidenceFixture();
    const relativePath = MELBOURNE_EVIDENCE_RELATIVE_PATH;
    const wrongHash = validateCityLedgerEvidenceReferences(ledger, {
      ...allEvidenceFixtures(),
      [relativePath]: { ...evidence, sha256: '0'.repeat(64) },
    });
    expect(wrongHash.ok).toBe(false);
    expect(wrongHash.errors.some((error) => error.includes('does not match'))).toBe(true);

    const firstRecord = evidence.data.records[0];
    firstRecord.layerId = 'melbourne-vicmap-roads';
    const wrongOwner = validateCityLedgerEvidenceReferences(ledger, {
      ...allEvidenceFixtures(),
      [relativePath]: evidence,
    });
    expect(wrongOwner.ok).toBe(false);
    expect(wrongOwner.errors).toContain(
      'cities.melbourne.layers.melbourne-buildings-2023.licence.snapshotRecordId: record belongs to melbourne-vicmap-roads',
    );
  });

  it('rejects an evidence bundle that claims to be legal approval', () => {
    const evidence = evidenceFixture().data;
    evidence.legalApproval = true;
    const result = validateCityLicenceEvidenceBundle(evidence);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('legalApproval: evidence bundles must not grant legal approval');
  });

  it('requires every core layer kind to have a candidate or an explicit gap', () => {
    const ledger = ledgerFixture();
    ledger.cities[0].coverageGaps = ledger.cities[0].coverageGaps.filter(({ kind }) => kind !== 'terrain');
    const result = validateCityDataLedger(ledger);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('cities[0]: terrain needs a layer or documented gap');
  });

  it('rejects an acquisition approval without an immutable licence snapshot and evidence', () => {
    const ledger = ledgerFixture();
    ledger.cities[0].layers[0].decisions.acquisition = 'approved';
    const result = validateCityDataLedger(ledger);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'cities.shanghai.layers[0]: acquisition approval is missing licence snapshot or owner/legal evidence',
    );
  });

  it('keeps the Hong Kong statutory planning layer blocked by written-authorisation terms', () => {
    const ledger = ledgerFixture();
    const planning = ledger.cities[2].layers.find(({ id }) => id === 'hong-kong-tpb-statutory-planning');
    expect(planning.decisions).toEqual({ acquisition: 'blocked', production: 'blocked' });
    expect(planning.rights).toMatchObject({ cache: 'prohibited', derivatives: 'prohibited', redistribution: 'prohibited' });
    expect(canAcquireCityLayer(planning)).toBe(false);
  });

  it('only admits a layer after immutable evidence, spatial QA and all four approvals', () => {
    const ledger = ledgerFixture();
    const city = ledger.cities[1];
    const layer = city.layers[0];
    const approval = (role) => ({
      status: 'approved',
      by: `${role}-reviewer`,
      at: '2026-08-15',
      evidence: `reviews/${role}.md`,
    });
    city.precinct.status = 'frozen';
    city.precinct.tileInventoryStatus = 'frozen';
    city.precinct.controlPointStatus = 'verified';
    city.releaseBlockers.forEach((blocker) => { blocker.status = 'resolved'; });
    layer.spatial.verificationStatus = 'verified';
    layer.spatial.horizontalCrs = 'EPSG:7855';
    layer.spatial.verticalDatum = 'AHD';
    layer.licence.snapshotSha256 = 'a'.repeat(64);
    layer.sourceArtifactSha256 = 'b'.repeat(64);
    Object.keys(layer.rights).forEach((right) => { layer.rights[right] = 'allowed'; });
    layer.approvals.dataOwner = approval('data-owner');
    layer.approvals.legal = approval('legal');
    layer.approvals.engineering = approval('engineering');
    layer.approvals.productRelease = approval('product-release');
    layer.decisions.acquisition = 'approved';
    layer.decisions.production = 'approved';

    expect(canAcquireCityLayer(layer)).toBe(true);
    expect(canPublishCityLayer(city, layer)).toBe(true);
    expect(validateCityDataLedger(ledger)).toEqual({ ok: true, errors: [] });
  });
});
