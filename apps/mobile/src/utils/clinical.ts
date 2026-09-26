/**
 * One way to write a measurement.
 *
 * The Health screen printed five different formats in a single card:
 *
 *   250000 cells/mcL      no separator, unreadable at a glance
 *   5.1 million cells/mcL a magnitude spelled out in words
 *   7500 cells/mcL        no separator again
 *   14.2 g/dL             fine
 *   42 %                  a space before a percent sign
 *
 * None of those is wrong in isolation. Together they say nobody was looking,
 * and on a screen whose whole job is to report clinical results that is the
 * fastest way to lose a reader's trust in the numbers themselves. A lab report
 * that cannot punctuate consistently invites the question of what else it is
 * careless about.
 *
 * So there is one function, and every value goes through it.
 */

/**
 * Units that close up against the number, the way they are written everywhere
 * else. `42%`, not `42 %`. Degrees and the percent sign are the whole list --
 * every clinical unit takes a space.
 */
const TIGHT_UNITS = new Set(['%', '°', '°C', '°F']);

/** Below this a number reads fine unseparated; above it, it does not. */
const SEPARATOR_THRESHOLD = 10000;

/**
 * Groups thousands with a narrow no-break space.
 *
 * Not a comma and not a period: both are decimal separators somewhere, and this
 * app ships in three languages. U+202F is the separator the SI recommends for
 * exactly this reason, and it does not break across a line.
 */
/** U+202F NARROW NO-BREAK SPACE, the SI thousands separator. */
const THIN = '\u202f';

/** U+00A0 NO-BREAK SPACE, so a value never wraps away from its unit. */
const NBSP = '\u00a0';

function groupThousands(value: number): string {
  const [whole = '', fraction] = Math.abs(value).toString().split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  const sign = value < 0 ? '-' : '';
  return fraction ? `${sign}${grouped}.${fraction}` : `${sign}${grouped}`;
}

/**
 * A measurement, formatted.
 *
 * `undefined` in, em-dash out — a missing result is shown as missing rather
 * than as zero, which is a different clinical claim entirely.
 */
export function formatClinicalValue(
  value: number | string | undefined | null,
  unit?: string | null,
): string {
  if (value === undefined || value === null || value === '') return '—';

  const numeric = typeof value === 'number' ? value : Number(value);
  const body = Number.isFinite(numeric)
    ? Math.abs(numeric) >= SEPARATOR_THRESHOLD
      ? groupThousands(numeric)
      : String(numeric)
    : String(value);

  const trimmed = unit?.trim();
  if (!trimmed) return body;

  return TIGHT_UNITS.has(trimmed) ? `${body}${trimmed}` : `${body}${NBSP}${trimmed}`;
}
