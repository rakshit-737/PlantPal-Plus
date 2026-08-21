# Third-party licences

PlantPal+ is distributed under the MIT licence as a public repository. Anything
committed here is redistributed onward under those terms, so every piece of
third-party source in the tree has to permit that.

This file records where each vendored UI component came from and under what
licence. It is maintained alongside the code, not reconstructed afterwards:
adding a component and adding its row here are the same task.

## Vendored components

**None.** No third-party component source is present in this repository.

The Glasshouse UI work (`docs/design/05-glasshouse-master-prompt.md`) draws on
several component catalogues for ideas. So far every primitive has been written
in-repo against the design tokens, so there is nothing to attribute. When that
changes, each component gets a row here — source URL, licence, and the commit
that introduced it — and keeps its upstream copyright notice in the file header.

## Source audit

The catalogues consulted, and their standing for this repository.

### Cleared for vendoring — MIT

| Source | Licence | Notes |
|---|---|---|
| [Magic UI](https://magicui.design) | MIT | Effects and motion components. `magicui.design` serves Tailwind v4; this app is on Tailwind 3.4, so pull from `v3.magicui.design` or translate. Depends on `motion`, already a dependency here. |
| [shadcn/ui](https://ui.shadcn.com) | MIT | Interactive primitives Magic UI does not provide — dialog, tooltip, sidebar, carousel. Note that v2.0 of the design language dropped shadcn deliberately; re-adding any of it is a reversal to record in the design doc. |
| [Animate UI](https://animate-ui.com) | MIT | Animated shadcn primitives. Tailwind v3 support unverified — check before use. |
| [Animata](https://animata.design) | MIT | Widgets and micro-interactions. |

### Not cleared

| Source | Position |
|---|---|
| [Aceternity UI](https://ui.aceternity.com) | **Visual reference only — source must not be committed here.** Its licence permits building end products but forbids redistributing "the Item ... or its source files, regardless of modifications", and its terms reserve all rights and prohibit reproducing or redistributing site content. Neither page carves the free components out from the paid ones. Deploying a build made from it would be fine; committing adapted source to a public MIT repository is the thing the licence refuses. Read <https://ui.aceternity.com/licence> before revisiting this. |
| [21st.dev](https://21st.dev) | Components are licensed individually by their authors — there is no blanket grant. Any component from here needs its own licence checked and recorded in the table above before it is committed. |
| [Origin UI](https://github.com/origin-space/originui) | **Do not use.** AGPLv3 at the repository root, with only `apps/origin/` and `apps/ui/` under MIT. AGPL is incompatible with how this project is distributed. |

### Inspiration only, no code

[recent.design](https://recent.design) and [rebrand.gallery](https://rebrand.gallery)
are galleries of finished work. They inform direction and are cited in the design
documentation; no code or asset from either is used.

## Runtime dependencies

Package licences are declared in each `package.json` and resolved by npm; this
file does not duplicate them. It covers only source copied into the tree, which
npm cannot track.
