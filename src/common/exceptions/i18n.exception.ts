import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { I18nArgs, I18nPath } from "@/generated/i18n.generated";

export interface I18nExceptionPayload<K extends I18nPath = I18nPath> {
  message: K;
  args?: I18nArgs<K>;
  code?: string;
}

export type I18nKeyOrPayload<K extends I18nPath = I18nPath> =
  K | I18nExceptionPayload<K>;

function normalizePayload<K extends I18nPath>(
  keyOrPayload: I18nKeyOrPayload<K>,
  args?: I18nArgs<K>,
  code?: string,
): { message: string; args?: Record<string, unknown>; code?: string } {
  if (typeof keyOrPayload === "string") {
    return {
      message: keyOrPayload,
      ...(args ? { args: args } : {}),
      ...(code ? { code } : {}),
    };
  }
  return {
    message: keyOrPayload.message,
    ...(keyOrPayload.args ? { args: keyOrPayload.args } : {}),
    ...(keyOrPayload.code ? { code: keyOrPayload.code } : {}),
  };
}

export class I18nBadRequestException<
  K extends I18nPath = I18nPath,
> extends BadRequestException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}

export class I18nNotFoundException<
  K extends I18nPath = I18nPath,
> extends NotFoundException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}

export class I18nConflictException<
  K extends I18nPath = I18nPath,
> extends ConflictException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}

export class I18nForbiddenException<
  K extends I18nPath = I18nPath,
> extends ForbiddenException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}

export class I18nUnauthorizedException<
  K extends I18nPath = I18nPath,
> extends UnauthorizedException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}

export class I18nUnprocessableEntityException<
  K extends I18nPath = I18nPath,
> extends UnprocessableEntityException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}

export class I18nGoneException<
  K extends I18nPath = I18nPath,
> extends GoneException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}

export class I18nInternalServerErrorException<
  K extends I18nPath = I18nPath,
> extends InternalServerErrorException {
  constructor(payload: I18nExceptionPayload<K>);
  constructor(key: K, args?: I18nArgs<K>, code?: string);
  constructor(
    keyOrPayload: I18nKeyOrPayload<K>,
    args?: I18nArgs<K>,
    code?: string,
  ) {
    super(normalizePayload(keyOrPayload, args, code));
  }
}
