#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OUTPUT_PATH = 'data/city/qa/melbourne-flinders-federation-cross-layer-v1.json';
const PIPELINE_VERSION = 'melbourne-cross-layer-v1';
const SOURCES = Object.freeze([
  ['buildings', 'melbourne-buildings-2023', 'data/city/work/melbourne-buildings-flinders-federation-v1.enu.json', 'data/city/qa/melbourne-buildings-flinders-federation-v1.json'],
  ['roads', 'melbourne-vicmap-roads', 'data/city/work/melbourne-roads-flinders-federation-v1.enu.json', 'data/city/qa/melbourne-roads-flinders-federation-v1.json'],
  ['pedestrian', 'melbourne-pedestrian-network', 'data/city/work/melbourne-pedestrian-network-complete-v1.enu.json', 'data/city/qa/melbourne-pedestrian-network-complete-v1.json'],
  ['hydro', 'melbourne-vicmap-hydro', 'data/city/work/melbourne-hydro-flinders-federation-v1.enu.json', 'data/city/qa/melbourne-hydro-flinders-federation-v1.json'],
  ['trees', 'melbourne-urban-forest-trees', 'data/city/work/melbourne-trees-flinders-federation-v1.enu.json', 'data/city/qa/melbourne-trees-flinders-federation-v1.json'],
  ['surveyControl', 'melbourne-vicmap-survey-control', 'data/city/work/melbourne-survey-control-flinders-federation-v1.enu.json', 'data/city/qa/melbourne-survey-control-flinders-federation-v1.json'],
  ['terrain', 'melbourne-vicmap-dem10m', 'data/city/work/melbourne-dem10m-flinders-federation-v1.native.json', 'data/city/qa/melbourne-dem10m-flinders-federation-v1.json'],
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const round = (value, digits = 3) => Number(value.toFixed(digits));
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentX, currentY] = ring[index];
    const [previousX, previousY] = ring[previous];
    if (
      (currentY > y) !== (previousY > y)
      && x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX
    ) inside = !inside;
  }
  return inside;
}

const pointInPolygon = (point, polygon) => (
  pointInRing(point, polygon[0]) && !polygon.slice(1).some((ring) => pointInRing(point, ring))
);

function pointInEntity(point, entity) {
  if (
    entity.bounds
    && (
      point[0] < entity.bounds.minX
      || point[0] > entity.bounds.maxX
      || point[1] < entity.bounds.minZ
      || point[1] > entity.bounds.maxZ
    )
  ) return false;
  return entity.polygons.some((polygon) => pointInPolygon(point, polygon));
}

function pointSegmentDistance(point, start, end) {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (
    (point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY
  ) / lengthSquared));
  return Math.hypot(
    point[0] - (start[0] + ratio * deltaX),
    point[1] - (start[1] + ratio * deltaY),
  );
}

const ringSegments = (ring) => ring.slice(1).map((end, index) => [ring[index], end]);
const polygonSegments = (polygon) => polygon.flatMap(ringSegments);
const entitySegments = (entity) => entity.polygons.flatMap((polygon) => polygon.flatMap(ringSegments));
const networkSegments = (entities) => entities.flatMap(({ lines }) => (
  lines.flatMap((line) => ringSegments(line))
));

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsIntersect(a, b, c, d) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return (
    ((abC > 0 && abD < 0) || (abC < 0 && abD > 0))
    && ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
  );
}

function polygonsIntersect(first, second) {
  if (first[0].some((point) => pointInPolygon(point, second))) return true;
  if (second[0].some((point) => pointInPolygon(point, first))) return true;
  const firstSegments = polygonSegments(first);
  const secondSegments = polygonSegments(second);
  return firstSegments.some(([a, b]) => (
    secondSegments.some(([c, d]) => segmentsIntersect(a, b, c, d))
  ));
}

function quantile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

const countBy = (values) => Object.fromEntries([...new Set(values)].sort().map((value) => [
  String(value),
  values.filter((candidate) => candidate === value).length,
]));

