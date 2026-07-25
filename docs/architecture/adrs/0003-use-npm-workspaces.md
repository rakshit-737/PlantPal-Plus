# ADR 0003: Monorepo Structure with npm Workspaces

## Status
Accepted

## Context
PlantPal+ consists of multiple applications:
- A Node.js Express Backend (`apps/api`)
- A React Vite Web App (`apps/web`)
- A React Native Expo Mobile App (`apps/mobile`)

There is a strict requirement (`NFR-MAIN-03`) that domain calculations (like the watering algorithm, Atwater energy calculation, etc.) must exist in exactly one place to ensure bit-for-bit agreement across the server, web, and mobile clients.
We need a repository structure that supports this code sharing seamlessly without publishing internal packages to a registry.

## Decision
We will use a **TypeScript Monorepo powered by npm Workspaces**.
- We will organize the repository into `apps/` and `packages/` directories.
- Shared business logic will live in `packages/shared`.
- UI components will live in `packages/ui`.
- All applications will consume these shared packages via standard npm workspace symlinking.
- We explicitly chose `npm workspaces` over tools like Turborepo or Nx as a locked tooling decision to minimize overhead and rely on standard Node.js tooling.

## Consequences
**Positive:**
- Guarantees a single source of truth for all business logic (`packages/shared`).
- Simplifies cross-project refactoring. TypeScript will immediately flag if an API change breaks the mobile app.
- Unified dependency management.

**Negative:**
- Slower `npm install` times at the root level compared to isolated repos.
- React Native's Metro bundler historically struggles with symlinks, requiring specific configuration (`expo-yarn-workspaces` or careful `metro.config.js` tuning) to resolve packages correctly.
