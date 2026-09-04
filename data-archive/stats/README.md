# Prediction statistics data archive

The public Stats page was retired on 2026-09-05. Its two source datasets are
preserved here as immutable JSON snapshots. They are not copied into the public
site build.

| Snapshot | Event | Source `updated` | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `2026-09-05/games-data.json` | FIFA World Cup 2026 | 2026-07-20 | 42,187 | `7761bb4d9b0e8289828999ddee9100960ad5d2d130c5fc4dc06bc44ab6c2a7e2` |
| `2026-09-05/leagues-data.json` | MSI 2026 Bracket Stage | 2026-08-05 | 27,531 | `c25a6c48ecc98917e00c1b55059e613e8ce892f4dd8451ab373448f8d4ef22dc` |

Before archival, both files were downloaded from their former public URLs and
compared byte-for-byte with the repository copies. The SHA-256 values matched.
The JSON payloads retain their original source URLs, predictions, confidence
values, results, reasoning, and settled aggregate records.

Run `npm run data:check` to validate the archived payloads together with the
site's active public datasets.
