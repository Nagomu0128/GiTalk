import type { z } from 'zod';

type ErrorBase = {
  readonly _tag: string;
  readonly message: string;
};

type ErrorWithExtra<Tag extends string, Extra> = ErrorBase & {
  readonly _tag: Tag;
  readonly extra: Extra;
};

type ErrorWithoutExtra<Tag extends string> = ErrorBase & {
  readonly _tag: Tag;
};

type InferErrorType<Tag extends string, Extra> = Extra extends undefined
  ? ErrorWithoutExtra<Tag>
  : ErrorWithExtra<Tag, Extra>;

export type InferError<T> = T extends ErrorBuilder<infer Tag, infer Extra>
  ? InferErrorType<Tag, Extra>
  : never;

type ErrorBuilder<Tag extends string, Extra = undefined> = {
  (message: string, options?: Extra extends undefined ? never : { extra: Extra }): InferErrorType<
    Tag,
    Extra
  >;
  readonly is: { readonly _tag: Tag };
  readonly handle: (e: unknown) => InferErrorType<Tag, Extra>;
};

export const errorBuilder = <Tag extends string, Extra = undefined>(
  tag: Tag,
  _schema?: z.ZodType<Extra>, // eslint-disable-line @typescript-eslint/no-unused-vars
): ErrorBuilder<Tag, Extra> => {
  const factory = (
    message: string,
    options?: Extra extends undefined ? never : { extra: Extra },
  ): InferErrorType<Tag, Extra> =>
    ({
      _tag: tag,
      message,
      ...(options && 'extra' in options ? { extra: options.extra } : {}),
    }) as InferErrorType<Tag, Extra>;

  factory.is = { _tag: tag } as const;

  factory.handle = (e: unknown): InferErrorType<Tag, Extra> =>
    factory(e instanceof Error ? e.message : String(e));

  return factory;
};
