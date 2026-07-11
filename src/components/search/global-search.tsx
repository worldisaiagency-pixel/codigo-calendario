"use client";

import { PawPrint } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAppStore } from "@/lib/store";
import type { Dog } from "@/lib/types";

export function GlobalSearch({
  open,
  onOpenChange,
  onPickDog,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickDog: (dog: Dog) => void;
}) {
  const dogs = useAppStore((s) => s.dogs);
  const owners = useAppStore((s) => s.owners);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buscar"
      description="Busca por perro o por dueño"
    >
      <Command shouldFilter>
        <CommandInput
          placeholder="Nombre del perro o del dueño…"
          className="text-[16px]!"
        />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          <CommandGroup heading="Clientes">
            {dogs.map((dog) => {
              const owner = owners.find((o) => o.id === dog.ownerId);
              return (
                <CommandItem
                  key={dog.id}
                  value={`${dog.name} ${owner?.name ?? ""} ${dog.breed}`}
                  onSelect={() => {
                    onPickDog(dog);
                    onOpenChange(false);
                  }}
                  className="gap-3 rounded-xl py-2.5"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-slot-next-tint text-slot-next shrink-0">
                    <PawPrint className="size-[15px]" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium truncate">
                      {dog.name}{" "}
                      <span className="text-muted-foreground font-normal">
                        · {dog.breed}
                      </span>
                    </span>
                    <span className="block text-[12px] text-muted-foreground truncate">
                      {owner?.name}
                    </span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