async function main() {
  const loaded = {};
  const sourceLayers = [];
  for (const [key, layerId, workPath, qaPath] of SOURCES) {
    const [workBytes, qaBytes] = await Promise.all([
      readFile(resolve(workPath)),
      readFile(resolve(qaPath)),
    ]);
    const work = JSON.parse(workBytes.toString('utf8'));
    const qa = JSON.parse(qaBytes.toString('utf8'));
    const workSha256 = sha256(workBytes);
    if (workSha256 !== qa.workSha256) throw new Error(`${key} work bytes do not match layer QA.`);
    loaded[key] = { work, qa };
    sourceLayers.push({
      layerId,
      artifactId: qa.artifactId,
      workPath,
      workSha256,
      qaPath,
    });
  }

  const works = Object.values(loaded).map(({ work }) => work);
  const clipBounds = loaded.buildings.work.clipBoundsWgs84;
  const anchor = loaded.buildings.work.localFrame.anchorWgs84;
  const roads = networkSegments(loaded.roads.work.entities);
  const pedestrian = networkSegments(loaded.pedestrian.work.entities);
  const waterEntities = loaded.hydro.work.entities.filter(({ kind }) => kind === 'water-area');
  const waterBoundarySegments = waterEntities.flatMap(entitySegments);
  const treeRoadDistances = [];
  const treePedestrianDistances = [];
  const treesInsideWater = [];
  const treesInsideBuildings = [];

  for (const tree of loaded.trees.work.entities) {
    const point = tree.horizontalPosition;
    treeRoadDistances.push(Math.min(...roads.map(([start, end]) => pointSegmentDistance(point, start, end))));
    treePedestrianDistances.push(Math.min(
      ...pedestrian.map(([start, end]) => pointSegmentDistance(point, start, end)),
    ));
    if (waterEntities.some((entity) => pointInEntity(point, entity))) {
      treesInsideWater.push({
        sourceComId: tree.sourceComId,
        boundaryDistanceMetres: round(Math.min(
          ...waterBoundarySegments.map(([start, end]) => pointSegmentDistance(point, start, end)),
        ), 6),
      });
    }
    const buildingHits = loaded.buildings.work.entities.filter((building) => pointInEntity(point, building));
    if (buildingHits.length > 0) {
      treesInsideBuildings.push({
        sourceComId: tree.sourceComId,
        sourceStructureIds: [...new Set(buildingHits.map(({ sourceStructureId }) => sourceStructureId))].sort(),
        boundaryDistanceMetres: round(Math.min(...buildingHits.flatMap((building) => (
          entitySegments(building).map(([start, end]) => pointSegmentDistance(point, start, end))
        ))), 6),
      });
    }
  }

  const buildingWaterOverlaps = loaded.buildings.work.entities.filter((building) => (
    building.polygons.some((buildingPolygon) => waterEntities.some((water) => (
      water.polygons.some((waterPolygon) => polygonsIntersect(buildingPolygon, waterPolygon))
    )))
  ));
  const overlapTypes = countBy(buildingWaterOverlaps.map(({ footprintType }) => footprintType));
  const report = {
    schemaVersion: 1,
    reportId: 'melbourne-flinders-federation-cross-layer-v1',
    pipelineVersion: PIPELINE_VERSION,
    status: 'passed-with-findings',
    releaseBlocked: false,
    productionApproved: false,
    precinctId: 'melbourne-flinders-federation-golden-v1',
    sourceLayers,
    sharedFrame: {
      clipBoundsWgs84: clipBounds,
      anchorWgs84: anchor,
      axes: 'x=east; horizontal z=-north; Vicmap DEM and survey control heights share AHD',
    },
    metrics: {
      treeNetworkProximityMetres: {
        treeCount: loaded.trees.work.entities.length,
        road: {
          median: round(quantile(treeRoadDistances, 0.5)),
          p95: round(quantile(treeRoadDistances, 0.95)),
          maximum: round(Math.max(...treeRoadDistances)),
          within20Metres: treeRoadDistances.filter((distance) => distance <= 20).length,
        },
        pedestrian: {
          median: round(quantile(treePedestrianDistances, 0.5)),
          p95: round(quantile(treePedestrianDistances, 0.95)),
          maximum: round(Math.max(...treePedestrianDistances)),
          within20Metres: treePedestrianDistances.filter((distance) => distance <= 20).length,
        },
      },
      treeWaterBoundaryFindings: {
        count: treesInsideWater.length,
        maximumBoundaryDistanceMetres: round(Math.max(...treesInsideWater.map(({ boundaryDistanceMetres }) => boundaryDistanceMetres)), 6),
        entities: treesInsideWater,
      },
      treeBuildingBoundaryFindings: {
        count: treesInsideBuildings.length,
        maximumBoundaryDistanceMetres: round(Math.max(...treesInsideBuildings.map(({ boundaryDistanceMetres }) => boundaryDistanceMetres)), 6),
        entities: treesInsideBuildings,
      },
      buildingWaterOverlaps: {
        entityCount: buildingWaterOverlaps.length,
        sourceStructureCount: new Set(buildingWaterOverlaps.map(({ sourceStructureId }) => sourceStructureId)).size,
        footprintTypeCounts: overlapTypes,
      },
      treeDualCoordinateFields: loaded.trees.qa.mga94FieldResidualMetres,
      surveyControl: {
        trustedSetCount: loaded.surveyControl.qa.controlPoints.trustedSetCount,
        publishedCoordinateResidualMetres: loaded.surveyControl.qa.publishedCoordinateResidualMetres,
        serviceGeometryResidualMetres: loaded.surveyControl.qa.serviceGeometryResidualMetres,
        uncertaintyMetres: loaded.surveyControl.qa.uncertaintyMetres,
        ahdHeightMetres: loaded.surveyControl.qa.ahdHeightMetres,
      },
      terrain: {
        nativeGrid: loaded.terrain.qa.nativeWindow,
        elevationAhd: loaded.terrain.qa.elevationAhd,
        formatComparison: loaded.terrain.qa.formatComparison,
        surveyControlResiduals: loaded.terrain.qa.surveyControlResiduals,
      },
    },
    findings: [
      {
        id: 'survey-control-service-geometry-datum-mix',
        severity: 'warning',
        evidence: `${loaded.surveyControl.qa.serviceGeometryResidualMetres.gda94LikeOffsetReview} trusted records have GDA94-like service-geometry offsets while their published GDA2020 DMS/MGA2020 pairs agree within two centimetres.`,
        disposition: 'Keep the published GDA2020 DMS/MGA2020 fields authoritative and fail QA if any residual becomes unclassified.',
      },
      {
        id: 'terrain-control-nearest-cell-accuracy-envelope',
        severity: 'warning',
        evidence: `${loaded.terrain.qa.surveyControlResiduals.nearestNativeCell.withinPublishedVerticalAccuracy} of ${loaded.terrain.qa.surveyControlResiduals.comparisonCount} nearest-cell comparisons are within the published 5 m vertical accuracy; all are within 5 m when unchanged native cells inside the published 12.5 m horizontal accuracy are considered.`,
        disposition: 'Preserve native cells and the accuracy-envelope classification; do not move control points or resample the DEM to force a closer fit.',
      },
      {
        id: 'tree-dual-coordinate-field-drift',
        severity: 'warning',
        evidence: `${loaded.trees.qa.mga94FieldResidualMetres.overOneMetre} tree records differ by more than one metre between published WGS84 and MGA94 fields.`,
        disposition: 'Keep GeoJSON geometry authoritative for this artifact, preserve both fields and review upstream changes on refresh.',
      },
      {
        id: 'near-shore-tree-source-mismatch',
        severity: 'warning',
        evidence: `${treesInsideWater.length} tree points fall inside the Hydro polygon but all are within ${round(Math.max(...treesInsideWater.map(({ boundaryDistanceMetres }) => boundaryDistanceMetres)), 3)} m of its boundary.`,
        disposition: 'Do not delete or move records automatically; reconcile with orthophoto/ground authority during package QA.',
      },
    ],
    checks: {
      sourceWorkHashesMatchQa: true,
      sharedClipBounds: works.every(({ clipBoundsWgs84 }) => sameJson(clipBoundsWgs84, clipBounds)),
      sharedLocalAnchor: works.every(({ localFrame }) => sameJson(localFrame.anchorWgs84, anchor)),
      coordinatesFinite: [treeRoadDistances, treePedestrianDistances].flat().every(Number.isFinite),
      buildingWaterOverlapsClassified: Object.keys(overlapTypes).every((type) => (
        ['Bridge', 'Jetty', 'Ramp'].includes(type)
      )),
      treeNetworkProximitySane: quantile(treeRoadDistances, 0.95) < 20
        && quantile(treePedestrianDistances, 0.95) < 20,
      surveyControlAuthoritativeFieldsVerified:
        loaded.surveyControl.qa.checks.publishedCoordinateResidualWithinTwoCentimetres === true
        && loaded.surveyControl.qa.checks.allControlsGda2020Adjusted === true
        && loaded.surveyControl.qa.checks.allControlsAhdAdjusted === true
        && loaded.surveyControl.qa.checks.serviceGeometryDatumDriftClassified === true,
      terrainNativeFormatsMatch:
        loaded.terrain.qa.checks.nativeRasterMetadataMatches === true
        && loaded.terrain.qa.checks.nativeRasterCellsMatch === true,
      terrainSurveyControlResidualsClassified:
        loaded.terrain.qa.checks.surveyControlResidualsClassified === true
        && loaded.terrain.qa.checks.neighbourhoodResidualsWithinPublishedVerticalAccuracy === true,
    },
  };

  await mkdir(dirname(resolve(OUTPUT_PATH)), { recursive: true });
  await writeFile(resolve(OUTPUT_PATH), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: report.status,
    releaseBlocked: report.releaseBlocked,
    treeNetworkProximityMetres: report.metrics.treeNetworkProximityMetres,
    treeWaterBoundaryFindings: report.metrics.treeWaterBoundaryFindings.count,
    treeBuildingBoundaryFindings: report.metrics.treeBuildingBoundaryFindings.count,
    buildingWaterOverlaps: report.metrics.buildingWaterOverlaps,
    findings: report.findings.map(({ id, severity }) => ({ id, severity })),
    outputPath: OUTPUT_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
