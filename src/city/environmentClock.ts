import {
  Body,
  Equator,
  Horizon,
  Observer,
} from 'astronomy-engine';

export const CITY_ENVIRONMENT_IDS = Object.freeze([
  'analysis',
  'day',
  'sunset',
  'night',
] as const);

export const CITY_ENVIRONMENT_REQUESTS = Object.freeze([
  ...CITY_ENVIRONMENT_IDS,
  'auto-local',
] as const);

export type CityEnvironmentId = typeof CITY_ENVIRONMENT_IDS[number];
export type CityEnvironmentRequest = typeof CITY_ENVIRONMENT_REQUESTS[number];
export type SolarEnvironmentBand = Exclude<CityEnvironmentId, 'analysis'>;

export interface CityEnvironmentLocation {
  readonly id: string;
  readonly labels: Readonly<{ en: string; zh: string }>;
  readonly timeZone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly elevationMetres: number;
}

export interface CityEnvironmentSnapshot {
  readonly requestedEnvironment: CityEnvironmentRequest;
  readonly environment: CityEnvironmentId;
  readonly solarBand: SolarEnvironmentBand;
  readonly instant: string;
  readonly timeSource: 'fixed-preset' | 'local-clock';
  readonly location: CityEnvironmentLocation;
  readonly localDate: string;
  readonly localTime: string;
  readonly localDateTime: string;
  readonly sun: Readonly<{
    altitudeDegrees: number;
    azimuthDegrees: number;
    direction: Readonly<{ x: number; y: number; z: number }>;
  }>;
  readonly simulatedLighting: boolean;
}

export const MELBOURNE_ENVIRONMENT_LOCATION: CityEnvironmentLocation = Object.freeze({
  id: 'melbourne-cbd',
  labels: Object.freeze({ en: 'Melbourne CBD', zh: '墨尔本中央商务区' }),
  timeZone: 'Australia/Melbourne',
  latitude: -37.817,
  longitude: 144.967,
  elevationMetres: 15,
});

export const MELBOURNE_ENVIRONMENT_PRESET_INSTANTS = Object.freeze({
  analysis: '2026-08-16T02:00:00.000Z',
  day: '2026-01-15T02:00:00.000Z',
  sunset: '2026-01-15T09:30:00.000Z',
  night: '2026-01-15T13:00:00.000Z',
} satisfies Readonly<Record<CityEnvironmentId, string>>);

const DAY_ALTITUDE_DEGREES = 8;
const NIGHT_ALTITUDE_DEGREES = -6;

function finiteCoordinate(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`Environment location ${label} must be finite.`);
  return value;
}

function validateLocation(location: CityEnvironmentLocation): CityEnvironmentLocation {
  const latitude = finiteCoordinate(location.latitude, 'latitude');
  const longitude = finiteCoordinate(location.longitude, 'longitude');
  finiteCoordinate(location.elevationMetres, 'elevation');
  if (latitude < -90 || latitude > 90) throw new Error('Environment latitude is out of range.');
  if (longitude < -180 || longitude > 180) throw new Error('Environment longitude is out of range.');
  if (!location.timeZone) throw new Error('Environment location requires an IANA time zone.');
  return location;
}

function dateFrom(value: Date | string | number): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Environment instant is invalid.');
  return date;
}

function localDateTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value ?? ''
  );
  const localDate = `${value('year')}-${value('month')}-${value('day')}`;
  const localTime = `${value('hour')}:${value('minute')}:${value('second')}`;
  return Object.freeze({ localDate, localTime, localDateTime: `${localDate}T${localTime}` });
}

export function normalizeCityEnvironmentRequest(value: unknown): CityEnvironmentRequest | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return CITY_ENVIRONMENT_REQUESTS.find((request) => request === normalized) ?? null;
}

export function classifySolarEnvironment(altitudeDegrees: number): SolarEnvironmentBand {
  if (!Number.isFinite(altitudeDegrees)) throw new Error('Solar altitude must be finite.');
  if (altitudeDegrees >= DAY_ALTITUDE_DEGREES) return 'day';
  if (altitudeDegrees > NIGHT_ALTITUDE_DEGREES) return 'sunset';
  return 'night';
}

function solarPosition(date: Date, location: CityEnvironmentLocation) {
  const observer = new Observer(
    location.latitude,
    location.longitude,
    location.elevationMetres,
  );
  const equatorial = Equator(Body.Sun, date, observer, true, true);
  const horizontal = Horizon(
    date,
    observer,
    equatorial.ra,
    equatorial.dec,
    'normal',
  );
  const altitudeRadians = horizontal.altitude * Math.PI / 180;
  const azimuthRadians = horizontal.azimuth * Math.PI / 180;
  const horizontalScale = Math.cos(altitudeRadians);
  return Object.freeze({
    altitudeDegrees: horizontal.altitude,
    azimuthDegrees: horizontal.azimuth,
    // Local candidate coordinates are East / Up / North (x / y / z).
    direction: Object.freeze({
      x: Math.sin(azimuthRadians) * horizontalScale,
      y: Math.sin(altitudeRadians),
      z: Math.cos(azimuthRadians) * horizontalScale,
    }),
  });
}

export class EnvironmentClock {
  readonly location: CityEnvironmentLocation;
  readonly presetInstants: Readonly<Record<CityEnvironmentId, string>>;

  constructor({
    location,
    presetInstants,
  }: {
    location: CityEnvironmentLocation;
    presetInstants: Readonly<Record<CityEnvironmentId, string>>;
  }) {
    const validatedLocation = validateLocation(location);
    this.location = Object.freeze({
      ...validatedLocation,
      labels: Object.freeze({ ...validatedLocation.labels }),
    });
    this.presetInstants = Object.freeze({ ...presetInstants });
    for (const environment of CITY_ENVIRONMENT_IDS) dateFrom(this.presetInstants[environment]);
  }

  resolve(
    requestValue: unknown,
    localInstant?: Date | string | number,
  ): CityEnvironmentSnapshot {
    const requestedEnvironment = normalizeCityEnvironmentRequest(requestValue);
    if (!requestedEnvironment) throw new Error(`Unknown city environment: ${String(requestValue)}`);
    const timeSource = requestedEnvironment === 'auto-local' ? 'local-clock' : 'fixed-preset';
    if (timeSource === 'local-clock' && localInstant === undefined) {
      throw new Error('Auto-local environment requires an explicit clock instant.');
    }
    const date = dateFrom(
      timeSource === 'local-clock'
        ? localInstant as Date | string | number
        : this.presetInstants[requestedEnvironment as CityEnvironmentId],
    );
    const sun = solarPosition(date, this.location);
    const solarBand = classifySolarEnvironment(sun.altitudeDegrees);
    const environment = requestedEnvironment === 'auto-local'
      ? solarBand
      : requestedEnvironment;
    const local = localDateTime(date, this.location.timeZone);
    return Object.freeze({
      requestedEnvironment,
      environment,
      solarBand,
      instant: date.toISOString(),
      timeSource,
      location: this.location,
      ...local,
      sun,
      simulatedLighting: environment === 'night',
    });
  }
}

export const MELBOURNE_ENVIRONMENT_CLOCK = Object.freeze(new EnvironmentClock({
  location: MELBOURNE_ENVIRONMENT_LOCATION,
  presetInstants: MELBOURNE_ENVIRONMENT_PRESET_INSTANTS,
}));
