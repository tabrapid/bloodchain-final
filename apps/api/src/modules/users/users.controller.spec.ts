import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RoleCode } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Regression test for `GET /users/:id`.
 *
 * The route had no `@Roles` (or any ownership check) at all: any
 * authenticated user -- a donor, a courier, anyone with a valid access
 * token -- could fetch any other user's full profile by ID, including
 * email, phone, and date of birth, which `UsersService.findById` selects
 * with no filtering. No client in the repo actually calls this route (the
 * web apps use the separately-guarded `/admin/users/:id`), so nothing
 * depended on the open access; it was simply missed when every sibling
 * `:id` lookup in this codebase (appointments, donations) enforces either
 * a role or an ownership check. This test drives the real `RolesGuard`
 * against the controller's real metadata, the same way Nest evaluates it
 * at request time, so a future removal of the decorator fails a test
 * instead of shipping silently.
 */
function buildContext(handler: (...args: never[]) => unknown, roles: RoleCode[] | undefined) {
  return {
    getHandler: () => handler,
    getClass: () => UsersController,
    switchToHttp: () => ({
      getRequest: () => ({ user: roles ? { sub: 'user-1', roles } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('UsersController#findOne (GET /users/:id)', () => {
  let guard: RolesGuard;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: {} },
        RolesGuard,
        Reflector,
      ],
    }).compile();

    guard = moduleRef.get(RolesGuard);
  });

  it('rejects a plain donor', () => {
    const controller = new UsersController({} as UsersService);
    const context = buildContext(controller.findOne, [RoleCode.DONOR]);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('rejects a courier', () => {
    const controller = new UsersController({} as UsersService);
    const context = buildContext(controller.findOne, [RoleCode.COURIER]);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows a SUPER_ADMIN', () => {
    const controller = new UsersController({} as UsersService);
    const context = buildContext(controller.findOne, [RoleCode.SUPER_ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a HOSPITAL_ADMIN', () => {
    const controller = new UsersController({} as UsersService);
    const context = buildContext(controller.findOne, [RoleCode.HOSPITAL_ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a BLOOD_CENTER_ADMIN', () => {
    const controller = new UsersController({} as UsersService);
    const context = buildContext(controller.findOne, [RoleCode.BLOOD_CENTER_ADMIN]);
    expect(guard.canActivate(context)).toBe(true);
  });
});
