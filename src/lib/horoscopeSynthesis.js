import {
  cstToJD,
  moonLongitude,
  sunLongitude,
} from './astro.js';
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
  const jdMe = cstToJD(me.y, me.m, me.d, me.hour);
  const jdThem = cstToJD(other.y, other.m, other.d, other.hour);
  const meLons = { Sun: sunLongitude(jdMe), Moon: moonLongitude(jdMe) };
  const themLons = { Sun: sunLongitude(jdThem), Moon: moonLongitude(jdThem) };
  for (const body of ['Mercury', 'Venus', 'Mars']) {
    meLons[body] = planetReading(body, jdMe).lonDeg;
    themLons[body] = planetReading(body, jdThem).lonDeg;
  }
  const aspects = crossAspects(themLons, meLons);
  const jdMid = (jdMe + jdThem) / 2;
  return {
    title: relationshipTitle(aspects),
    score: resonanceScore(baziBase, aspects),
    attraction: attractionLines(aspects),
    flags: redFlagLines(aspects),
    davison: davisonReading(sunLongitude(jdMid), moonLongitude(jdMid)),
    aspects,
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
