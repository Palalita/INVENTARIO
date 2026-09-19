// Helpers de paginación compartidos por los módulos que listan colecciones
// (productos, clientes, usuarios, etc.), para no repetir la misma lógica de
// skip/take y de forma de respuesta en cada *.service.ts.
export interface PaginationParams {
  page: number;
  pageSize: number;
}

// Traduce page/pageSize (como los manda el frontend) a skip/take (como los
// espera Prisma), con límites de seguridad: pageSize se capa a 100 como
// máximo (para que nadie pida "toda la tabla" de un golpe) y a 20 por
// defecto si viene inválido; page nunca baja de 1.
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

// Forma estándar de respuesta paginada que devuelven todos los endpoints de
// listado: los datos de la página actual más los metadatos para que el
// frontend arme los controles de paginación (página actual, tamaño, total
// de registros).
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
) {
  return { data, page, pageSize, total };
}
