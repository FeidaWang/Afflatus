#!/usr/bin/env python3
"""Build a native-grid Melbourne DEM fixture and survey-control QA evidence.

Requires Rasterio and NumPy. The source grid remains in EPSG:3111 and is
cropped without reprojection or resampling so the delivered float32 AHD values
remain authoritative.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import transform, transform_bounds
from rasterio.windows import Window, bounds as window_bounds, from_bounds, transform as window_transform


ROOT = Path(__file__).resolve().parents[2]
INVENTORY_PATH = ROOT / "data/city/inventory/melbourne-dem10m-vicgrid94-2021.json"
CONTROL_FIXTURE_PATH = ROOT / "tests/fixtures/city/melbourne-survey-control-golden-v1.json"
WORK_PATH = ROOT / "data/city/work/melbourne-dem10m-flinders-federation-v1.native.json"
NATIVE_CROP_PATH = ROOT / "data/city/work/melbourne-dem10m-flinders-federation-v1.native.tif"
FIXTURE_PATH = ROOT / "tests/fixtures/city/melbourne-dem10m-golden-v1.json"
QA_PATH = ROOT / "data/city/qa/melbourne-dem10m-flinders-federation-v1.json"
PIPELINE_VERSION = "melbourne-dem10m-native-v1"
ANCHOR_WGS84 = {"longitude": 144.963, "latitude": -37.815, "ellipsoidHeight": 0}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def checked_source(path: Path, expected_size: int, expected_sha: str, label: str) -> str:
    if path.stat().st_size != expected_size:
        raise RuntimeError(f"{label} byte length no longer matches inventory")
    actual = sha256_file(path)
    if actual != expected_sha:
        raise RuntimeError(f"{label} SHA-256 no longer matches inventory")
    return actual


def integer_covering_window(bounds: tuple[float, float, float, float], affine) -> Window:
    candidate = from_bounds(*bounds, transform=affine)
    column_start = math.floor(float(candidate.col_off))
    row_start = math.floor(float(candidate.row_off))
    column_end = math.ceil(float(candidate.col_off + candidate.width))
    row_end = math.ceil(float(candidate.row_off + candidate.height))
    return Window(column_start, row_start, column_end - column_start, row_end - row_start)


def finite_float(value: float, digits: int = 6) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise RuntimeError("non-finite numeric value encountered")
    return round(number, digits)


def summary(values: list[float]) -> dict:
    return {
        "minimum": finite_float(min(values)),
        "maximum": finite_float(max(values)),
        "mean": finite_float(sum(values) / len(values)),
        "rmse": finite_float(math.sqrt(sum(value * value for value in values) / len(values))),
    }


def compare_controls(source, control_fixture: dict, horizontal_accuracy: float, vertical_accuracy: float) -> dict:
    eligible = [
        entity for entity in control_fixture["entities"]
        if entity.get("estimatedGroundElevationAhd") is not None
    ]
    longitudes = [entity["sourceGda2020"][0] for entity in eligible]
    latitudes = [entity["sourceGda2020"][1] for entity in eligible]
    eastings, northings = transform("EPSG:7844", source.crs, longitudes, latitudes)
    records = []

    for entity, easting, northing in zip(eligible, eastings, northings):
        row, column = source.index(easting, northing)
        nearest_height = float(source.read(1, window=Window(column, row, 1, 1))[0, 0])
        ground_height = float(entity["estimatedGroundElevationAhd"])
        nearest_residual = nearest_height - ground_height
        candidates = []
        for candidate_row in range(row - 1, row + 2):
            for candidate_column in range(column - 1, column + 2):
                center_easting, center_northing = source.xy(candidate_row, candidate_column)
                distance = math.hypot(center_easting - easting, center_northing - northing)
                if distance > horizontal_accuracy:
                    continue
                value = float(source.read(
                    1,
                    window=Window(candidate_column, candidate_row, 1, 1),
                )[0, 0])
                if value == source.nodata or not math.isfinite(value):
                    continue
                candidates.append((abs(value - ground_height), value - ground_height, distance))
        if not candidates:
            raise RuntimeError(f"No native DEM cell found near control {entity['sourceNineFigureNumber']}")
        _, best_residual, best_distance = min(candidates)
        records.append({
            "sourceNineFigureNumber": entity["sourceNineFigureNumber"],
            "sourceGda2020": entity["sourceGda2020"],
            "surveyedGroundElevationAhd": finite_float(ground_height, 3),
            "nearestNativeCellElevationAhd": finite_float(nearest_height),
            "nearestNativeCellResidualMetres": finite_float(nearest_residual),
            "bestNativeCellResidualWithinHorizontalAccuracyMetres": finite_float(best_residual),
            "bestNativeCellCenterDistanceMetres": finite_float(best_distance, 3),
        })

    nearest = [record["nearestNativeCellResidualMetres"] for record in records]
    neighbourhood = [record["bestNativeCellResidualWithinHorizontalAccuracyMetres"] for record in records]
    return {
        "comparisonCount": len(records),
        "method": (
            "Transform published GDA2020 control coordinates to EPSG:3111, compare the nearest "
            "native DEM cell, then classify the best unchanged native cell whose centre lies "
            "within the published 12.5 m horizontal accuracy. No DEM resampling is used."
        ),
        "nearestNativeCell": {
            **summary(nearest),
            "maximumAbsolute": finite_float(max(abs(value) for value in nearest)),
            "withinPublishedVerticalAccuracy": sum(abs(value) <= vertical_accuracy for value in nearest),
            "withinTwicePublishedVerticalAccuracy": sum(abs(value) <= vertical_accuracy * 2 for value in nearest),
        },
        "withinPublishedHorizontalAccuracy": {
            **summary(neighbourhood),
            "maximumAbsolute": finite_float(max(abs(value) for value in neighbourhood)),
            "withinPublishedVerticalAccuracy": sum(abs(value) <= vertical_accuracy for value in neighbourhood),
        },
        "records": records,
    }


def main() -> None:
    inventory = read_json(INVENTORY_PATH)
    controls = read_json(CONTROL_FIXTURE_PATH)
    primary_archive = ROOT / inventory["rawPath"]
    verification_archive = ROOT / inventory["verificationArchive"]["rawPath"]
    primary_sha = checked_source(
        primary_archive,
        inventory["rawByteLength"],
        inventory["rawSha256"],
        "GeoTIFF delivery archive",
    )
    verification_sha = checked_source(
        verification_archive,
        inventory["verificationArchive"]["rawByteLength"],
        inventory["verificationArchive"]["rawSha256"],
        "ESRI Grid verification archive",
    )
    raster_member = next(member for member in inventory["archiveMembers"] if member["dataKind"] == "raster")
    geotiff_path = ROOT / inventory["extractedRasterPath"]
    checked_source(geotiff_path, raster_member["byteLength"], raster_member["sha256"], "extracted GeoTIFF")
    esri_grid_path = ROOT / inventory["verificationRasterPath"]

    with rasterio.open(geotiff_path) as geotiff, rasterio.open(esri_grid_path) as esri_grid:
        expected = inventory["sourceRaster"]
        metadata_matches = (
            geotiff.crs == esri_grid.crs
            and str(geotiff.crs) == "EPSG:3111"
            and geotiff.bounds == esri_grid.bounds
            and geotiff.transform == esri_grid.transform
            and geotiff.width == esri_grid.width == expected["width"]
            and geotiff.height == esri_grid.height == expected["height"]
            and geotiff.count == esri_grid.count == expected["bandCount"]
            and geotiff.dtypes == esri_grid.dtypes == (expected["dataType"],)
            and geotiff.nodata == esri_grid.nodata == expected["noDataValue"]
            and geotiff.res == esri_grid.res == (expected["cellSizeMetres"], expected["cellSizeMetres"])
        )
        if not metadata_matches:
            raise RuntimeError("Delivered GeoTIFF and native ESRI Grid metadata do not match inventory")

        clip = inventory["queryBoundsWgs84"]
        clip_tuple = (clip["west"], clip["south"], clip["east"], clip["north"])
        projected_bounds = transform_bounds("EPSG:4326", geotiff.crs, *clip_tuple, densify_pts=21)
        source_window = integer_covering_window(projected_bounds, geotiff.transform)
        geotiff_values = geotiff.read(1, window=source_window)
        esri_grid_values = esri_grid.read(1, window=source_window)
        native_cells_match = bool(np.array_equal(geotiff_values, esri_grid_values))
        if not native_cells_match:
            raise RuntimeError("GeoTIFF and ESRI Grid cell values differ inside the precinct window")

        valid_mask = geotiff_values != geotiff.nodata
        valid_values = geotiff_values[valid_mask]
        if valid_values.size == 0 or not np.isfinite(valid_values).all():
            raise RuntimeError("Precinct DEM contains no finite elevations")
        native_transform = window_transform(source_window, geotiff.transform)
        native_bounds = window_bounds(source_window, geotiff.transform)
        control_comparison = compare_controls(
            geotiff,
            controls,
            inventory["publishedAccuracyMetres"]["horizontal"],
            inventory["publishedAccuracyMetres"]["vertical"],
        )

        NATIVE_CROP_PATH.parent.mkdir(parents=True, exist_ok=True)
        profile = geotiff.profile.copy()
        profile.update({
            "driver": "GTiff",
            "height": int(source_window.height),
            "width": int(source_window.width),
            "transform": native_transform,
            "compress": "deflate",
            "predictor": 3,
            "tiled": True,
            "blockxsize": 128,
            "blockysize": 128,
        })
        with rasterio.open(NATIVE_CROP_PATH, "w", **profile) as crop:
            crop.write(geotiff_values, 1)
            crop.update_tags(
                source_artifact_id=inventory["artifactId"],
                vertical_datum="AHD",
                processing="native EPSG:3111 cell window; no reprojection or resampling",
            )

    with rasterio.open(NATIVE_CROP_PATH) as crop:
        crop_values = crop.read(1)
        if not np.array_equal(crop_values, geotiff_values):
            raise RuntimeError("Written native crop changed delivered float32 elevation values")

    values = [finite_float(value) for value in geotiff_values.flatten()]
    work = {
        "schemaVersion": 1,
        "fixtureId": "melbourne-dem10m-flinders-federation-v1-native",
        "pipelineVersion": PIPELINE_VERSION,
        "truthClass": "licensed-real-data-native-grid-engineering-fixture",
        "productionApproved": False,
        "derivedFrom": {
            "artifactId": inventory["artifactId"],
            "rawSha256": inventory["rawSha256"],
            "verificationArchiveSha256": inventory["verificationArchive"]["rawSha256"],
        },
        "attribution": inventory["licence"]["attribution"],
        "clipBoundsWgs84": clip,
        "localFrame": {
            "horizontalSourceCrs": inventory["sourceCrs"],
            "verticalSourceDatum": inventory["verticalDatum"],
            "anchorWgs84": ANCHOR_WGS84,
            "axes": "native grid remains EPSG:3111; future scene positions transform GDA94 to GDA2020 then x=east,z=-north; height=AHD-up",
            "transform": "No source-grid reprojection or resampling in this fixture",
        },
        "nativeGrid": {
            "crs": "EPSG:3111",
            "verticalDatum": "AHD",
            "window": {
                "sourceColumnOffset": int(source_window.col_off),
                "sourceRowOffset": int(source_window.row_off),
                "columns": int(source_window.width),
                "rows": int(source_window.height),
            },
            "bounds": [finite_float(value, 9) for value in native_bounds],
            "transform": [finite_float(value, 12) for value in native_transform],
            "cellSizeMetres": 10,
            "cellConvention": "pixel-is-area; values flattened row-major from the unchanged native grid",
            "noDataValue": inventory["sourceRaster"]["noDataValue"],
        },
        "elevationAhd": {
            "minimum": finite_float(float(valid_values.min())),
            "maximum": finite_float(float(valid_values.max())),
            "mean": finite_float(float(valid_values.mean())),
            "validCellCount": int(valid_values.size),
            "noDataCellCount": int(geotiff_values.size - valid_values.size),
            "values": values,
        },
        "surveyControlComparison": control_comparison,
    }
    work_bytes = (json.dumps(work, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n").encode()
    fixture = {**work, "fixtureId": "melbourne-dem10m-golden-v1"}
    fixture_bytes = (json.dumps(fixture, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode()
    WORK_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    QA_PATH.parent.mkdir(parents=True, exist_ok=True)
    WORK_PATH.write_bytes(work_bytes)
    FIXTURE_PATH.write_bytes(fixture_bytes)
    native_crop_sha = sha256_file(NATIVE_CROP_PATH)

    raw_cell_count = inventory["featureCount"]
    accepted = int(valid_values.size)
    vertical_accuracy = inventory["publishedAccuracyMetres"]["vertical"]
    qa = {
        "schemaVersion": 1,
        "reportId": "melbourne-dem10m-flinders-federation-v1-qa",
        "pipelineVersion": PIPELINE_VERSION,
        "geometryKind": "terrain-raster",
        "status": "passed-with-exclusions",
        "artifactId": inventory["artifactId"],
        "rawSha256": inventory["rawSha256"],
        "verificationArchiveSha256": verification_sha,
        "workSha256": sha256_bytes(work_bytes),
        "nativeCropPath": relative(NATIVE_CROP_PATH),
        "nativeCropSha256": native_crop_sha,
        "goldenFixtureSha256": sha256_bytes(fixture_bytes),
        "rawFeatureCount": raw_cell_count,
        "acceptedEntityCount": accepted,
        "excludedFeatureCount": raw_cell_count - accepted,
        "exclusions": {
            "outsidePrecinctNativeWindow": raw_cell_count - int(geotiff_values.size),
            "noDataInsideNativeWindow": int(geotiff_values.size - valid_values.size),
        },
        "duplicateEntityIds": 0,
        "sourceRaster": {
            "crs": "EPSG:3111",
            "verticalDatum": "AHD",
            "width": inventory["sourceRaster"]["width"],
            "height": inventory["sourceRaster"]["height"],
            "cellSizeMetres": inventory["sourceRaster"]["cellSizeMetres"],
            "dataType": inventory["sourceRaster"]["dataType"],
            "noDataValue": inventory["sourceRaster"]["noDataValue"],
        },
        "nativeWindow": work["nativeGrid"],
        "elevationAhd": {key: value for key, value in work["elevationAhd"].items() if key != "values"},
        "formatComparison": {
            "geoTiffDriver": "GTiff",
            "nativeEsriGridDriver": "AIG",
            "metadataExact": metadata_matches,
            "precinctCellValuesExact": native_cells_match,
            "comparedCellCount": int(geotiff_values.size),
            "maximumAbsoluteDifferenceMetres": 0,
        },
        "surveyControlResiduals": control_comparison,
        "controlPoints": {
            "trustedSetCount": controls["entities"].__len__(),
            "groundComparisonCount": control_comparison["comparisonCount"],
        },
        "checks": {
            "rawHashMatchesInventory": primary_sha == inventory["rawSha256"],
            "featureCountMatchesInventory": raw_cell_count == inventory["sourceRaster"]["width"] * inventory["sourceRaster"]["height"],
            "entityIdsUnique": True,
            "coordinatesFinite": all(math.isfinite(value) for value in native_bounds),
            "clippedToBounds": (
                native_bounds[0] <= projected_bounds[0]
                and native_bounds[1] <= projected_bounds[1]
                and native_bounds[2] >= projected_bounds[2]
                and native_bounds[3] >= projected_bounds[3]
            ),
            "sourceArchivesMatchInventory": True,
            "nativeRasterMetadataMatches": metadata_matches,
            "nativeRasterCellsMatch": native_cells_match,
            "sourceCrsResolved": True,
            "verticalDatumResolved": True,
            "nativeResolutionTenMetres": work["nativeGrid"]["cellSizeMetres"] == 10,
            "elevationsFinite": len(values) == accepted and all(math.isfinite(value) for value in values),
            "surveyControlResidualsClassified": (
                control_comparison["nearestNativeCell"]["withinTwicePublishedVerticalAccuracy"]
                == control_comparison["comparisonCount"]
            ),
            "neighbourhoodResidualsWithinPublishedVerticalAccuracy": (
                control_comparison["withinPublishedHorizontalAccuracy"]["withinPublishedVerticalAccuracy"]
                == control_comparison["comparisonCount"]
            ),
            "productionApproved": False,
        },
    }
    QA_PATH.write_text(json.dumps(qa, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": qa["status"],
        "nativeWindow": qa["nativeWindow"]["window"],
        "elevationAhd": qa["elevationAhd"],
        "formatComparison": qa["formatComparison"],
        "surveyControlResiduals": {
            "comparisonCount": control_comparison["comparisonCount"],
            "nearestNativeCell": control_comparison["nearestNativeCell"],
            "withinPublishedHorizontalAccuracy": control_comparison["withinPublishedHorizontalAccuracy"],
        },
        "workPath": relative(WORK_PATH),
        "nativeCropPath": relative(NATIVE_CROP_PATH),
        "fixturePath": relative(FIXTURE_PATH),
        "qaPath": relative(QA_PATH),
    }, indent=2))


if __name__ == "__main__":
    main()
