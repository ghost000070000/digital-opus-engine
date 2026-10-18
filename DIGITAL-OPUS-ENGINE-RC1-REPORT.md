# Digital Opus Engine RC1 Report

1. **Verdict:** `DIGITAL_OPUS_ENGINE_RC1_READY_FOR_HUMAN_ACCEPTANCE`.
2. **Source HEAD:** `f1dc3516b585ebf5aa868006792c1dc1b9039da9` on `main`.
3. **Source checkpoint status:** `RC1_SOURCE_CHECKPOINT_DEFERRED_DIRTY_WORKTREE`.
4. **Release commit:** None. The mixed dirty worktree could not be safely scoped without capturing unrelated/local files.
5. **Local tag:** None.
6. **Build result:** PASS. Engine bundle, 28 game exports, Engine site, and Games site built from current source. The first two Engine build attempts encountered a transient Windows file-open lock on `dist/opus-engine.js`; a retry completed normally without a source workaround.
7. **Engine tests:** PASS — 33/33.
8. **Showcase tests:** PASS — 15/15.
9. **Integration test:** PASS — 1/1 public-site integration test.
10. **Gameplay-feel audit:** PASS — 28/28 using native keyboard/mouse input and read-only runtime instrumentation.
11. **Game count:** 28 public games; no game #29.
12. **Featured count:** 4 — Forest Range, Arsenal Run, Power Grid, and Moving Temple.
13. **Sample count:** 24; Internal count is 0.
14. **Public package size:** 220,805,827 bytes uncompressed across 126 files.
15. **RC ZIP size:** 67,146,616 bytes.
16. **RC ZIP SHA-256:** `6d797a2f7a7e22d2b097f69c989ddbb4d896b205cddc25cd8f5e7b840c40e091`.
17. **Secret scan:** `RC1_PACKAGE_SECRET_SCAN_CLEAN`; no keys, tokens, private keys, passwords, credentials, or `.env` content found in the package.
18. **Path scan:** CLEAN; no `C:\Users`, `THINKPAD`, localhost, loopback, `file://`, `node_modules`, evidence/review paths, `.claude`, or `.git` references found.
19. **Extracted-ZIP clean room:** PASS. The exact ZIP was extracted to an unrelated temporary directory, served fresh, and tested there—not from `dist/engine-site/`.
20. **Engine Home:** PASS at `/`, status 200 with correct Digital Opus Engine identity.
21. **Editor:** PASS at `/editor/`; loaded without fatal console errors or external network dependencies.
22. **Games hub:** PASS at `/games/`; catalog contains exactly 28 entries.
23. **Featured 4:** PASS. All four had correct titles/cards, started, paused, emitted no fatal console error, and made no unexpected external request.
24. **Forest Range deep link:** PASS at `/editor/?game=forest-range`.
25. **Arsenal mouse/collision sanity:** PASS. Right/left/up/down signs, sensitivity, Invert Y, pointer-lock release/reacquire, wall stop, and retreat all verified.
26. **Moving Temple platform sanity:** PASS. Native-input jump landed on the moving platform and passive carry tracked its motion.
27. **Survival Arena 2 Hovercraft sanity:** PASS. Authored speed/acceleration, acceleration, steering, braking, and boost behavior verified.
28. **Editor edit/play:** PASS. Survival Arena 2 loaded through the Editor, one harmless object X-position edit was made through the UI, and Play used the edited value.
29. **Playable Export:** PASS. The actual Export Playable handler generated a 2,122,021-byte standalone file containing the edit and no editor chrome.
30. **Editable Export:** PASS. The actual Export Editable handler generated a 2,121,983-byte standalone file; `Edit This Game` reopened its editor chrome.
31. **Standalone independence:** PASS. Both generated exports opened via `file://` in isolated browser contexts with zero HTTP requests and zero runtime errors. In the automated headless Edge environment, a page-closing native Blob-download limitation required the acceptance harness to capture the exact content produced by the clicked export handlers before writing it to disk; generation and isolated payload behavior were still exercised.
32. **Settings persistence:** PASS. Mouse Sensitivity `0.0019` and Invert Mouse Y persisted after reload; both were returned to defaults (`0.0018`, off).
33. **Human acceptance checklist:** Created at `release/rc1/HUMAN-ACCEPTANCE-CHECKLIST.md`; it covers six representative games with only PASS / NEEDS TUNING choices.
34. **Easiest local preview:** From repository root run `node tools/serve-static-root.js release/rc1/digital-opus-engine-web 8851`, then open `http://127.0.0.1:8851/`. For the actual hand test, extracting the ZIP and serving that extracted folder is preferred.
35. **Deployment:** Nothing was deployed.
36. **DNS:** No DNS was viewed or changed as part of this pass.
37. **Production ZIP:** No production/stable ZIP was created; only the local human-test RC1 ZIP exists.
38. **Release recommendation:** Freeze this candidate and begin the short human acceptance checklist. Do not advance to production until the user accepts feel.
39. **Remaining human gate:** Subjective control, collision, camera, and combat feel across Arsenal Run, Forest Range, Moving Temple, Survival Arena 2, Skyway Trial, and Opus Arena.
40. **Wave 10 status:** NOT STARTED.

RC1 is packaged, hashed, and automation-complete. Stop here for human hands.
