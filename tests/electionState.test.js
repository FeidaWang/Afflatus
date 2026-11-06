import { describe, expect, it } from 'vitest';
import { parseState, serializeState, withEvent, withGeography, withOffice, withRace } from '../src/lib/electionState.js';

describe('election view state', () => {
  it('has exactly the agreed fields', () => {
    expect(Object.keys(parseState('')).sort()).toEqual(['displayMode', 'event', 'geographyArea', 'geographyView', 'office', 'raceId', 'snapshotId']);
  });

  it('treats no event or an unknown event as the hub', () => {
    expect(parseState('').event).toBeNull();
    expect(parseState('?event=mars-2099').event).toBeNull();
    expect(serializeState(parseState('?event=mars-2099'))).toBe('');
  });

  it('defaults to the first office of the event', () => {
    expect(parseState('?event=vic-2026').office).toBe('assembly');
    expect(parseState('?event=us-2026').office).toBe('house');
  });

  it('rejects an office from another event', () => {
    expect(parseState('?event=vic-2026&office=senate').office).toBe('assembly');
  });

  it('rejects a race that does not belong to the current office', () => {
    expect(parseState('?event=us-2026&office=house&race=CA-12').raceId).toBe('CA-12');
    expect(parseState('?event=us-2026&office=house&race=CA-53').raceId).toBeNull();
    expect(parseState('?event=us-2026&office=senate&race=CA-12').raceId).toBeNull();
    expect(parseState('?event=vic-2026&race=%3Cscript%3E').raceId).toBeNull();
  });

  it('invalidates the race when the office changes', () => {
    const state = parseState('?event=us-2026&office=house&race=CA-12');
    const next = withOffice(state, 'senate');
    expect(next.office).toBe('senate');
    expect(next.raceId).toBeNull();
  });

  it('invalidates office and race when the event changes', () => {
    const next = withEvent('vic-2026');
    expect(next).toMatchObject({ event: 'vic-2026', office: 'assembly', raceId: null });
  });

  it('never lets a URL claim a live mode or a snapshot', () => {
    const state = parseState('?event=vic-2026&displayMode=live&mode=live&snapshotId=abc&snapshot=abc');
    expect(state.displayMode).toBe('preview');
    expect(state.snapshotId).toBeNull();
  });

  it('round-trips through the URL', () => {
    const state = withRace(withEvent('au-2028', 'senate'), 'seat-07');
    expect(serializeState(state)).toBe('?event=au-2028&office=senate&race=seat-07');
    expect(parseState(serializeState(state))).toEqual(state);
    const zoomed = parseState('?event=us-2026&office=house&race=NY-12&area=NY');
    expect(serializeState(zoomed)).toBe('?event=us-2026&office=house&race=NY-12&area=NY');
    expect(parseState(serializeState(zoomed))).toEqual(zoomed);
  });

  it('shows a map only where verified boundaries exist', () => {
    expect(parseState('?event=us-2026').geographyView).toBe('map');
    expect(parseState('?event=vic-2026&office=council').geographyView).toBe('map');
    expect(parseState('?event=nsw-2027').geographyView).toBe('map');
    expect(parseState('?event=nsw-2027&office=council').geographyView).toBe('schematic');
    expect(parseState('?event=au-2028').geographyView).toBe('schematic');
    expect(parseState('?event=us-2028').geographyView).toBe('schematic');
    expect(parseState('').geographyView).toBe('schematic');
  });

  it('honours the blocks view, and only offers it where a map is the default', () => {
    const blocks = parseState('?event=us-2026&geo=blocks');
    expect(blocks.geographyView).toBe('schematic');
    expect(serializeState(blocks)).toBe('?event=us-2026&office=house&geo=blocks');
    expect(serializeState(parseState('?event=au-2028&geo=blocks'))).toBe('?event=au-2028&office=house');
    expect(parseState('?event=us-2026&geo=nonsense').geographyView).toBe('map');
  });

  it('rejects an area from another office or a view with no map', () => {
    expect(parseState('?event=us-2026&area=NY').geographyArea).toBe('NY');
    expect(parseState('?event=us-2026&area=atlantis').geographyArea).toBeNull();
    expect(parseState('?event=vic-2026&area=NY').geographyArea).toBeNull();
    expect(parseState('?event=us-2026&geo=blocks&area=NY').geographyArea).toBeNull();
    expect(parseState('?event=au-2028&area=NY').geographyArea).toBeNull();
  });

  it('keeps the view and zoom when the race changes, and drops all three with the office', () => {
    const state = parseState('?event=us-2026&area=NY');
    const selected = withRace(state, 'NY-12');
    expect(selected).toMatchObject({ raceId: 'NY-12', geographyArea: 'NY', geographyView: 'map' });
    expect(withRace(selected, null).geographyArea).toBe('NY');
    expect(withOffice(selected, 'senate')).toMatchObject({ raceId: null, geographyArea: null, geographyView: 'map' });
  });

  it('keeps the race when only the geography changes', () => {
    const state = parseState('?event=us-2026&race=NY-12');
    expect(withGeography(state, { area: 'NY' })).toMatchObject({ raceId: 'NY-12', geographyArea: 'NY' });
    expect(withGeography(state, { view: 'schematic' })).toMatchObject({ raceId: 'NY-12', geographyView: 'schematic' });
  });
});
