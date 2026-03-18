export type Timestamp = string;

export type PaginationParams = {
  readonly cursor?: string;
  readonly limit: number;
};

export type PaginatedResponse<T> = {
  readonly data: ReadonlyArray<T>;
  readonly next_cursor: string | null;
  readonly has_more: boolean;
};

export type ApiErrorResponse = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
};
