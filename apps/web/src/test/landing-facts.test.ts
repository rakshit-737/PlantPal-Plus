/**
 * The landing page makes factual claims about this repository — how many
 * species are seeded, how many requirements exist, how many tests pass. Those
 * numbers are the page's entire argument, so they are checked against their
 * sources here rather than trusted to stay true.
 *
 * A marketing page that overstates its own test count is worse than one with
 * no numbers on it, and the failure mode is silent: the code keeps working
 * while the claim quietly rots.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { FACTS } from '../pages/LandingPage'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.join(here, '..', '..', '..', '..')

const read = (...p: string[]) => fs.readFileSync(path.join(repo, ...p), 'utf8')

/** Rows in a seed file's VALUES list — one per catalogue entry. */
function seedRows(file: string): number {
  const sql = read('apps', 'api', 'src', 'db', 'seeds', file)
  return (sql.match(/^\s*\(/gm) ?? []).length
}

describe('landing page facts', () => {
  it('counts the seeded plant species', () => {
    // Two files: the generic starter set plus the India catalogue.
    const total = seedRows('001-species.sql') + seedRows('004-species-india.sql')
    expect(FACTS.species).toBe(total)
  })

  it('counts the seeded foods', () => {
    expect(FACTS.foods).toBe(seedRows('005-foods-india.sql'))
  })

  it('counts the seeded exercises', () => {
    expect(FACTS.exercises).toBe(seedRows('002-exercises.sql'))
  })

  it('matches the functional requirement count the README publishes', () => {
    const row = read('README.md').match(/\|\s*Functional requirements\s*\|\s*(\d+)\s*\|/)
    expect(row?.[1], 'README no longer publishes a functional requirement count').toBeDefined()
    expect(FACTS.requirements).toBe(Number(row![1]))
  })

  it('matches the user story count the README publishes', () => {
    const row = read('README.md').match(/\|\s*User stories with Gherkin criteria\s*\|\s*(\d+)\s*\|/)
    expect(row?.[1], 'README no longer publishes a user story count').toBeDefined()
    expect(FACTS.userStories).toBe(Number(row![1]))
  })

  it('matches the non-functional requirement count the README publishes', () => {
    const row = read('README.md').match(/\|\s*Non-functional requirements\s*\|\s*(\d+)/)
    expect(row?.[1], 'README no longer publishes a non-functional count').toBeDefined()
    expect(FACTS.nonFunctional).toBe(Number(row![1]))
  })

  it('claims no figure the page cannot support', () => {
    // Guards the shape of the contract as much as the values: every key in
    // FACTS must be covered by a check above. A number added here without a
    // source is exactly the drift this file exists to prevent.
    expect(Object.keys(FACTS).sort()).toEqual(
      ['exercises', 'foods', 'nonFunctional', 'requirements', 'species', 'userStories'].sort(),
    )
  })
})
