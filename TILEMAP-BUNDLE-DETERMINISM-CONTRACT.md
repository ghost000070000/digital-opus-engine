# Tilemap Bundle Determinism Contract

Canonical bundle JSON is UTF-8 without BOM, pretty-printed with two spaces, uses LF, and ends in one newline. Object keys are recursively lexical. Array order is semantic: Tilemap/Chunk Layers and authored library order remain meaningful; normalized Cell and Chunk Marker arrays use their existing canonicalizers; dependency and blob collections use stable identity/digest order. Non-finite numbers are rejected and negative zero becomes zero.

The integrity digest is lowercase SHA-256 over canonical `{format, version, rootKind, content}` bytes, excluding the `integrity` member itself. Browser hashing uses Web Crypto; Node qualification uses `crypto`. Each embedded blob is separately SHA-256 checked. Integrity detects corruption and is not an authenticity signature.

No timestamp, random export ID, machine path, session ID, or locale-dependent value is emitted. Exporting identical logical state twice is byte-identical. A clean import followed by export is byte-identical.
