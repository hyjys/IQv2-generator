# IQv2 Generator contributor instructions

Read `AKADEMIYA_AI_INTEGRATION.md` before changing the IQv2 contract, CLI, skill snapshots or packaging.

- This app must run without an Akademiya checkout, account, service, font installation or network connection.
- Keep canonical files in `src/core/vendor/` byte-identical to the source revision recorded by PROVENANCE.md. Put standalone extensions outside vendor files; update provenance and regression tests deliberately.
- GUI, CLI and PDF share the same core validation and renderer. Reject unsupported/invalid content rather than silently dropping fields. Preserve unknown JSON fields through editing and export.
- Never turn a static schema/geometry pass into a claim that subject facts, copyright or answer uniqueness were proven. Keep errors and review warnings distinct.
- Use the checked-in ImsiQuiz CSS tokens. Keep document fonts and KaTeX offline. Respect Japanese/Chinese lang, ruby and IVS without character conversion.
- Electron renderer stays sandboxed with no Node integration. Never expose arbitrary filesystem or IPC access; deny remote navigation and content scripts.
- Check current npm registry versions before installing libraries. Pin exact versions and retain package-lock.json. Do not commit credentials, generated binaries, private papers, user drafts, node_modules or build outputs.
- Required verification for behavior changes: `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:desktop`. Check OS-specific CI before claiming cross-platform success.
- Distribute native packages through this public repository's GitHub Releases. Release tags use `v<package.json version>`. Do not add mandatory external hosting or auto-publishing to npm.
- Use meaningful Conventional Commit subjects with a reviewable body recording behavior, security decisions and actual verification. Push completed work unless the user says otherwise.
