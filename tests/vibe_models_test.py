"""Assumption-only synthetic maths and real HTTP boundary; no provider requests."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import socket
import threading
import unittest
from unittest.mock import patch
from http.server import HTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('model_api', ROOT/'api/vibe-model.py')
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
EXAMPLE = {'instrument_id': 'US:AAPL', 'module': 'option_model', 'parameters':
           dict(spot=100, strike=100, years=1, rate=.05, volatility=.2, dividend_yield=0, right='call')}


class Models(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Imports are covered by the outbound socket denial, too.
        with patch.object(socket, 'socket', side_effect=AssertionError('network forbidden')):
            cls.reference = api.runtime.calculate(EXAMPLE)
        cls.server = HTTPServer(('127.0.0.1', 0), api.handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.thread.join(); cls.server.server_close()

    def setUp(self):
        api.rate_limit._local.clear()

    def call(self, value=EXAMPLE, *, enabled=True, method='POST', query='', content_type='application/json'):
        raw = value if isinstance(value, bytes) else json.dumps(value).encode()
        request = Request(f'http://127.0.0.1:{self.server.server_port}/api/vibe-model{query}',
                          data=raw if method=='POST' else None, method=method,
                          headers={'Content-Type': content_type})
        with patch.dict(os.environ, {'VIBE_MODELS_ENABLED': 'true' if enabled else 'false'}):
            try:
                with urlopen(request, timeout=10) as response:
                    return response.status, dict(response.headers), json.loads(response.read())
            except HTTPError as response:
                raw = response.read()
                return response.code, dict(response.headers), json.loads(raw) if raw else None

    def test_fixed_source_reference_and_greek_units(self):
        result = self.reference['result']
        self.assertEqual(result['status'], 'available')
        self.assertAlmostEqual(result['data']['price'], 10.450583572185565, places=12)
        self.assertEqual(result['data']['quote_source'], None)
        self.assertAlmostEqual(result['data']['greeks']['vega'], .3752403469169379, places=12)
        self.assertEqual(result['provenance'], [])

    def test_put_call_parity_and_degenerate_inputs_without_network(self):
        import math
        with patch.object(socket, 'socket', side_effect=AssertionError('network forbidden')):
            request=copy.deepcopy(EXAMPLE); request['parameters']['right']='put'
            put=api.runtime.calculate(request)['result']['data']['price']
            self.assertAlmostEqual(self.reference['result']['data']['price']-put, 100-100*math.exp(-.05), places=11)
            request['parameters'].update(spot=80, years=0)
            self.assertEqual(api.runtime.calculate(request)['result']['data']['price'], 20)
            request['parameters'].update(spot=100, years=1, volatility=0)
            self.assertEqual(api.runtime.calculate(request)['result']['status'], 'available')

    def test_exact_multi_leg_expiry_and_catalogue_without_network(self):
        request={'instrument_id':'US:AAPL','module':'option_payoff','parameters':dict(
            legs=[dict(option_type='call',strike=100,qty=1,premium=10)],spots=[0,100,110,200],
            entry_spot=100,years=1,rate=.05,volatility=.2,multiplier=100,commission_rate=0)}
        with patch.object(socket, 'socket', side_effect=AssertionError('network forbidden')):
            payoff=api.runtime.calculate(request)['result']
            self.assertEqual(payoff['status'],'available')
            self.assertEqual(payoff['data']['premium_source'],'caller_supplied')
            self.assertIn(110, payoff['data']['breakevens'])
            for instrument in ('US:AAPL', 'US:IVV', 'CRYPTO:OKX:BTC-USDT:SPOT'):
                catalogue=api.runtime.calculate({'instrument_id':instrument,'module':'catalogue','parameters':{}})
                self.assertEqual(catalogue['status'],'complete')
                self.assertEqual(len(catalogue['result']['data']['factors']),2 if instrument=='US:AAPL' else 0)

    def test_http_gate_and_complete_response_without_secrets(self):
        self.assertEqual(self.call(enabled=False)[0],404)
        status, headers, job=self.call()
        self.assertEqual(status,200); self.assertEqual(headers['Cache-Control'],'private, no-store')
        self.assertEqual(job['status'],'complete');self.assertEqual(len(job['id']),32)
        self.assertNotIn('VIBE_BRIDGE_TOKEN',json.dumps(job))
        self.assertEqual(self.call(method='GET')[0],405)
        self.assertEqual(self.call(method='DELETE')[0],405)

    def test_rejects_owners_data_network_destinations_and_oversized_inputs(self):
        for module in ('backtest','options_chain','cashflows','audit','portfolio','factors'):
            with self.subTest(module=module):
                self.assertEqual(self.call({**EXAMPLE,'module':module})[0],400)
        for field in ('owner','url','code','api_key'):
            with self.subTest(field=field):
                self.assertEqual(self.call({**EXAMPLE,field:'not-allowed'})[0],400)
        self.assertEqual(self.call(b'x'*32769)[0],413)
        self.assertEqual(self.call(query='?url=https://example.com')[0],400)
        self.assertEqual(self.call(content_type='text/plain')[0],400)
        self.assertEqual(self.call(b'{"module":"option_model","module":"catalogue"}')[0],400)
        self.assertEqual(self.call(b'{"parameters":{"spot":NaN}}')[0],400)

    def test_input_errors_do_not_create_or_retain_jobs(self):
        request=copy.deepcopy(EXAMPLE);request['parameters']['spot']=-1
        status, _, job=self.call(request)
        self.assertEqual(status,200)
        self.assertEqual(job['result']['status'],'unavailable')
        self.assertEqual(job['result']['reason'],'INPUT_INVALID')
        self.assertEqual(job['result']['data'],{})

    def test_http_rate_limit_and_failure_skip_calculation(self):
        with patch.object(api.rate_limit, 'check', return_value=(False, 59201)), patch.object(api.runtime, 'calculate') as calculate:
            status, headers, result = self.call()
            self.assertEqual(status, 429)
            self.assertEqual(headers['Retry-After'], '60')
            self.assertEqual(result['error']['code'], 'RATE_LIMITED')
            calculate.assert_not_called()
        with patch.object(api.rate_limit, 'check', side_effect=api.rate_limit.Unavailable), patch.object(api.runtime, 'calculate') as calculate:
            status, headers, result = self.call()
            self.assertEqual(status, 503)
            self.assertEqual(result['error']['code'], 'RATE_LIMIT_UNAVAILABLE')
            calculate.assert_not_called()

    def test_redis_atomic_contract_and_no_production_fallback(self):
        from unittest.mock import MagicMock
        limiter = api.rate_limit
        with patch.dict(os.environ, {'VERCEL': '1', 'VERCEL_ENV': 'production',
                'UPSTASH_REDIS_REST_URL': 'https://redis.example.test', 'UPSTASH_REDIS_REST_TOKEN': 'test-token'}):
            response = MagicMock()
            response.__enter__.return_value.read.return_value = b'{"result":[21,59000]}'
            with patch.object(limiter, 'urlopen', return_value=response) as fetch:
                self.assertEqual(limiter.check('model:ip', '1.2.3.4', 20), (False, 59000))
                command = json.loads(fetch.call_args.args[0].data)
                self.assertEqual(command[0], 'EVAL')
                self.assertIn('PEXPIRE', command[1])
                self.assertNotIn('1.2.3.4', command[3])
            for raw in (b'{"error":"secret"}', b'{"result":[1,-1]}', b'{"result":[true,60000]}'):
                response.__enter__.return_value.read.return_value = raw
                with patch.object(limiter, 'urlopen', return_value=response), self.assertRaises(limiter.Unavailable):
                    limiter.check('model:ip', '1.2.3.4', 20)
            with patch.object(limiter, 'urlopen', side_effect=TimeoutError), self.assertRaises(limiter.Unavailable):
                limiter.check('model:ip', '1.2.3.4', 20)
            self.assertEqual(limiter._local, {})

    def test_no_redis_configuration_on_vercel_fails_closed(self):
        with patch.dict(os.environ, {'VERCEL': '1', 'VERCEL_ENV': 'production',
                'UPSTASH_REDIS_REST_URL': '', 'UPSTASH_REDIS_REST_TOKEN': '',
                'KV_REST_API_URL': '', 'KV_REST_API_TOKEN': ''}):
            with self.assertRaises(api.rate_limit.Unavailable):
                api.rate_limit.check('model:ip', '1.2.3.4', 20)
            self.assertEqual(api.rate_limit.client_ip({'x-forwarded-for': 'spoofed'}, '127.0.0.1'), 'unknown')
            self.assertEqual(api.rate_limit.client_ip({'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': 'spoofed'}, '127.0.0.1'), '1.2.3.4')
        self.assertEqual(api.rate_limit._local, {})

    def test_global_quota_runs_before_model(self):
        with patch.object(api.rate_limit, 'check', side_effect=[(True, 60000), (False, 5000)]) as check, patch.object(api.runtime, 'calculate') as calculate:
            self.assertEqual(self.call()[0], 429)
            self.assertEqual([call.args[0] for call in check.call_args_list], ['model:ip', 'model:global'])
            calculate.assert_not_called()

    def test_source_drift_blocks_calculation(self):
        with patch.object(api.runtime,'verify_sources',side_effect=RuntimeError('SOURCE_BLOB_MISMATCH')):
            status, _, result=self.call()
        self.assertEqual(status,503)
        self.assertEqual(result['error']['code'],'MODEL_UNAVAILABLE')


if __name__ == '__main__':
    unittest.main()
