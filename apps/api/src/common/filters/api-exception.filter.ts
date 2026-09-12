import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ExceptionBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

function classifyErrorCode(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return 'REQUEST_FAILED';
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'An unexpected error occurred.';
    let details: unknown;
    let domainCode: string | undefined;

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else {
        const typed = body as { message?: string | string[]; details?: unknown; code?: string };
        message = typed.message ?? message;
        details = typed.details;
        // An explicit code from the thrower wins over classification by status.
        // Several distinct refusals share one status -- a donation booking can
        // be refused because the slot is taken or because the donor is inside
        // their recovery window, and both are 409 -- so a client that needs to
        // tell them apart otherwise has to match on prose.
        domainCode = typed.code;
      }
    }

    const finalMessage = Array.isArray(message) ? message.join('; ') : message;

    const body: ExceptionBody = {
      statusCode: status,
      code: domainCode ?? classifyErrorCode(status),
      message: finalMessage,
    };

    const isProduction = process.env.NODE_ENV === 'production';
    if (!isProduction && !(exception instanceof HttpException)) {
      body.details = String(exception);
    } else if (details) {
      body.details = details;
    }

    this.logger.warn({
      requestId: request['id'],
      statusCode: status,
      path: request.url,
      method: request.method,
      errorCode: body.code,
      message: finalMessage,
    });

    response.status(status).json(body);
  }
}
