# PlantPal+ — Requirements Traceability Matrix

| Field | Value |
| --- | --- |
| Document | `10-traceability-matrix.md` — requirements traceability matrix for the complete Phase 1 package |
| Version | 1.0 |
| Date | 2026-07-21 |
| Status | Baselined for Phase 1 sign-off |
| Owner | Rakshit — Project Lead and sole developer (D-05, `STK-03`) |
| Parent | [`SRS.md`](./SRS.md) — PlantPal+ Software Requirements Specification v1.0 |
| Identifiers minted here | **None.** This document mints no `FR`, `NFR`, `US`, `UC`, `BR`, `GOAL`, `RSK`, `ASM`, `CON`, `DEP` or `OQ` identifier. Every identifier below is owned by a child document and cited by number only. |
| Governing decisions | D-01 (IEEE 830 structure, ISO/IEC/IEEE 29148 quality rules), D-02 (MoSCoW plus target release on every requirement) |
| Derivation | Mechanically extracted from the 35 Markdown documents of `docs/requirements/` on 2026-07-21. Every cell is derived; none is authored by hand. |

---

## Table of contents

1. [Purpose, method and maintenance](#1-purpose-method-and-maintenance)
2. [Coverage summary dashboard](#2-coverage-summary-dashboard)
3. [Forward matrix — product goal to requirement](#3-forward-matrix--product-goal-to-requirement)
4. [Requirement to user story and use case](#4-requirement-to-user-story-and-use-case)
5. [Reverse matrix — user story to requirement](#5-reverse-matrix--user-story-to-requirement)
6. [Use case to requirement](#6-use-case-to-requirement)
7. [Requirement to release](#7-requirement-to-release)
8. [Requirement to verification method](#8-requirement-to-verification-method)
9. [Non-functional requirement to external standard](#9-non-functional-requirement-to-external-standard)
10. [Risk to mitigating requirement](#10-risk-to-mitigating-requirement)
11. [Gap analysis](#11-gap-analysis)
12. [Traceability integrity report](#12-traceability-integrity-report)

Related documents: [README](./README.md) · [SRS](./SRS.md) · [Stakeholders and personas](./01-stakeholders-and-personas.md) · [Scope and release plan](./02-scope-and-release-plan.md) · [Functional requirements](./03-functional-requirements.md) · [Non-functional requirements](./04-non-functional-requirements.md) · [User stories](./05-user-stories.md) · [Use-case model](./06-use-case-model.md) · [Domain model](./07-domain-model.md) · [Glossary](./08-glossary.md) · [Assumptions, constraints and risks](./09-assumptions-constraints-risks.md)

---

## 1. Purpose, method and maintenance

### 1.1 Purpose

ISO/IEC/IEEE 29148:2018 clause 5.2.8 requires that every requirement be traceable **upward** to the stakeholder need or product goal that justifies it and **downward** to the design and test artefacts that discharge it. This document is the single place where that bidirectional property is asserted, measured and — where it fails — reported as a defect rather than concealed.

It serves three readers with three different questions:

| Reader | Question | Section that answers it |
| --- | --- | --- |
| Academic evaluator | Is every requirement justified by a goal and covered by a story and a use case, and is the claim auditable? | [§2](#2-coverage-summary-dashboard), [§3](#3-forward-matrix--product-goal-to-requirement), [§11](#11-gap-analysis), [§12](#12-traceability-integrity-report) |
| Phase 3 engineer | If I change `FR-PLT-08`, what breaks, and which stories must I re-demonstrate? | [§4](#4-requirement-to-user-story-and-use-case), [§5](#5-reverse-matrix--user-story-to-requirement), [§6](#6-use-case-to-requirement) |
| Phase 4 tester | Which requirements land in this release, and by which method is each proven? | [§7](#7-requirement-to-release), [§8](#8-requirement-to-verification-method), [§9](#9-non-functional-requirement-to-external-standard) |

### 1.2 What this document is not

- It is **not normative**. The authoritative wording of every requirement lives in its owning document. Where this matrix and a source document disagree, the source document wins and the disagreement is a defect against this matrix.
- It **does not create coverage**. A link appears here only because a source document asserts it. Where no source document asserts a link, [§11](#11-gap-analysis) records the gap and names the document that must close it.
- It **does not renumber anything**. Identifiers are immutable by the rule stated in [`03-functional-requirements.md`](./03-functional-requirements.md) §1.2.

### 1.3 Extraction method

The matrix was produced by a mechanical extraction, not by transcription, so that the counts in [§2](#2-coverage-summary-dashboard) cannot drift from the rows in [§4](#4-requirement-to-user-story-and-use-case).

**Step 1 — enumerate.** Every `.md` file under `docs/requirements/` was scanned for the identifier shapes below. Matching used a left boundary of `(?<![A-Za-z0-9])` and a right boundary of `(?![0-9])`, which is load-bearing: without the left boundary every `NFR-SEC-nn` also matches as a spurious `FR-SEC-nn`, and the resulting matrix would report fifteen non-existent requirements.

| Class | Pattern | Owning document |
| --- | --- | --- |
| Functional requirement | `FR-[A-Z]{3}-[0-9]{2}` | `modules/*.md` |
| Business rule | `BR-[A-Z]{3}-[0-9]{2}` | `modules/*.md` |
| Non-functional requirement | `NFR-[A-Z0-9]{3,4}-[0-9]{2}` | `04-non-functional-requirements.md` |
| User story | `US-[A-Z]{3}-[0-9]{2}` | `user-stories/*.md` |
| Use case | `UC-[A-Z]{3}-[0-9]{2}` | `use-cases/*.md` |
| Product goal, success metric, stakeholder, persona | `GOAL-`, `MET-`, `STK-`, `PER-` + `[0-9]{2}` | `01-stakeholders-and-personas.md` |
| Assumption, constraint, dependency, risk, open question | `ASM-`, `CON-`, `DEP-`, `RSK-`, `OQ-` + `[0-9]{2}` | `09-assumptions-constraints-risks.md` |

**Step 2 — separate definition from reference.** An identifier is **defined** exactly where it heads its own subsection (`### FR-PLT-01 — Seeded species catalogue`) or, for the flat registers of documents 01 and 09, where it opens its own row in that register's table. Every other occurrence is a **reference**. The distinction is what makes [§12](#12-traceability-integrity-report) possible: an identifier that is referenced but never defined is a dangling pointer, and an identifier that is defined but never referenced is dead weight.

**Step 3 — read the declared links.** Three source shapes carry the links, and all three were read:

| Source | Field read | Direction it establishes |
| --- | --- | --- |
| `modules/*.md` §10 traceability stub table | `Goal`, `User stories`, `Use cases`, `Non-functional requirements` | `FR` → `GOAL`, `US`, `UC`, `NFR` |
| `modules/*.md` §4 per-requirement `Traces to` row | free text | corroborating `FR` → everything |
| `user-stories/*.md` story attribute table | `Related FRs`, `Related UCs`, `Persona`, `Priority`, `Release` | `US` → `FR`, `UC` |
| `use-cases/*.md` use-case attribute table | `Related FRs`, `Related USs`, `Primary actor`, `Priority`, `Release` | `UC` → `FR`, `US` |
| `04-non-functional-requirements.md` NFR attribute table | `Traces to`, `Priority`, `Release`, `Verification method` | `NFR` → `GOAL`, `STK`, `PER`, `RSK`, `CON` |
| `09-assumptions-constraints-risks.md` §4.2 and §4.5 | `Mitigation`, `Requirements that implement the mitigation` | `RSK` → `FR`, `NFR` |

**Step 4 — reconcile.** Each `FR` ↔ `US` and `FR` ↔ `UC` link was checked in both directions. Where only one side asserts it, the link is still shown — a one-sided assertion is real coverage — but the asymmetry is listed in [§12.4](#124-one-sided-links). This is how the `US-SET` reconciliation defect in [§11.3](#113-stories-a-requirement-never-names) was found.

### 1.4 Column conventions used throughout

| Convention | Meaning |
| --- | --- |
| `M` / `S` / `C` / `W` | MoSCoW priority: Must, Should, Could, Wont |
| `v0.1` / `v0.5` / `v1.0` / `v1.1` | Target release: Walking Skeleton, Alpha, MVP, Post-MVP |
| `v0.1/v0.5` | A requirement whose delivery is split across two gates, as declared by its owning document |
| `—` | No link is asserted by any source document. This is a real absence, not an omission from this matrix. |
| Ordering | Rows follow the canonical prefix order `ACC`, `DSH`, `SET`, `PLT`, `FIT`, `NUT`, `NOT`, `GAM`, `SYS`, then ascending ordinal |

### 1.5 How to maintain this matrix as requirements change

The matrix is derived, so it is never edited directly in response to a requirement change. Apply the change at its source and regenerate.

| Change | What to do at the source | Effect here |
| --- | --- | --- |
| **Add an `FR`** | Take the next contiguous ordinal in its prefix. Add its §4 entry with a complete `Traces to` row and add its row to the module's §10 stub, naming at least one `GOAL`, one `US`, one `UC` and one `NFR`. | New row in §4; counts in §2 increase; the release and verification tables in §7 and §8 gain an entry. |
| **Add a `US` or `UC`** | Declare `Related FRs` in the new story or use case, **and** add the new identifier to the `User stories` or `Use cases` cell of every `FR` it covers in the module §10 stub. Doing only the first half creates exactly the one-sided link recorded in [§12.4](#124-one-sided-links). | New row in §5 or §6; the corresponding §4 cells widen. |
| **Change a priority or release** | Edit the `Priority` or `Release` row of the requirement's own attribute table. That table is the single source; the module §10 stub and `03-functional-requirements.md` are copies. | §7 re-partitions; §2 priority counts shift. |
| **Change a verification method** | Edit the `Verification` row of the requirement's attribute table. | §8 re-partitions. Phase 4 consumes §8 directly, so an unregenerated §8 silently mis-scopes the test plan. |
| **Withdraw a requirement** | Set its priority to `Wont` and retain the identifier and its number. Never delete a row and never renumber siblings. `FR-FIT-18` is the worked example. | The row stays, priced at `W`, and remains traceable. |
| **Add a risk** | Add it to the `09` §4.2 register **and** give it a row in §4.5 naming the requirements that discharge it. Five risks currently have the first and not the second — see [§11.6](#116-risks-with-no-mitigation-trace-row). | New row in §10. |

**Regeneration trigger.** Regenerate whenever any of these is true: a requirement, story or use case is added, withdrawn or re-prioritised; a module §10 stub is edited; the risk register changes. Under `NFR-MAIN-07` a full reconciliation pass is a **v1.0 exit criterion**, and `RSK-12` — documentation and implementation drift — is the register entry that exists precisely because this document can rot silently.

**Integrity invariant to re-check after every regeneration.** Every one of these five statements must hold, and each is measured in [§2.2](#22-bidirectional-coverage):

1. Every `FR` names at least one `US`, one `UC` and one `NFR`.
2. Every `FR` names at least one `GOAL` **or** a stakeholder need justifying its existence.
3. Every `US` names at least one `FR`, and at least one `FR` names it back.
4. Every `UC` names at least one `FR`, and at least one `FR` names it back.
5. Every identifier referenced anywhere is defined somewhere.

Statements 2, 3 and 5 do not currently hold in full. The exceptions are enumerated in [§11](#11-gap-analysis) and [§12](#12-traceability-integrity-report) rather than smoothed over.

---

## 2. Coverage summary dashboard

All figures are counts over the 35 Markdown documents of `docs/requirements/` as of version 1.0, 2026-07-21.

### 2.1 Artefact inventory

| Artefact class | Prefix | Count | Owning documents |
| --- | --- | --- | --- |
| Functional requirements | `FR` | **228** | 8 module specifications |
| Non-functional requirements | `NFR` | **111** | `04-non-functional-requirements.md` |
| Business rules | `BR` | **268** | 8 module specifications |
| User stories | `US` | **119** | 8 story documents |
| Use cases | `UC` | **89** | 8 use-case documents |
| Product goals | `GOAL` | 12 | `01-stakeholders-and-personas.md` |
| Success metrics | `MET` | 24 | `01-stakeholders-and-personas.md` |
| Stakeholders | `STK` | 13 | `01-stakeholders-and-personas.md` |
| Personas | `PER` | 5 | `01-stakeholders-and-personas.md` |
| Assumptions | `ASM` | 28 | `09-assumptions-constraints-risks.md` |
| Constraints | `CON` | 28 | `09-assumptions-constraints-risks.md` |
| External dependencies | `DEP` | 17 | `09-assumptions-constraints-risks.md` |
| Risks | `RSK` | 20 | `09-assumptions-constraints-risks.md` |
| Open questions | `OQ` | 16 | `09-assumptions-constraints-risks.md` |
| Epics (local grouping labels) | `EPIC` | 51 | 8 story documents |
| — | **Total identifiers defined** | **1029** | — |
| — | Distinct identifiers referenced anywhere | 1068 | — |
| — | Total identifier occurrences | 23 856 | — |

### 2.2 Bidirectional coverage

The two headline figures demanded by the brief are the first two rows.

| Coverage claim | Covered | Population | Percentage | Verdict |
| --- | --- | --- | --- | --- |
| **`FR` covered by at least one user story** | 228 | 228 | **100.0 %** | Complete |
| **`FR` covered by at least one use case** | 228 | 228 | **100.0 %** | Complete |
| `FR` constrained by at least one `NFR` | 228 | 228 | 100.0 % | Complete |
| `FR` traced up to at least one `GOAL` | 224 | 228 | 98.2 % | 4 gaps — [§11.1](#111-requirements-with-no-product-goal) |
| `US` that declare at least one `FR` | 119 | 119 | 100.0 % | Complete |
| `US` that at least one `FR` names back | 114 | 119 | 95.8 % | 5 one-sided — [§11.3](#113-stories-a-requirement-never-names) |
| `UC` that declare at least one `FR` | 89 | 89 | 100.0 % | Complete |
| `UC` that at least one `FR` names back | 89 | 89 | 100.0 % | Complete |
| `NFR` cited by at least one `FR` | 94 | 111 | 84.7 % | 17 process-level — [§11.4](#114-non-functional-requirements-no-requirement-cites) |
| `BR` referenced at least once beyond its own definition | 268 | 268 | 100.0 % | Complete |
| `RSK` with at least one named mitigating requirement | 16 | 20 | 80.0 % | 4 process-mitigated — [§11.5](#115-risks-with-no-mitigating-requirement) |

### 2.3 Orphan counts, both directions

| Direction | Orphan definition | Count | Detail |
| --- | --- | --- | --- |
| Downward | `FR` with no covering `US` | **0** | — |
| Downward | `FR` with no covering `UC` | **0** | — |
| Downward | `FR` with no constraining `NFR` | **0** | — |
| Upward | `FR` with no `GOAL` | **4** | [§11.1](#111-requirements-with-no-product-goal) |
| Upward | `US` that declares no `FR` | **0** | — |
| Upward | `UC` that declares no `FR` | **0** | — |
| Reciprocity | `US` no `FR` names back | **5** | [§11.3](#113-stories-a-requirement-never-names) |
| Reciprocity | `UC` no `FR` names back | **0** | — |
| Reciprocity | `NFR` no `FR` cites | **17** | [§11.4](#114-non-functional-requirements-no-requirement-cites) |
| Integrity | Identifier referenced but never defined | **39** | [§12.2](#122-referenced-but-never-defined) |
| Integrity | Identifier defined but never referenced elsewhere | **41** | [§12.3](#123-defined-but-never-referenced-outside-its-own-document) |

### 2.4 Trace-link density

A count of links, not of artefacts. 1431 requirement-level trace links were extracted.

| Relation | Links | Mean per source | Interpretation |
| --- | --- | --- | --- |
| `FR` → `GOAL` | 272 | 1.19 | Most requirements serve exactly one goal; concentration is intentional |
| `FR` → `US` | 274 | 1.20 | Requirements are story-sized, not epic-sized |
| `FR` → `UC` | 263 | 1.15 | Requirements map near one-to-one onto system interactions |
| `FR` → `NFR` | 622 | 2.73 | Every requirement is quality-constrained on at least two axes |
| `US` → `FR` | 276 | 2.32 | A story typically needs two or three requirements to be demonstrable |
| `UC` → `FR` | 381 | 4.28 | A use case is a larger unit than a story, as expected |

### 2.5 Priority and release distribution

| Class | Must | Should | Could | Wont | Total |
| --- | --- | --- | --- | --- | --- |
| `FR` | 162 | 61 | 4 | 1 | 228 |
| `NFR` | 105 | 6 | 0 | 0 | 111 |
| `UC` | 73 | 16 | 0 | 0 | 89 |

The single `Wont` is `FR-FIT-18` — health-platform synchronisation, retained as a documented exclusion. The four `Could` requirements are `FR-SET-22`, `FR-PLT-04`, `FR-PLT-22` and `FR-NUT-12`.

| Release | `FR` | `NFR` | Demoable slice this gate leaves |
| --- | --- | --- | --- |
| `v0.1` Walking Skeleton | 18 | 5 | Register, log in, one reminder tick end to end |
| `v0.5` Alpha | 85 | 29 | All three logging loops with server-side schedules and streaks |
| `v1.0` MVP | 114 | 77 | The full product under D-02 |
| `v1.1` Post-MVP | 12 | 0 | OAuth, Web Push, comfort features |
| **Total** | **229** | **111** | One requirement, `FR-NOT-02`, is counted in two gates because its delivery is declared as split |

### 2.6 Verification-method distribution

`NFR-MAIN-03` and the Phase 4 test plan consume [§8](#8-requirement-to-verification-method) directly. Two observations an evaluator should expect to be justified are recorded in [§11.7](#117-verification-method-imbalance).

| Method | `FR` | `NFR` | Total |
| --- | --- | --- | --- |
| Test | 191 | 83 | 274 |
| Demonstration | 30 | 4 | 34 |
| Inspection | 11 | 22 | 33 |
| Analysis | **0** | 2 | 2 |

Four requirements declare two methods and are therefore counted in two rows: `FR-ACC-23`, `FR-GAM-10`, `FR-GAM-16` and `FR-GAM-17`.

---

## 3. Forward matrix — product goal to requirement

This is the upward half of bidirectional traceability: it proves that no goal is decorative and no requirement is unjustified. Links are those declared by the `Goal` column of each module §10 stub and the `Traces to` row of each `NFR`.

### 3.1 Goal to requirement, counts by subsystem

<!-- INSERT:s3_goal_compact.md -->

Reading the table: `GOAL-04` — one global cross-module streak — is the most broadly realised goal at 58 requirements, concentrated in `NOT` and `GAM` as expected. `GOAL-03` — species-and-season-aware watering — is the most tightly localised at 22 requirements, 19 of them in `PLT`, which is the correct shape for a single-module differentiator. `GOAL-07`, `GOAL-10`, `GOAL-11` and `GOAL-12` each attract only four functional requirements because they are quality and process commitments discharged mainly by non-functional requirements; §3.2 shows they are not under-covered, merely covered on the other axis.

### 3.2 Goal to requirement, full identifier lists

<!-- INSERT:s3_goal.md -->

### 3.3 Balance check

| Goal | Nature | `FR` | `NFR` | Balanced? |
| --- | --- | --- | --- | --- |
| `GOAL-01` to `GOAL-06` | Product capability | 216 | 23 | Yes — capability goals are carried by functional requirements |
| `GOAL-07` | Accessibility | 4 | 11 | Yes — carried by the `A11Y` category, exactly as intended |
| `GOAL-08` | Data rights | 16 | 9 | Yes — `ACC` and `SET` requirements plus the `PRIV` and `LEGL` categories |
| `GOAL-09` | Zero recurring cost | 24 | 7 | Yes — `SYS` integration policy plus the `SCAL` and `PORT` ceilings |
| `GOAL-10` to `GOAL-12` | Process and evidence | 12 | 17 | Yes — carried by `MAIN`, `OBSV` and `DATA` |

No goal has zero functional and zero non-functional coverage. Every goal in `GOAL-01` … `GOAL-12` is realised.

---

## 4. Requirement to user story and use case

The core matrix demanded by the brief: **one row per functional requirement, all 228 present, no gaps**. The `Covering user stories` and `Covering use cases` columns reproduce the `User stories` and `Use cases` cells of the owning module's §10 stub; the `Constraining NFRs` column reproduces its `Non-functional requirements` cell. Where a story or use case asserts a link that the module stub does not, the extra link is **not** silently merged into this table — it is reported as a one-sided link in [§12.4](#124-one-sided-links), so that this section remains a faithful reproduction of what the owning module commits to.

<!-- INSERT:s4_fr.md -->

<!-- CONTINUE-1 -->
