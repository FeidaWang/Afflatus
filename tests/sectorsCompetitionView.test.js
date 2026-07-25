import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initSectorsCompetition } from '../src/lib/sectorsCompetitionView.js';

const DATA = JSON.parse(readFileSync('public/sectors-competition.json', 'utf8'));

/* A minimal DOM stub rather than a jsdom dependency — same approach as
   tests/renderBudgetCoordinator.test.js. It implements only the surface this view
   actually touches, which is the point: if the view reaches for an API that was
   never wired up, the test throws instead of silently passing. */
function createNode(tag, namespace) {
  const node = {
    tagName: String(tag).toUpperCase(),
    namespace: namespace || null,
    children: [],
    parent: null,
    attributes: {},
    dataset: {},
    listeners: {},
    _class: '',
    _text: '',
    style: {
      properties: {},
      setProperty(name, value) { this.properties[name] = value; },
    },
    set className(value) { this._class = value; },
    get className() { return this._class; },
    set textContent(value) { this._text = String(value); this.children = []; },
    get textContent() {
      return this.children.length
        ? this.children.map((child) => child.textContent).join('')
        : this._text;
    },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
    appendChild(child) { child.parent = node; node.children.push(child); return child; },
    append(...items) { for (const item of items) node.appendChild(item); },
    replaceChildren(...items) { node.children = []; node._text = ''; node.append(...items); },
    addEventListener(type, listener) { (node.listeners[type] ||= []).push(listener); },
    click() { for (const listener of node.listeners.click || []) listener({}); },
    focus() { node._focused = true; },
    get firstChild() { return node.children[0] || null; },
    get lastChild() { return node.children[node.children.length - 1] || null; },
    querySelector(selector) { return node.queryAll(selector)[0] || null; },
    querySelectorAll(selector) { return node.queryAll(selector); },
    queryAll(selector) {
      const out = [];
      const walk = (current) => {
        for (const child of current.children) {
          if (matches(child, selector)) out.push(child);
          walk(child);
        }
      };
      walk(node);
      return out;
    },
    all(predicate) {
      const out = [];
      const walk = (current) => {
        for (const child of current.children) {
          if (predicate(child)) out.push(child);
          walk(child);
        }
      };
      walk(node);
      return out;
    },
  };
  return node;
}

// Only the handful of selector forms the view uses.
function matches(node, selector) {
  const dataAttr = selector.match(/^button\[data-model-id="(.+)"\]$/);
  if (dataAttr) return node.tagName === 'BUTTON' && node.dataset.modelId === dataAttr[1];
  if (selector === 'button[aria-sort]:not([aria-sort="none"])') {
    return node.tagName === 'BUTTON' && node.getAttribute('aria-sort') && node.getAttribute('aria-sort') !== 'none';
  }
  if (selector.startsWith('.')) return String(node.className).split(/\s+/).includes(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}

let hosts;
let originalDocument;

beforeEach(() => {
  originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag) => createNode(tag),
    createElementNS: (ns, tag) => createNode(tag, ns),
    createTextNode: (text) => ({ tagName: '#text', children: [], dataset: {}, className: '', textContent: String(text), parent: null }),
  };
  hosts = {
    radar: createNode('div'),
    table: createNode('div'),
    boards: createNode('div'),
    scoreboard: createNode('div'),
  };
});

afterEach(() => {
  globalThis.document = originalDocument;
});

function render(lang = 'en') {
  return initSectorsCompetition(hosts, DATA, { lang: () => lang });
}

describe('radar rendering', () => {
  it('plots one picker button per roster model and preselects four', () => {
    render();
    const buttons = hosts.radar.all((node) => node.tagName === 'BUTTON' && node.dataset.modelId);
    expect(buttons.length).toBe(DATA.models.length);
    expect(buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').length).toBe(4);
  });

  it('names the SVG with every plotted value so the chart is not the only channel', () => {
    render();
    const chart = hosts.radar.querySelector('svg');
    const label = chart.getAttribute('aria-label');
    expect(label).toContain('Claude Opus 5');
    expect(label).toContain('61');
    expect(label).toContain('Kimi K3');
  });

  it('says how many measurements are unpublished instead of drawing them as zero', () => {
    render();
    const caption = hosts.radar.querySelector('.rbRadarFig').children.find((child) => child.tagName === 'FIGCAPTION');
    expect(caption.getAttribute('aria-live')).toBe('polite');
    expect(caption.textContent).toMatch(/not published/i);
    expect(caption.textContent).toMatch(/not as zero/i);
  });

  it('distinguishes China-bloc series by stroke pattern as well as colour', () => {
    render();
    const lines = hosts.radar.all((node) => node.tagName === 'LINE' && node.getAttribute('stroke-dasharray'));
    expect(lines.length).toBeGreaterThan(0);
  });

  it('caps the comparison at four series and keeps the newest pick', () => {
    render();
    const grok = hosts.radar.querySelector('button[data-model-id="grok-4-5"]');
    grok.click();
    const pressed = hosts.radar
      .all((node) => node.tagName === 'BUTTON' && node.dataset.modelId)
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.dataset.modelId);
    expect(pressed.length).toBe(4);
    expect(pressed).toContain('grok-4-5');
  });

  it('deselects a model that is clicked again', () => {
    render();
    hosts.radar.querySelector('button[data-model-id="kimi-k3"]').click();
    const pressed = hosts.radar
      .all((node) => node.tagName === 'BUTTON' && node.dataset.modelId)
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.dataset.modelId);
    expect(pressed).not.toContain('kimi-k3');
    expect(pressed.length).toBe(3);
  });

  it('switches the whole section to Chinese copy', () => {
    render('zh');
    expect(hosts.radar.textContent).toContain('未公布');
    expect(hosts.scoreboard.textContent).toContain('权重');
  });
});

