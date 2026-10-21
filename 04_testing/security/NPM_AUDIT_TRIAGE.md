DEF-022 triage. Command: npm audit --omit=dev in 03_implementation, 18 Oct 2026 (sandbox, registry data of that date). Result: 35 findings: 2 critical, 23 high, 10 moderate.

Where each critical/high finding comes from (npm ls):
- API runtime: proxy-addr (critical, IP spoofing via IPv4-mapped addresses), pulled by express 4.22.2. api/src/app.ts sets trust proxy to 1, so req.ip, and anything keyed on it such as rate limiting, can be affected. Fix available without a major version change. ACTION: update express/proxy-addr, retest rate limiting. This is the only finding that touches the server.
- Mobile toolchain only (24 findings): shell-quote (critical, command injection in quote()), compression, nanoid, brace-expansion, js-yaml, image-size, @xmldom/xmldom, source-map-js, micromatch, braces, node-forge, @expo/* and metro* packages, react-native (high via its CLI plugin and virtualized-lists), expo. All resolve under mobile, via expo 57.0.10 and react-native 0.86.0.
- Web: no critical or high finding appears.

Judgement, not proven: the mobile findings are in the Expo/Metro build and dev-server tooling, which does not ship in the installed app or the API. They are listed as production because expo and react-native sit in dependencies. Confirm by checking which of these packages end up in the built app bundle. Do not follow npm's suggested fix (expo@44.0.6): it is a downgrade artefact.

NFR-LEGL-05 asks for a clean audit at high severity. Not met as run. Suggested DEF-022 handling: split into DEF-022a (proxy-addr, S3, fix) and DEF-022b (mobile toolchain, S4 until shown to ship).
