"use client";

import { useState } from "react";
import { ChevronsUpDown, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useDebouncedCallback } from "@/lib/hooks/use-debounced-callback";
import { useProducts } from "@/lib/hooks/use-products";
import { formatCurrency } from "@/lib/invoice-calculations";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface ProductAutocompleteProps {
  onSelect: (product: Product) => void;
  excludeIds?: string[];
}

export function ProductAutocomplete({ onSelect, excludeIds = [] }: ProductAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const products = useProducts({ search, page: 1, pageSize: 20 });

  const debouncedSetSearch = useDebouncedCallback(setSearch, 300);

  const options = (products.data?.data ?? []).filter(
    (product) => product.active && !excludeIds.includes(product.id)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal text-muted-foreground"
          />
        }
      >
        <span className="flex items-center gap-2">
          <Search className="size-4" />
          Buscar producto por nombre o SKU...
        </span>
        <ChevronsUpDown className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Escribe para buscar..."
            onValueChange={debouncedSetSearch}
          />
          <CommandList>
            {products.isLoading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Buscando...
              </div>
            )}
            {!products.isLoading && (
              <CommandEmpty>No se encontraron productos.</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => {
                    onSelect(product);
                    setOpen(false);
                  }}
                  disabled={product.stock <= 0}
                  className={cn(product.stock <= 0 && "opacity-50")}
                >
                  <div className="flex flex-1 items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku} · stock: {product.stock}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(product.price)}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
