/* A small strict XML reader for election feeds. package.json gains no parser.
   DOCTYPE and custom entities are refused outright, so external entities and
   entity expansion cannot happen. Anything unexpected throws. */
const PREDEFINED = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const MAX_DEPTH = 32;

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);?/g, (match, name) => {
    if (!match.endsWith(';')) throw new Error(`Malformed XML entity: ${match}`);
    if (name.startsWith('#x')) return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return String.fromCodePoint(parseInt(name.slice(1), 10));
    if (!Object.hasOwn(PREDEFINED, name)) throw new Error(`Unknown XML entity: ${name}`);
    return PREDEFINED[name];
  });
}

const ATTRIBUTE = /\s+([^\s=]+)\s*=\s*("[^"]*"|'[^']*')/y;

function parseAttributes(source) {
  const attributes = {};
  ATTRIBUTE.lastIndex = 0;
  while (ATTRIBUTE.lastIndex < source.length) {
    const start = ATTRIBUTE.lastIndex;
    const match = ATTRIBUTE.exec(source);
    if (!match) {
      if (source.slice(start).trim()) throw new Error('Malformed XML attribute');
      break;
    }
    attributes[match[1]] = decode(match[2].slice(1, -1));
  }
  return attributes;
}

const localName = (name) => name.slice(name.indexOf(':') + 1);

/** Parses a document into { name, attributes, children, text }. Prefixes are dropped from name. */
export function parseXml(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML DOCTYPE and entities are refused');
  const stack = [];
  let root = null;
  let index = xml.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (index < xml.length) {
    const open = xml.indexOf('<', index);
    if (open === -1) {
      if (xml.slice(index).trim()) throw new Error('Text outside the XML root');
      break;
    }
    if (open > index) {
      const text = xml.slice(index, open);
      if (stack.length) stack.at(-1).text += decode(text);
      else if (text.trim()) throw new Error('Text outside the XML root');
    }
    if (xml.startsWith('<?', open)) {
      const end = xml.indexOf('?>', open);
      if (end === -1) throw new Error('Unterminated XML declaration');
      index = end + 2;
    } else if (xml.startsWith('<!--', open)) {
      const end = xml.indexOf('-->', open);
      if (end === -1) throw new Error('Unterminated XML comment');
      index = end + 3;
    } else if (xml.startsWith('<![CDATA[', open)) {
      const end = xml.indexOf(']]>', open);
      if (end === -1 || !stack.length) throw new Error('Misplaced XML CDATA');
      stack.at(-1).text += xml.slice(open + 9, end);
      index = end + 3;
    } else if (xml.startsWith('</', open)) {
      const end = xml.indexOf('>', open);
      if (end === -1) throw new Error('Unterminated XML closing tag');
      const name = localName(xml.slice(open + 2, end).trim());
      const node = stack.pop();
      if (!node || node.name !== name) throw new Error(`Mismatched XML tag: ${name}`);
      index = end + 1;
    } else {
      const end = xml.indexOf('>', open);
      if (end === -1) throw new Error('Unterminated XML tag');
      const selfClosed = xml[end - 1] === '/';
      const body = xml.slice(open + 1, selfClosed ? end - 1 : end);
      const split = body.search(/\s/);
      const rawName = split === -1 ? body : body.slice(0, split);
      if (!rawName || /[<&]/.test(rawName)) throw new Error('Malformed XML tag name');
      const node = {
        name: localName(rawName),
        attributes: split === -1 ? {} : parseAttributes(body.slice(split)),
        children: [],
        text: '',
      };
      if (stack.length) stack.at(-1).children.push(node);
      else if (root) throw new Error('More than one XML root');
      else root = node;
      if (!selfClosed) {
        if (stack.length >= MAX_DEPTH) throw new Error('XML nested too deeply');
        stack.push(node);
      }
      index = end + 1;
    }
  }
  if (stack.length) throw new Error(`Unclosed XML tag: ${stack.at(-1).name}`);
  if (!root) throw new Error('Empty XML document');
  return root;
}

export const child = (node, name) => node?.children.find((item) => item.name === name) || null;
export const childrenOf = (node, name) => (node ? node.children.filter((item) => item.name === name) : []);
