# Security Policy

## Supported versions

PlantPal+ is deployed continuously from `main`. Security fixes land on `main` and reach the live deployment from there; earlier commits are not patched separately.

## Reporting a vulnerability

**Please do not report security problems in public issues, pull requests or discussions.**

1. **Preferred:** use **[Report a vulnerability](https://github.com/rakshit-737/PlantPal-Plus/security/advisories/new)** on the repository's Security tab. It opens a private advisory that only the maintainer can read.
2. **If that button is not available,** open an issue titled **"Security contact request"** with no details at all. The maintainer will reply with a private way to send the report.

A useful report says:

- what an attacker could do, and what access or conditions they need;
- how to reproduce it, ideally against a **local** copy of the project;
- the affected part (API endpoint or module, web page, mobile screen) and the commit you tested.

This is a one-maintainer project. Reports are acknowledged as soon as possible, and you will hear whether the problem is confirmed and how it will be fixed. With your agreement, you are credited in the published advisory.

## Testing guidelines

- Test against a local deployment ([Getting started](../README.md#getting-started)), not the live site.
- Only ever use accounts and data you created yourself. If you reach someone else's data, stop and report what you found without keeping a copy.
- No denial-of-service testing, spam, social engineering or physical attacks.

## Scope

**In scope:** the code in this repository and the deployment it describes, which is the website at https://plant-pal-plus.vercel.app and the API behind its `/api` path.

**Out of scope:** vulnerabilities in the hosting and platform providers themselves (Vercel, Supabase, GitHub, Expo), which should go to that provider, and findings that require an already-compromised device or browser.

## How accounts are protected

For context when assessing a finding: passwords are hashed with Argon2id; access tokens live for 15 minutes and are held in memory by the website; refresh tokens are opaque, stored only as SHA-256 digests, delivered to the website as httpOnly cookies, rotated on every use, and a reused token revokes its whole family. Logins are rate-limited and lock out after repeated failures, and every query is scoped to the authenticated user. The design and its reasoning are in [ADR 0001](../02_design/architecture/adrs/0001-use-first-party-auth.md) and the [API specification](../02_design/architecture/03-api-specification.md).
