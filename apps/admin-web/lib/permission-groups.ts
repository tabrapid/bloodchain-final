/**
 * The heading a group of permissions is filed under, in the operator's
 * language.
 *
 * These used to render as `group.replace('_', ' ')` -- the raw prefix of a
 * database permission code, upper-cased by CSS into `BLOOD CENTER`, in English,
 * in all three languages.
 *
 * The set of prefixes is not closed: a permission added to the seed tomorrow
 * brings a prefix the catalogue has not met. A missing key resolves to itself
 * in this translator, so that case is detected and turned into a readable
 * sentence-cased phrase rather than being shown as `permissionGroups.foo` --
 * a raw key on screen reads as a bug to the operator and says nothing about
 * what the permissions underneath actually do.
 */
export function permissionGroupLabel(t: (key: string) => string, group: string): string {
  const key = `permissionGroups.${group}`;
  const label = t(key);
  if (label !== key) return label;

  const words = group.split(/[_.\s-]+/).filter(Boolean);
  if (words.length === 0) return group;

  const [first, ...rest] = words as [string, ...string[]];
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(' ');
}

/** The prefix a permission code is grouped by, e.g. `donor.read.self` -> `donor`. */
export function permissionGroup(code: string): string {
  return code.split('.')[0] ?? code;
}
