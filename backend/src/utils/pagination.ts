export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function getPaginationArgs({ page, pageSize }: PaginationParams) {
  const safePage = page > 0 ? page : 1;
  const safePageSize = pageSize > 0 ? Math.min(pageSize, 100) : 20;
  return {
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
    page: safePage,
    pageSize: safePageSize
  };
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return { data, page, pageSize, total };
}
