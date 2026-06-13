import { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

describe('OptionalJwtAuthGuard', () => {
  const createContext = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          headers: authorization ? { authorization } : {},
        }),
      }),
    }) as ExecutionContext;

  it('allows requests without an authorization header', () => {
    const guard = new OptionalJwtAuthGuard();

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('uses the JWT strategy when an authorization header is supplied', () => {
    const parentPrototype = Object.getPrototypeOf(
      OptionalJwtAuthGuard.prototype,
    ) as { canActivate: (context: ExecutionContext) => boolean };
    const jwtValidation = jest
      .spyOn(parentPrototype, 'canActivate')
      .mockReturnValue(true);
    const context = createContext('Bearer access-token');
    const guard = new OptionalJwtAuthGuard();

    expect(guard.canActivate(context)).toBe(true);
    expect(jwtValidation).toHaveBeenCalledWith(context);

    jwtValidation.mockRestore();
  });
});
