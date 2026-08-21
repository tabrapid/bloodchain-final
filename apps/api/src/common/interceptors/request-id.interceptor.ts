import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const id = request.headers[REQUEST_ID_HEADER] ?? randomUUID();
    request['id'] = id;
    const response = context.switchToHttp().getResponse();
    response.setHeader?.(REQUEST_ID_HEADER, id);
    return next.handle();
  }
}