describe('benchmark table', () => {
  it('renders one row per model with every declared column plus a note column', () => {
    render();
    const rows = hosts.table.all((node) => node.tagName === 'TR').slice(1);
    expect(rows.length).toBe(DATA.models.length);
    for (const row of rows) {
      const cells = row.children.filter((child) => child.tagName === 'TD' || child.tagName === 'TH');
      expect(cells.length).toBe(DATA.benchColumns.length + 2);
    }
  });

  it('labels deliberately-empty columns rather than making them sortable', () => {
    render();
    const headerButtons = hosts.table.all((node) => node.tagName === 'BUTTON' && node.getAttribute('aria-sort'));
    const sortable = DATA.benchColumns.filter((column) => !column.status).length;
    expect(headerButtons.length).toBe(sortable);
    const notPublished = hosts.table.all((node) => node.dataset.tier === 'not_published');
    expect(notPublished.length).toBeGreaterThan(0);
  });

  it('re-sorts on header activation and flips direction on a second press', () => {
    render();
    const priceHeader = () => hosts.table
      .all((node) => node.tagName === 'BUTTON' && node.getAttribute('aria-sort'))
      .find((button) => button.textContent.includes('Input'));
    priceHeader().click();
    expect(priceHeader().getAttribute('aria-sort')).toBe('ascending');
    priceHeader().click();
    expect(priceHeader().getAttribute('aria-sort')).toBe('descending');
  });

  it('publishes the provenance mix under the table', () => {
    render();
    expect(hosts.table.textContent).toMatch(/Provenance mix: \d+ verified/);
  });
});

describe('equity boards', () => {
  it('builds two boards of ten ranked rows each', () => {
    render();
    const boards = hosts.boards.all((node) => String(node.className).includes('rbBoard') && node.dataset.bloc);
    expect(boards.map((board) => board.dataset.bloc)).toEqual(['US', 'CN']);
    for (const board of boards) {
      expect(board.all((node) => String(node.className) === 'rbRow').length).toBe(10);
    }
  });

  it('marks every desk weight as an estimate, never as data', () => {
    render();
    const weights = hosts.boards.all((node) => String(node.className) === 'rbTier');
    expect(weights.length).toBeGreaterThan(0);
    for (const badge of weights) expect(badge.dataset.tier).toBe('estimate');
  });

  it('states the no-advice position on both boards', () => {
    render();
    const notes = hosts.boards.all((node) => String(node.className) === 'rbBoardNote');
    expect(notes.length).toBe(2);
    expect(notes[0].textContent).toMatch(/not a recommendation/i);
    expect(notes[1].textContent).toMatch(/not as advice/i);
  });
});

describe('scoreboard', () => {
  it('prints both composites and gives the US bloc the higher total', () => {
    render();
    const totals = hosts.scoreboard.all((node) => String(node.className) === 'rbTotal');
    expect(totals.length).toBe(2);
    const [us, cn] = totals.map((total) => Number.parseFloat(total.children.find((child) => child.tagName === 'B').textContent));
    expect(us).toBeGreaterThan(cn);
  });

  it('renders four axes, each with method and evidence', () => {
    render();
    const axes = hosts.scoreboard.all((node) => String(node.className) === 'rbAxisRow');
    expect(axes.length).toBe(4);
    for (const axis of axes) {
      const methods = axis.all((node) => String(node.className) === 'rbAxisMethod');
      expect(methods.length).toBe(2);
    }
  });

  it('shows the data axis as a China lead so the scoreboard is not one-sided', () => {
    render();
    const leads = hosts.scoreboard.all((node) => String(node.className) === 'rbBloc').map((node) => node.dataset.bloc);
    expect(leads).toContain('CN');
    expect(leads).toContain('US');
  });

  it('states both cases in the outlook', () => {
    render();
    const outlook = hosts.scoreboard.querySelector('.rbOutlook');
    expect(outlook.textContent).toMatch(/case that the US position holds/i);
    expect(outlook.textContent).toMatch(/case that convergence wins/i);
  });
});

describe('lifecycle', () => {
  it('clears every host on destroy', () => {
    const handle = render();
    handle.destroy();
    for (const host of Object.values(hosts)) expect(host.children.length).toBe(0);
  });

  it('re-renders idempotently when the locale changes', () => {
    const handle = render();
    const before = hosts.boards.all((node) => String(node.className) === 'rbRow').length;
    handle.render();
    expect(hosts.boards.all((node) => String(node.className) === 'rbRow').length).toBe(before);
  });
});
