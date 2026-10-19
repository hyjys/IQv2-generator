# Upstream compatibility fixtures

These six JSON files are copied without modification from the bundled skill snapshots under `resources/skills/` on 2026-10-19. They are compatibility fixtures, not freshly authored exam content or complete exam papers.

| Fixture | Bundled source |
| --- | --- |
| iqv2-quiz.json | iqv2-generator/references/examples/quiz.json |
| iqv2-exam.json | iqv2-generator/references/examples/exam.json |
| iqv2-vocab.json | iqv2-generator/references/examples/vocab.json |
| iqv2-timeline.json | iqv2-generator/references/examples/timeline.json |
| mockmock-exam.json | mockmocktest/references/example.json |
| mockschool-exam.json | mockschooltest/references/example.json |

Known upstream inconsistency: `mockschooltest/references/example.json` declares `meta.exam.kind: "mockmock"` with system `2028`, rather than `mockschool` with `organization`. Its content currently matches the mockmock example. We retain that exact source artifact to make this discrepancy visible. `createTemplate("mockschool")` generates the correct standalone profile. Akademiya's next skill update should correct the source example and deliberately refresh this fixture and its expectation.

The test suite checks canonical + standalone validation, all projection modes, untouched optional-field round trips, nested media, and malformed drafts. These tests establish serialization and renderer compatibility; they do not certify factual correctness, a full educational blueprint, or exact HAFStudy pagination.
