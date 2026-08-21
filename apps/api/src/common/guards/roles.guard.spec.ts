import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleCode } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

function createContext(roles: RoleCode[]): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles } }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(guard.canActivate(createContext([RoleCode.DONOR]))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [{}, {}]);
  });

  it('allows access when user has one of the required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([RoleCode.HOSPITAL_ADMIN, RoleCode.SUPER_ADMIN]);
    expect(guard.canActivate(createContext([RoleCode.SUPER_ADMIN]))).toBe(true);
  });

  it('denies access when user lacks the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RoleCode.SUPER_ADMIN]);
    expect(guard.canActivate(createContext([RoleCode.DONOR]))).toBe(false);
  });
});
