import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Column {
  label: string;
  className?: string;
}

interface TableHeaderRowProps {
  columns: Column[];
}

// Encabezado genérico de las tablas de datos (productos, clientes, facturas,
// usuarios): todas arman el mismo <TableHeader><TableRow>...</TableRow>
// </TableHeader>, solo cambian las etiquetas y alineaciones de columna.
export function TableHeaderRow({ columns }: TableHeaderRowProps) {
  return (
    <TableHeader>
      <TableRow>
        {columns.map((column) => (
          <TableHead key={column.label} className={column.className}>
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
