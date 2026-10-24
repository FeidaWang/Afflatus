import {
  aspectBetween,
  cstToJD,
  moonLongitude,
  sunLongitude,
} from './astro.js';
import { julianDayUTC, clockHour } from './bazi.js';
import {
  attractionLines,
  crossAspects,
  davisonReading,
  redFlagLines,
  relationshipTitle,
  resonanceScore,
} from './synastryAstro.js';
import {
  allPlanets,
  planetReading,
} from './astroPlanets.ts';

export function computeSynastryAstro({ me, other, baziBase }) {
  const jdMe = cstToJD(me.y, me.m, me.d, clockHour(me));
  const jdThem = cstToJD(other.y, other.m, other.d, clockHour(other));
  const meLons = { Sun: sunLongitude(jdMe), Moon: moonLongitude(jdMe) };
  const themLons = { Sun: sunLongitude(jdThem), Moon: moonLongitude(jdThem) };
  for (const body of ['Mercury', 'Venus', 'Mars']) {
    meLons[body] = planetReading(body, jdMe).lonDeg;
    themLons[body] = planetReading(body, jdThem).lonDeg;
  }
  // Unknown hour: the Moon moves ~13° that day, so a Moon aspect only counts
  // when the same aspect holds at the day's first and last minute (CST).
  const moonHolds = (b, otherLon, key) => [0, 23 + 59 / 60].every((h) =>
    aspectBetween(moonLongitude(julianDayUTC(b.y, b.m, b.d, h - 8)), otherLon)?.key === key);
  const aspects = crossAspects(themLons, meLons).filter((a) =>
    (a.bodyMe !== 'Moon' || me.hour != null || moonHolds(me, themLons[a.bodyThem], a.key))
    && (a.bodyThem !== 'Moon' || other.hour != null || moonHolds(other, meLons[a.bodyMe], a.key)));
  const jdMid = (jdMe + jdThem) / 2;
  return {
    title: relationshipTitle(aspects),
    score: resonanceScore(baziBase, aspects),
    attraction: attractionLines(aspects),
    flags: redFlagLines(aspects),
    davison: davisonReading(sunLongitude(jdMid), moonLongitude(jdMid)),
    aspects,
    moonEstimated: { me: me.hour == null, other: other.hour == null },
  };
}

export function computeProfessionalEphemeris({ jd }) {
  return allPlanets(jd);
}

export function runHoroscopeSynthesis(kind, payload) {
  if (kind === 'synastry-astro') return computeSynastryAstro(payload);
  if (kind === 'professional-ephemeris') return computeProfessionalEphemeris(payload);
  throw new Error(`Unsupported horoscope synthesis: ${kind}`);
}
