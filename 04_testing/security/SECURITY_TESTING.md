# Security testing record

## Automated (inside the suites)
Authentication, JWT forgery (wrong secret, alg=none, expiry, audience, issuer, signature flip), refresh rotation and reuse revocation, CSRF origin check, IDOR across every plant route, 34 routes anonymous-401, enumeration resistance and timing floor, headers, CORS, body-size limit, SQL metacharacters, error leakage, rate limiter. See Test_Register, modules ACC, SEC, SYS.

## Dependency audit (RUN-01)
`npm audit --omit=dev` : 35 vulnerabilities (10 moderate, 23 high, 2 critical). Raw report: npm-audit-RUN01.json. Logged as DEF-022. Triage each finding: direct or transitive, runtime or build-time, fixable.

## Secret scan (RUN-01)
Regex scan of the repository (AWS keys, private keys, GitHub tokens, sk- keys, Slack tokens, quoted password/secret/api_key literals) outside tests, docs and examples: no findings. This is a heuristic, not gitleaks. Run gitleaks yourself: `gitleaks detect --source . --no-git`.

## OWASP ZAP baseline (you run this, local build only)
1. Start the API locally with a disposable database.
2. `docker run --rm -t --network host ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://localhost:4000 -r zap-report.html`
3. Triage each alert: log a defect ID or a written justification. Do not scan the live site.
