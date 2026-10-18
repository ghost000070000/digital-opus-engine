# Tilemap Bundle Security Contract

Bundle import is offline and treats all input as hostile data. It rejects malformed JSON, BOMs, wrong format/version/root kind, non-canonical JSON, non-finite values, `__proto__`/`prototype`/`constructor` keys, invalid hashes, invalid or missing blobs, malformed base64, unsupported MIME types, inline/remote asset URLs, excessive JSON/blob/count/depth sizes, and root-shape mismatches.

The UI renders filenames, summaries, errors, and warnings with `textContent` or existing HTML escaping. No imported string becomes executable HTML. Imported Prefab scripts are not evaluated and reset `scriptsTrusted` to false. SHA-256 is corruption evidence only; it does not establish publisher authenticity.

Limits in v1 are: 64 MiB JSON text, 128 blobs, 32 MiB per blob, 96 MiB decoded blobs total, 256 Layers, 100,000 Cells, 10,000 markers or dependencies per collection, and structural traversal depth 32.
