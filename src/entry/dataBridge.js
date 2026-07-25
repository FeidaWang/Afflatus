import { fetchJson, JsonDataError } from '../lib/fetchJson.js';

const api = Object.freeze({ fetchJson, JsonDataError });
globalThis.AfflatusData = api;
globalThis.dispatchEvent(new CustomEvent('afflatus-data-ready', { detail: api }));
