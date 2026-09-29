# 《玉熙宫词》改稿工作稿

`public/novels/yuxi-gongci.json`（线上版）未改动。本目录是改写前工序（工序 2–5）的产物，全部改完、检查通过后再生成新 json 替换。

- `chapters/chNNN.md`：工作稿，按**旧章号** 001–200 存。每块前一行 `<!-- bN type [flag] -->`，N 为 json 原始块号（与逐章问题清单的块号一致）；删掉的块缺号。flag：`待重写`（工序 4 错位章）、`待修-引号`（工序 3 删句后引号不配平）。
- `_orig/`：导出时的原文快照，任何被删内容都能按章号、块号找回。
- `archive/`：工序 4 的错位章好段落存档、章题与正文对照。
- `logs/`：各工序日志（step2 清残留、step3 人名与前史〔被删句子全文〕、step5 合并重复稿及决策 JSON、step5 待作者）。
- `tools/`：`draftlib.py` 读写；`export_from_json.py` 导出；`step2_residue.py`、`step3_names_prehistory.py`、`step4_misplaced.py`、`step5_apply.py` 各工序；`verify.py all` 全文残留检查（零命中为通过）。
- `_work/`：打包中转文件，可删。
