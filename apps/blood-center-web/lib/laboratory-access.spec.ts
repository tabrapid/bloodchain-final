import { describe, expect, it } from 'vitest';
import { laboratoryAccess } from './laboratory-access';
describe('laboratory endpoint roles', () => {
  it('separates entry from validation for dedicated laboratory roles', () => {
    expect(laboratoryAccess('LAB_TECHNICIAN')).toEqual({
      manage: true,
      enter: true,
      review: false,
      publish: false,
    });
    expect(laboratoryAccess('LAB_REVIEWER')).toEqual({
      manage: false,
      enter: false,
      review: true,
      publish: true,
    });
  });
  it('does not infer permissions from an unrelated or unknown role', () => {
    expect(laboratoryAccess('COURIER')).toEqual({
      manage: false,
      enter: false,
      review: false,
      publish: false,
    });
    expect(laboratoryAccess('')).toEqual({
      manage: false,
      enter: false,
      review: false,
      publish: false,
    });
  });
});
