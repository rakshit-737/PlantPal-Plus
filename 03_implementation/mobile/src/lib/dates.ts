/**
 * Date helpers shared across screens. The API's daily-log contracts key on the
 * user's local calendar day (BR-SYS local_date_str), never UTC.
 */

/** Today as YYYY-MM-DD in the device's local timezone. */
export function localDateStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
