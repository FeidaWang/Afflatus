// Explicit provider inventory. A URL is configuration, never evidence of a working connection.
export const CONNECTORS = Object.freeze([
  ['daloopa','Daloopa','https://mcp.daloopa.com/server/mcp','Financial fundamentals'],
  ['morningstar','Morningstar','https://mcp.morningstar.com/mcp','Fund and company research'],
  ['sp-global','S&P Global','https://kfinance.kensho.com/integrations/mcp','Capital IQ research'],
  ['factset','FactSet','https://mcp.factset.com/mcp','Market and company data'],
  ['moodys',"Moody’s",'https://api.moodys.com/genai-ready-data/m1/mcp','Credit research'],
  ['mt-newswires','MT Newswires','https://vast-mcp.blueskyapi.com/mtnewswires','Financial news'],
  ['aiera','Aiera','https://mcp-pub.aiera.com','Event transcripts'],
  ['lseg','LSEG','https://api.analytics.lseg.com/lfa/mcp','Market analytics'],
  ['pitchbook','PitchBook','https://premium.mcp.pitchbook.com/mcp','Private markets'],
  ['chronograph','Chronograph','https://ai.chronograph.pe/mcp','Portfolio analytics'],
  ['egnyte','Egnyte','https://mcp-server.egnyte.com/mcp','Documents'],
  ['box','Box','https://mcp.box.com','Documents']
].map(([id,name,url,purpose])=>({id,name,url,purpose,status:'not_connected',adapter:'licensed-evidence-import',requiresEntitlement:true})));

export function connectorStatus() { return CONNECTORS.map(c=>({...c})); }
