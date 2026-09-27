import { validateGlobeData } from './validateGlobeData.js';
let pending;
// Shared by hero and all analytic instances; failed requests remain retryable.
export function loadGlobeAsset() {
  return pending ??= fetch('/assets/globe/earth-land.json').then(response => {
    if (!response.ok) throw Error('Earth unavailable');
    return response.json();
  }).then(data => {
    if (!validateGlobeData(data).ok) throw Error('Invalid Earth geometry');
    return data;
  }).catch(error => { pending = undefined; throw error; });
}
