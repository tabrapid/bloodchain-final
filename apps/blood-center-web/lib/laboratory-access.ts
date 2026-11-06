/** Mirrors the current endpoint role lists; server membership checks remain authoritative. */
const writers = new Set([
  'BLOOD_CENTER_ADMIN',
  'BLOOD_CENTER_STAFF',
  'HOSPITAL_ADMIN',
  'HOSPITAL_STAFF',
  'LAB_TECHNICIAN',
  'LAB_ADMIN',
]);
const validators = new Set([
  'BLOOD_CENTER_ADMIN',
  'BLOOD_CENTER_STAFF',
  'HOSPITAL_ADMIN',
  'HOSPITAL_STAFF',
  'LAB_REVIEWER',
  'LAB_ADMIN',
]);
export function laboratoryAccess(role: string) {
  return {
    enter: writers.has(role),
    manage: writers.has(role),
    review: validators.has(role),
    publish: validators.has(role),
  };
}
