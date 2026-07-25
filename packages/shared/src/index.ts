/**
 * @plantpal/shared — the single home for domain logic used by the backend, the
 * website and the mobile app.
 *
 * NFR-MAIN-03 requires that a business rule exists in exactly one place. If a
 * calculation appears in an app package instead of here, that is a defect: the
 * three clients would be free to drift, and BR-PLT-08 clause 2 explicitly
 * requires bit-for-bit agreement between them.
 */

export * from './domain/enums.js'
export * from './domain/rounding.js'
export * from './domain/season.js'
export * from './domain/watering.js'
export * from './domain/nutrition.js'
export * from './domain/fitness.js'
export * from './domain/streak.js'
