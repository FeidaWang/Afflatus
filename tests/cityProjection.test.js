import { describe, expect, it } from 'vitest';
import {
  geographicToMga2020Zone55,
  geographicToMga94Zone55,
  gda94ToGda2020,
  packedDmsToDecimalDegrees,
  vicgrid94ToGda94,
  vicgrid94ToGda2020,
  wgs84ToCityScenePoint,
  wgs84ToLocalEnu,
} from '../src/city/projection.ts';

const anchor = Object.freeze({ longitude: 144.963, latitude: -37.815, ellipsoidHeight: 0 });

describe('real-city local ENU projection', () => {
  it('maps the anchor to a stable zero and preserves AHD on scene Y', () => {
    expect(wgs84ToLocalEnu(anchor, anchor)).toEqual({ east: 0, north: 0, up: 0 });
    expect(wgs84ToCityScenePoint(anchor, anchor, 42.5, 10)).toEqual({ x: 0, y: 32.5, z: 0 });
  });

  it('uses metre-scale east/north distances and maps north to negative scene Z', () => {
    const east = wgs84ToLocalEnu({ ...anchor, longitude: anchor.longitude + 0.001 }, anchor);
    const north = wgs84ToLocalEnu({ ...anchor, latitude: anchor.latitude + 0.001 }, anchor);
    expect(east.east).toBeGreaterThan(87);
    expect(east.east).toBeLessThan(90);
    expect(Math.abs(east.north)).toBeLessThan(0.01);
    expect(north.north).toBeGreaterThan(110);
    expect(north.north).toBeLessThan(112);
    expect(wgs84ToCityScenePoint(
      { ...anchor, latitude: anchor.latitude + 0.001 },
      anchor,
      0,
    ).z).toBeLessThan(-110);
  });

  it('fails closed for invalid coordinates and heights', () => {
    expect(() => wgs84ToLocalEnu({ longitude: 181, latitude: 0 }, anchor)).toThrow(/WGS84/);
    expect(() => wgs84ToCityScenePoint(anchor, anchor, Number.NaN)).toThrow(/AHD/);
    expect(() => geographicToMga94Zone55({ longitude: 151, latitude: -37 })).toThrow(/Zone 55/);
  });

  it('matches the official Urban Forest paired MGA94 Zone 55 fields', () => {
    const projected = geographicToMga94Zone55({
      longitude: 144.96173211,
      latitude: -37.81899926,
    });
    expect(projected.easting).toBeCloseTo(320_597.1, 2);
    expect(projected.northing).toBeCloseTo(5_812_309.94, 2);
  });

  it('matches an official Vicmap Position GDA2020/MGA2020 survey-control pair', () => {
    const projected = geographicToMga2020Zone55({
      longitude: packedDmsToDecimalDegrees(144.5759052),
      latitude: packedDmsToDecimalDegrees(-37.48555319),
    });
    expect(Math.hypot(
      projected.easting - 320_999.666,
      projected.northing - 5_812_715.463,
    )).toBeLessThan(0.02);
  });

  it('inverts Vicgrid94 and applies the explicit GDA94 to GDA2020 transform', () => {
    const projected = { easting: 2_497_000, northing: 2_409_500 };
    const gda94 = vicgrid94ToGda94(projected);
    expect(gda94.longitude).toBeCloseTo(144.96592750038053, 11);
    expect(gda94.latitude).toBeCloseTo(-37.815514839795, 11);

    const gda2020 = vicgrid94ToGda2020(projected);
    expect(gda2020.longitude).toBeCloseTo(144.96593343635737, 11);
    expect(gda2020.latitude).toBeCloseTo(-37.815501677409635, 11);
    expect(gda2020).toEqual(gda94ToGda2020(gda94));
  });

  it('rejects invalid Vicgrid94 and GDA94 inputs', () => {
    expect(() => vicgrid94ToGda94({ easting: Number.NaN, northing: 2_500_000 }))
      .toThrow(/Vicgrid94/);
    expect(() => gda94ToGda2020({ longitude: 181, latitude: 0 }))
      .toThrow(/WGS84/);
  });

  it('rejects invalid packed DMS minute and second fields', () => {
    expect(() => packedDmsToDecimalDegrees(144.6061)).toThrow(/minutes or seconds/);
  });
});
