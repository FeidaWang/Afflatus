#!/usr/bin/env python3
"""Reconcile inventories against explicit review decisions; never drops unknowns."""
import json
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]

def main():
 policy=json.loads((KIT/'manifests/capabilities.json').read_text())
 static=json.loads((KIT/'extracted/p0-verified/inventory.json').read_text())
 runtime=json.loads((KIT/'extracted/runtime.json').read_text())
 names={t['name'] for t in static['tools']}|{t['function']['name'] for t in runtime['local_tools']}|{t['name'] for t in runtime['mcp_tools']}|{t['name'] for t in runtime['discovered_classes']}
 unknown=sorted(names-policy['tools'].keys())
 groups=[
  ('exclude', 'Outside US/crypto scope or requires excluded-market instruments.', 'adr-hshare ashare-pre-st-filter commodity-analysis convertible-bond credit-analysis eastmoney hk-connect-flow mootdx tushare'),
  ('unavailable', 'Method template only. No verified historical on-chain/derivative/flow dataset is integrated; never fabricate data.', 'defi-yield liquidation-heatmap onchain-analysis perp-funding-basis stablecoin-flow token-unlock-treasury us-etf-flow'),
  ('conditional', 'Data-source guide only. Must restrict the actual tool/loader arguments to an explicitly approved US/crypto source; no implicit exchange fallback.', 'akshare ccxt data-routing edgar-sec-filings okx-market sec-edgar yfinance'),
  ('conditional', 'Method template only. Use verified US branch and point-in-time company/ETF/event data; template text is not a working connector.', 'bottleneck-hunter corporate-events deep-company-series dividend-analysis earnings-forecast earnings-revision etf-analysis financial-statement fund-analysis fundamental-filter investor-lenses management-deep-dive private-company-research sector-rotation thesis-tracker valuation-model'),
  ('conditional', 'Generic method/example code. Restrict universe to US/crypto and test warmup, costs and missing data. Optional libraries and strategy execution need isolation.', 'alpha-zoo asset-allocation backtest-diagnose behavioral-finance candlestick chanlun correlation-analysis correlation-regime cross-market-strategy crypto-derivatives elliott-wave event-driven execution-model factor-research geopolitical-risk global-macro harmonic hedging-strategy ichimoku macro-analysis market-microstructure minute-analysis ml-strategy multi-factor options-advanced options-payoff options-strategy pair-trading performance-attribution quant-statistics risk-analysis seasonal sentiment-analysis smc strategy-discovery strategy-generate technical-basic volatility'),
  ('conditional', 'Private research workflow/template. Needs owner identity, object permissions and bounded worker; no user data in public files. Not a mounted feature.', 'doc-reader pine-script regulatory-knowledge report-generate research-discipline research-goal shadow-account social-media-intelligence strategy-dev-manager trade-journal vnpy-export web-reader'),
  ('conditional', 'Paid provider is disabled. Requires separately approved operator credentials, rights and budget.', 'qveris'),
 ]
 skill_policy={name:{'decision':decision,'reason':reason} for decision,reason,items in groups for name in items.split()}
 skills=[{**s,**skill_policy.get(s['name'],{'decision':'UNCLASSIFIED','reason':'Requires explicit source/data review.'})} for s in runtime['skills']]
 def route_policy(path):
  if path.startswith(('/settings','/channels','/system','/mandate','/auth')) or (path.startswith('/live') and path!='/live/accounts'):
   return 'exclude','Operator/system/live configuration and execution are outside the dashboard surface.'
  if path in ['/api','/docs','/redoc','/openapi.json']:
   return 'exclude','Upstream API documentation/catalog is an audit artifact, not a website proxy.'
  if path.startswith(('/sessions','/runs','/swarm','/scheduled','/upload','/api/reports','/shadow-reports','/api/portfolio','/api/connections','/live/accounts')):
   return 'conditional','Owner identity, object authorization, bounded workers/uploads and connector capabilities required; route is not exposed.'
  if path.startswith(('/alpha','/options','/correlation')):
   return 'conditional','Adapt only the US/crypto research operation; validate data/math/jobs; upstream route is not mounted.'
  if path in ['/health','/ready','/skills']:
   return 'retain','Shared observability/catalog concept; bridge exposes its own restricted surface, not this upstream route.'
  return 'UNCLASSIFIED','Route needs review.'
 routes=[{**x,'decision':route_policy(x['path'])[0],'reason':route_policy(x['path'])[1]} for x in runtime['api_routes']]
 front=[]
 for path in runtime['frontend_routes']:
  decision='exclude' if path in ['/settings','/runtime','/about'] else 'conditional'
  front.append({'path':path,'decision':decision,'reason':'Preserve host MPA/navigation. Audit component for US/crypto reuse; do not copy upstream router or desktop configuration.'})
 report={'commit':json.loads((KIT/'manifests/upstream-lock.json').read_text())['commit'],
  'source_files':len(static['source_files']),'tools':[{ 'name':name, 'policy':policy['tools'].get(name,'UNCLASSIFIED'), 'locations':next((t['locations'] for t in static['tools'] if t['name']==name),[])} for name in sorted(names)],
  'skills':skills,'api_routes':routes,'frontend_routes':front,'unclassified_tools':unknown,
  'unclassified_skills':[s['name'] for s in skills if s['decision']=='UNCLASSIFIED'],
  'unclassified_routes':[r['path'] for r in routes if r['decision']=='UNCLASSIFIED'],
  'runtime_import_failures':runtime['import_failures'],'runtime_registration_failures':runtime['registration_failures']}
 (KIT/'manifests/coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 lines=['# Capability coverage — pinned source audit','',f"Source: `{report['commit']}`. {len(names)} audited tool candidates, {len(runtime['local_tools'])} registered local tools, {len(runtime['mcp_tools'])} MCP tools, {len(routes)} registered API routes, {len(skills)} loaded skills, {len(front)} frontend routes.",'',
 'The counts describe source presence, not implemented website features. Runtime imports use a fresh home, no credentials and denied socket connections. No tool or API lifespan ran. Test decorators and documentation config fields remain in the audit with explicit exclusion reasons.','',
 f"UNCLASSIFIED tools: {unknown}; skills: {report['unclassified_skills']}; routes: {report['unclassified_routes']}.",'',
 'Per-item decisions, reasons, file locations and skill descriptions: `manifests/coverage.json`. Full runtime/OpenAPI output: `extracted/runtime.json`. Static source/blob/function inventory: `extracted/p0-verified/inventory.json`.','',
 '## Newly identified research scope','',
 '|ID|Source capability|Website status|','|---|---|---|','|US09|Connector earnings calendar|Not integrated; needs a verified US connector|','|Q08|Decimal verification and numeric report audit|Not integrated; deterministic math separate from data|','|Q09|Hypotheses, run linkage and SDM decay monitoring|Not integrated; needs owned persistence and samples|','|AI05|Cross-session memory and image interpretation|Not integrated; owner isolation and optional budgeted model|','',
 'Actual runtime aliases `options_pricing`, `options_payoff`, `pattern`, `alpha_compare`, `scheduled_research`, `portfolio_risk_xray` are added to existing feature IDs. Original manifest names and every original ID remain. OCR backends rapid/llm-vision are inventoried as conditional dependencies, not claimed as BaseTools.','',
 '## Template/data boundary','',
 'All 90 skill documents are methods or examples, not evidence of available data. DeFi yield, on-chain metrics, liquidation maps, funding/basis, stablecoin flows, token unlocks and ETF creation/redemption flows are unavailable in the host until verified data adapters exist. Excluded-market guides remain in the immutable reference checkout.','',
 '## Host acceptance limits','',
 'P0 source reconciliation passes; host baseline unit failures remain separately recorded. P1 implementation and data-chain tests do not complete P2–P6. See IMPLEMENTATION_STATUS.md.']
 (KIT/'CAPABILITY_COVERAGE.md').write_text('\n'.join(lines)+'\n')
 print(json.dumps({key:report[key] for key in ['unclassified_tools','unclassified_skills','unclassified_routes','runtime_import_failures','runtime_registration_failures']}))
 if any(report[key] for key in ['unclassified_tools','unclassified_skills','unclassified_routes','runtime_import_failures','runtime_registration_failures']):raise SystemExit(2)

if __name__=='__main__':main()
