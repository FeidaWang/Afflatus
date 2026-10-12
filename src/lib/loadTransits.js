import { fetchJson } from './fetchJson.js';

export const loadTransits = () => fetchJson('transits');
