"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { ClientFormDialog } from "@/components/clients/client-form-dialog";
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback";
import { useClients } from "@/lib/hooks/use-clients";
import { cn } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface ClientComboboxProps {
  value: Client | null;
  onSelect: (client: Client) => void;
}

// Selector de cliente con búsqueda para "nueva factura". Si el usuario no
// encuentra el cliente, puede crearlo al vuelo desde la misma lista (abre
// ClientFormDialog en modo controlado, pre-cargado con lo que escribió en la
// búsqueda) y queda seleccionado automáticamente al crearse.
export function ClientCombobox({ value, onSelect }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const clients = useClients({ search, page: 1, pageSize: 20 });
  const debouncedSetSearch = useDebouncedCallback(setSearch, 300);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
            />
          }
        >
          <span className="flex items-center gap-2 truncate">
            <User className="size-4 shrink-0" />
            {value ? value.name : "Selecciona un cliente..."}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-(--anchor-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nombre o NIT..."
              onValueChange={debouncedSetSearch}
            />
            <CommandList>
              {clients.isLoading && (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Buscando...
                </div>
              )}
              {!clients.isLoading && <CommandEmpty>No se encontraron clientes.</CommandEmpty>}
              <CommandGroup>
                {(clients.data?.data ?? []).map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    onSelect={() => {
                      onSelect(client);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("size-4", value?.id === client.id ? "opacity-100" : "opacity-0")}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{client.name}</p>
                      {client.nit && (
                        <p className="text-xs text-muted-foreground">{client.nit}</p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="__crear_cliente__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  {search.trim() ? `Crear cliente "${search.trim()}"` : "Crear cliente nuevo"}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ClientFormDialog
        hideTrigger
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialName={search.trim()}
        onSuccess={(client) => onSelect(client)}
      />
    </>
  );
}
