// Fechas relativas al negocio (Guatemala, UTC-6, sin horario de verano),
// no al reloj del servidor. Railway corre los contenedores en UTC, así que
// "hoy"/"este mes"/un filtro de fecha calculado con la hora local del
// proceso corta mal las ventas hechas de 6pm a medianoche hora de
// Guatemala. Ver el razonamiento completo, con ejemplos, en el historial de
// dashboard.service.ts (donde se detectó este bug por primera vez) —
// invoices.service.ts usa el mismo helper para no repetir la lógica ni
// arriesgarse a que las dos copias diverjan.
import { z } from "zod";

const BUSINESS_UTC_OFFSET_MS = -6 * 60 * 60 * 1000;

// Convierte una fecha cuyos CAMPOS UTC representan una hora de pared en
// Guatemala (ej. Date.UTC(2026,0,1) = "1 de enero, medianoche, hora de
// Guatemala") al instante UTC real que le corresponde.
function fromBusinessLocalFields(utcFieldsAsBusinessLocal: Date): Date {
  return new Date(utcFieldsAsBusinessLocal.getTime() - BUSINESS_UTC_OFFSET_MS);
}

export function startOfBusinessToday(): Date {
  const shifted = new Date(Date.now() + BUSINESS_UTC_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return fromBusinessLocalFields(shifted);
}

export function startOfBusinessMonth(): Date {
  const shifted = new Date(Date.now() + BUSINESS_UTC_OFFSET_MS);
  return fromBusinessLocalFields(new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1)));
}

// Convierte una fecha de calendario "YYYY-MM-DD" (tal como la ve el usuario
// en Guatemala) a su medianoche real en UTC. `addDays` sirve para construir
// un límite superior exclusivo al día siguiente (`lt`, no `lte`) e incluir
// así el día completo sin tener que calcular las 23:59:59.999 exactas.
export function startOfBusinessLocalDay(dateStr: string, addDays = 0): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return fromBusinessLocalFields(new Date(Date.UTC(year, month - 1, day + addDays)));
}

// Valida el formato "YYYY-MM-DD" antes de que llegue a startOfBusinessLocalDay:
// sin esto, un valor no numérico (`?from=abc`) produce NaN y termina en un
// 500 genérico de Postgres en vez de un 400 de validación claro.
export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Debe tener el formato YYYY-MM-DD");

// Formatea un instante como fecha/hora de pared en Guatemala, para mostrarla
// a un humano (PDF de factura, CSV de reporte de ventas) — a diferencia de
// las funciones de arriba, que solo sirven para construir límites de
// filtrado. Usa la zona IANA (Guatemala no observa horario de verano, así
// que equivale al offset fijo usado arriba) en vez de aritmética manual
// porque aquí sí hace falta el formato localizado (dd/mm/aaaa, 24h), no solo
// el instante UTC correspondiente.
const businessDateTimeFormatter = new Intl.DateTimeFormat("es-GT", {
  timeZone: "America/Guatemala",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

export function formatBusinessDateTime(date: Date): string {
  return businessDateTimeFormatter.format(date);
}
