## What and why

<!-- What does this change do, and why is it needed? Link the issue it resolves, e.g. "Closes #12". -->

## Requirements

<!-- The FR-, BR- or NFR- identifiers this implements or changes, if any. -->

## How it was tested

<!-- Commands run, tests added or updated, manual checks. For UI changes, add screenshots in light and dark themes. -->

## Checklist

- [ ] The title follows Conventional Commits, e.g. `fix(plants): …` (it becomes the squash commit message)
- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass locally
- [ ] Tests cover the behaviour that changed
- [ ] Documentation is updated where behaviour, configuration or the API changed, with a changelog line under **Unreleased** for user-visible changes
- [ ] UI changes use design tokens only and were checked in light and dark themes and with reduced motion
- [ ] Schema changes are a new numbered migration; API changes are reflected in `openapi.yaml` and the API reference
