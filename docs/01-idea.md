# Idea Refine — Sistema de Inventario y Facturación

## Problema
Un negocio necesita controlar su inventario (productos, stock, movimientos) y emitir
facturas a clientes de forma rápida, confiable y auditable, con una interfaz moderna
y un backend seguro y escalable.

## Usuarios objetivo
- **Admin**: gestiona usuarios, productos, categorías, ve reportes globales.
- **Vendedor**: consulta productos, gestiona clientes, emite facturas.

## Objetivos del MVP
1. Control de inventario con historial de movimientos (entradas/salidas/ajustes).
2. Facturación electrónica interna: crear factura, descontar stock automáticamente,
   generar PDF, anular facturas.
3. Gestión de clientes y catálogo de productos por categoría.
4. Dashboard con KPIs (ventas, stock bajo, productos más vendidos).
5. Seguridad de nivel producción (auth con roles, rate limiting, validación estricta).

## Fuera de alcance (v1)
- Facturación electrónica ante entidad tributaria (integración SAT/DIAN/etc.).
- Multi-sucursal / multi-moneda.
- Pagos en línea.
- App móvil nativa.

## Criterios de éxito
- Un vendedor puede crear una factura completa en menos de 1 minuto.
- El stock se refleja correctamente tras cada venta o ajuste, sin condiciones de carrera.
- Cero secretos ni credenciales en el repo; todo por variables de entorno.
- Cobertura de pruebas en flujos críticos: auth, creación de factura, control de stock.
