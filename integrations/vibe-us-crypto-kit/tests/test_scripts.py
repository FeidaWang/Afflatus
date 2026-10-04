"""Static inventory and safe copy tests use temporary, synthetic repositories."""
import json
from pathlib import Path
import subprocess
import sys
import pytest
from bootstrap_upstream import verify_checkout, git
from inventory_upstream import scan_python, documented_tools, is_candidate, build_inventory
from apply_overlay import plan

ROOT=Path(__file__).resolve().parents[1]


def test_ast_inventory_does_not_execute():
    source='''import secret_module_that_does_not_exist\nraise RuntimeError("DO NOT EXECUTE")\n@mcp.tool(name="read_market")\nasync def impl(): pass\n@router.post("/private/run")\ndef run(): pass\n'''
    report=scan_python(source,'agent/src/tools/test.py')
    assert report['tools'][0]['name']=='read_market'
    assert report['routes'][0]['path']=='/private/run'
    assert 'secret_module_that_does_not_exist' in report['imports']


def test_syntax_errors_are_recorded():
    assert scan_python('def bad(', 'bad.py')['parse_error']=='bad.py:1'


def test_skill_table_inventory():
    assert documented_tools('| `get_market_data` | test |\n| `run_swarm` |test|')=={'get_market_data','run_swarm'}


@pytest.mark.parametrize('name',['agent/src/a.py','agent/backtest/engines/crypto.py','frontend/src/App.tsx','agent/skills/crypto/SKILL.md','LICENSE'])
def test_source_candidates(name): assert is_candidate(name)


@pytest.mark.parametrize('name',['frontend/public/fonts/a.woff2','frontend/src/fonts/LICENSE','agent/src/a.woff','../agent/src/a.py','/agent/src/a.py','.git/config','desktop/main.ts','node_modules/a.js'])
def test_excludes_fonts_binaries_and_escape(name): assert not is_candidate(name)


def test_unknown_tools_fail_coverage_not_silently_dropped(tmp_path):
    (tmp_path/'agent/src').mkdir(parents=True)
    (tmp_path/'agent/src/tool.py').write_text('@tool\ndef unexpected(): pass\n')
    (tmp_path/'agent/SKILL.md').write_text('| `expected` | doc |\n')
    policy={'tools':{'expected':{'decision':'retain'},'missing':{'decision':'retain'}}}
    report=build_inventory(tmp_path,policy)
    assert report['unclassified_tools']==['unexpected']
    assert report['policy_tools_not_found']==['missing']
    assert report['limitations']


def make_repo(tmp_path):
    repo=tmp_path/'repo';repo.mkdir()
    git('init',str(repo));git('config','user.email','offline-test@example.invalid',cwd=repo);git('config','user.name','Offline test',cwd=repo)
    (repo/'LICENSE').write_text('synthetic license\n')
    git('add','LICENSE',cwd=repo);git('commit','-m','synthetic fixture',cwd=repo)
    return repo,{'commit':git('rev-parse','HEAD',cwd=repo),'sentinel_blobs':{'LICENSE':git('hash-object','LICENSE',cwd=repo)}}


def test_pinned_checkout_and_blob(tmp_path):
    repo,lock=make_repo(tmp_path);verify_checkout(repo,lock)
    with pytest.raises(RuntimeError,match='COMMIT_MISMATCH'):verify_checkout(repo,{**lock,'commit':'0'*40})
    with pytest.raises(RuntimeError,match='SOURCE_BLOB_MISMATCH'):verify_checkout(repo,{**lock,'sentinel_blobs':{'LICENSE':'0'*40}})


def test_dirty_checkout_refused(tmp_path):
    repo,lock=make_repo(tmp_path);(repo/'secret.env').write_text('synthetic')
    with pytest.raises(RuntimeError,match='DIRTY_UPSTREAM'):verify_checkout(repo,lock)


def make_host(tmp_path):
    host=tmp_path/'host';host.mkdir();(host/'package.json').write_text('{"type":"module"}')
    return host


def test_overlay_never_overwrites(tmp_path):
    host=make_host(tmp_path);initial=plan(host)
    assert initial and all(not dest.exists() for _,dest in initial)
    destination=host/'api/vibe-market.js';destination.parent.mkdir();destination.write_text('existing')
    with pytest.raises(RuntimeError,match='overwrite'):plan(host)
    assert destination.read_text()=='existing'


def test_overlay_symlink_parent_rejected(tmp_path):
    host=make_host(tmp_path);outside=tmp_path/'outside';outside.mkdir();(host/'api').symlink_to(outside,target_is_directory=True)
    with pytest.raises(RuntimeError,match='Symlinked'):plan(host)


def test_overlay_dangling_symlink_rejected(tmp_path):
    host=make_host(tmp_path);(host/'api').mkdir();(host/'api/vibe-market.js').symlink_to(tmp_path/'missing')
    with pytest.raises(RuntimeError,match='overwrite'):plan(host)


def test_dry_run_and_explicit_copy(tmp_path):
    host=make_host(tmp_path);before=(host/'package.json').read_bytes()
    cmd=[sys.executable,str(ROOT/'scripts/apply_overlay.py'),'--target',str(host)]
    result=subprocess.run(cmd,check=True,capture_output=True,text=True)
    assert result.stdout.startswith('DRY RUN') and not (host/'api').exists()
    subprocess.run(cmd+['--apply'],check=True,capture_output=True,text=True)
    receipt=json.loads((host/'.vibe-overlay-receipt.json').read_text())
    assert receipt['files'] and (host/'api/vibe-market.js').exists()
    assert (host/'package.json').read_bytes()==before
    result=subprocess.run(cmd+['--apply'],capture_output=True,text=True)
    assert result.returncode!=0


def test_feature_manifest_has_unique_ids_and_closed_defaults():
    report=json.loads((ROOT/'manifests/capabilities.json').read_text())
    original_ids = {*(f'US{i:02d}' for i in range(1,9)), *(f'CR{i:02d}' for i in range(1,8)),
                    *(f'Q{i:02d}' for i in range(1,8)), *(f'AI{i:02d}' for i in range(1,5)),
                    'SH01','TR01','TR02','CTX01','EXT01'}
    assert original_ids <= {item['id'] for item in report['features']}
    original=json.loads((ROOT/'manifests/original-capability-ids.json').read_text())
    assert set(original['feature_ids']) <= {item['id'] for item in report['features']}
    assert set(original['tool_names']) <= set(report['tools'])
    assert len(report['tools']) >= 76
    assert report['all_advanced_features_migrated'] is False
    ids=[x['id'] for x in report['features']]
    assert len(set(ids))==len(ids)
    assert all(item['runtime_default'] != 'enabled' for item in report['tools'].values())
