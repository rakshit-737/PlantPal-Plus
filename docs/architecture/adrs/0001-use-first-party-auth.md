# ADR 0001: Use First-Party Authentication Instead of Supabase Auth

## Status
Accepted

## Context
PlantPal+ uses Supabase as its database provider (PostgreSQL) and object storage solution. However, we need to decide how to handle user authentication, token issuance, and session management. Supabase provides a built-in Auth service (GoTrue) that integrates natively with PostgreSQL Row-Level Security (RLS). Alternatively, we can build a custom first-party auth solution inside our Express.js backend.

The requirements specify:
- Concurrent sessions capped at 10 (evicting the oldest on the 11th).
- Family revocation of refresh tokens on reuse detection.
- Soft-deletion grace periods where signing in cancels the deletion.
- Fine-grained error responses (e.g., identical responses for unknown-account vs wrong-password).

## Decision
We will build a **first-party authentication system** directly into the Node.js/Express API instead of using Supabase Auth.
- We will store passwords using Argon2id hashing.
- We will issue short-lived JWT access tokens (15m) and long-lived opaque refresh tokens (30d).
- Refresh tokens will be stored as SHA-256 digests in the database.
- We will implement strict session capping and family revocation logic in the API.
- Because `auth.uid()` will not be available from Supabase (since we aren't using their JWTs), tenant isolation will be handled at the application layer by scoping all queries with the `user_id` extracted from the verified access token.

## Consequences
**Positive:**
- Complete control over the auth flows, enabling strict compliance with requirements like session capping and grace-period logins.
- Easy to intercept and handle custom error logic.
- Avoids vendor lock-in to Supabase Auth.

**Negative:**
- Increased complexity and maintenance burden for the auth module.
- We cannot leverage Supabase Row-Level Security (RLS) as easily without custom workarounds (e.g., `SET LOCAL`).
- We must manually secure every data access query by appending `WHERE user_id = $1`.
