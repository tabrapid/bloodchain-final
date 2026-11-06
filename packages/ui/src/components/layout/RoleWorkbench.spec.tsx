import { describe, expect, it } from 'vitest';
import { getWorkArea } from './RoleWorkbench';
describe('institution work areas',()=>{
  it('offers institution management only to the existing administrator role',()=>{
    expect(getWorkArea('HOSPITAL_ADMIN','hospital').tasks.some(([,href])=>href==='/organization')).toBe(true);
    expect(getWorkArea('HOSPITAL_STAFF','hospital').tasks.some(([,href])=>href==='/organization')).toBe(false);
  });
  it('takes laboratory reviewers to the entered-result queue',()=>{
    expect(getWorkArea('LAB_REVIEWER','center').tasks).toEqual([['laboratory','/laboratory?result=ENTERED']]);
    expect(getWorkArea('UNKNOWN','center').tasks).toEqual([]);
  });
});
