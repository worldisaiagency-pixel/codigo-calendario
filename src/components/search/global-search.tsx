"use client";

import { useMemo, useState } from "react";
import { Archive, PawPrint } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { isDogSearchable } from "@/lib/clients";
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
  const appointments = useAppStore((s) => s.appointments);
  const archiveClient = useAppStore((s) => s.archiveClient);

  const [pendingArchive, setPendingArchive] = useState<Dog | null>(null);

  // Fichas manually hidden, or with no appointment (past or future) in the
  // last two months, drop out of search — the dog/owner rows and every
  // appointment stay untouched, so calendar history is unaffected. See
  // src/lib/clients.ts.
  const searchableDogs = useMemo(
    () => dogs.filter((dog) => isDogSearchable(dog, appointments)),
    [dogs, appointments]
  );

  function handleConfirmArchive() {
    if (!pendingArchive) return;
    archiveClient(pendingArchive.id);
    setPendingArchive(null);
  }

  return (
    <>
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
              {searchableDogs.map((dog) => {
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
                    <span className="min-w-0 flex-1">
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
                    <button
                      type="button"
                      aria-label={`Archivar la ficha de ${dog.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setPendingArchive(dog);
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors duration-150 hover:bg-destructive/20 active:scale-[0.92]"
                    >
                      <Archive className="size-[13px]" strokeWidth={2} />
                    </button>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>

      <Dialog open={pendingArchive !== null} onOpenChange={(o) => !o && setPendingArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Archivar la ficha de este cliente?</DialogTitle>
            <DialogDescription>
              Esta acción archivará la ficha de {pendingArchive?.name} y su mascota del listado de
              búsqueda. No eliminará las citas históricas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingArchive(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmArchive}>
              Archivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
