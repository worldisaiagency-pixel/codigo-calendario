"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2Icon, PawPrint } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { TimeGridPicker } from "./time-grid-picker";
import { ServicePicker } from "./service-picker";
import { cn } from "@/lib/utils";
import { durationLabel, formatDayHeading, minToLabel, parseDateKey } from "@/lib/time";
import { useAppStore } from "@/lib/store";
import type { BusinessService } from "@/lib/data";
import type { Dog } from "@/lib/types";
import { NotifyClientsSheet, type NotifyRecipient } from "@/components/business/notify-clients-sheet";
import { toast } from "sonner";

export interface SlotContext {
  date: string;
  startMin: number;
  maxDurationMin: number;
  preferredStartMin?: number;
  presetService?: string;
}

const TIME_STEP = 30;
const FALLBACK_MIN_DURATION = 30;

type ActiveField = "owner" | "dog" | null;

export function NewAppointmentSheet({
  slot,
  services,
  onOpenChange,
}: {
  slot: SlotContext | null;
  services: BusinessService[];
  onOpenChange: (open: boolean) => void;
}) {
  const serviceDurationMin = useMemo(
    () => Object.fromEntries(services.map((s) => [s.name, s.durationMin])),
    [services]
  );
  const minServiceDuration =
    services.length > 0 ? Math.min(...services.map((s) => s.durationMin)) : FALLBACK_MIN_DURATION;
  const business = useAppStore((s) => s.business);
  const dogs = useAppStore((s) => s.dogs);
  const owners = useAppStore((s) => s.owners);
  const addAppointment = useAppStore((s) => s.addAppointment);

  const [ownerName, setOwnerName] = useState("");
  const [dogName, setDogName] = useState("");
  const [breed, setBreed] = useState("");
  const [phone, setPhone] = useState("");
  const [matchedDog, setMatchedDog] = useState<Dog | null>(null);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const [service, setService] = useState<string>("");
  const [startOffset, setStartOffset] = useState(0);
  const [customTimeOpen, setCustomTimeOpen] = useState(false);
  const ownerInputRef = useRef<HTMLInputElement>(null);

  // "form" while filling in/saving the appointment, "notify" once it's been
  // created — same two-step-in-one-Drawer shape as schedule-override-sheet.tsx.
  const [step, setStep] = useState<"form" | "notify">("form");
  const [notifyRecipient, setNotifyRecipient] = useState<NotifyRecipient | null>(null);

  const open = slot !== null;

  // Reset the form whenever a *different* slot is opened. Adjusting state
  // during render (React's documented pattern) instead of in an effect keeps
  // this synchronous with the slot change — no flash of stale form values.
  const slotKey = slot
    ? `${slot.date}-${slot.startMin}-${slot.preferredStartMin ?? ""}-${slot.presetService ?? ""}`
    : null;
  const [lastSlotKey, setLastSlotKey] = useState<string | null>(null);
  if (slotKey !== lastSlotKey) {
    setLastSlotKey(slotKey);
    if (slotKey && slot) {
      setOwnerName("");
      setDogName("");
      setBreed("");
      setPhone("");
      setMatchedDog(null);
      setActiveField(null);
      setService(slot.presetService ?? "");
      const preferredOffset = slot.preferredStartMin
        ? slot.preferredStartMin - slot.startMin
        : 0;
      setStartOffset(Math.max(0, preferredOffset));
      setCustomTimeOpen(false);
      setStep("form");
      setNotifyRecipient(null);
    }
  }

  const activeDurationMin = service ? serviceDurationMin[service] ?? minServiceDuration : 0;

  // Valid start times within the tapped gap, on a 30-min grid — booking
  // stays chronological (9:00, 9:30, 10:00…), never a jump mid-gap.
  const timeOptions = useMemo(() => {
    if (!slot || !activeDurationMin) return [0];
    const limit = Math.max(0, slot.maxDurationMin - activeDurationMin);
    const opts: number[] = [];
    for (let o = 0; o <= limit; o += TIME_STEP) opts.push(o);
    if (opts.length === 0) opts.push(0);
    return opts;
  }, [slot, activeDurationMin]);

  const maxOffset = slot && activeDurationMin ? Math.max(0, slot.maxDurationMin - activeDurationMin) : 0;
  const clampedStartOffset = Math.min(startOffset, maxOffset);
  if (clampedStartOffset !== startOffset) setStartOffset(clampedStartOffset);

  const availableAfterStart = slot ? slot.maxDurationMin - clampedStartOffset : 0;
  const clampedDuration = Math.min(activeDurationMin, availableAfterStart || activeDurationMin);

  const actualStartMin = slot ? slot.startMin + clampedStartOffset : 0;

  // A custom time is just an offset that didn't come from a quick-pick
  // button — same startOffset state, same clamp, same validation as
  // above, so it's indistinguishable from a grid pick once applied.
  const isCustomSelected = !timeOptions.includes(clampedStartOffset);

  function applyCustomTime(hhmm: string) {
    if (!slot) return;
    const [hh, mm] = hhmm.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;
    const offset = hh * 60 + mm - slot.startMin;
    if (offset < 0 || offset > maxOffset) {
      toast.error("Esa hora no está disponible en este hueco.");
      return;
    }
    setStartOffset(offset);
    setCustomTimeOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => ownerInputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [open]);

  const searchText = activeField === "owner" ? ownerName : activeField === "dog" ? dogName : "";

  const suggestions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q || matchedDog) return [];
    return dogs
      .filter((d) => {
        const owner = owners.find((o) => o.id === d.ownerId);
        return (
          d.name.toLowerCase().includes(q) ||
          owner?.name.toLowerCase().includes(q)
        );
      })
      .slice(0, 4);
  }, [searchText, dogs, owners, matchedDog]);

  // The keyboard should only ever be up while the user is actually typing.
  // The moment they act on anything else — pick a suggestion, tap a service,
  // a time — it must close immediately, in the same gesture, never a
  // separate "dismiss" tap first.
  function dismissKeyboard() {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) el.blur();
  }

  function pickDog(dog: Dog) {
    const owner = owners.find((o) => o.id === dog.ownerId);
    setMatchedDog(dog);
    setOwnerName(owner?.name ?? "");
    setDogName(dog.name);
    setBreed(dog.breed);
    setPhone(owner?.phone ?? "");
    if (!slot?.presetService) setService(dog.lastService ?? "");
    dismissKeyboard();
    setActiveField(null);
  }

  function handleOwnerNameChange(v: string) {
    setOwnerName(v);
    if (matchedDog) setMatchedDog(null);
  }

  function handleDogNameChange(v: string) {
    setDogName(v);
    if (matchedDog) setMatchedDog(null);
  }

  function scrollFieldIntoView(el: HTMLElement | null) {
    setTimeout(() => {
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }

  function handleFieldKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      dismissKeyboard();
    }
  }

  const ownerReady = ownerName.trim().length > 0;
  const dogReady = dogName.trim().length > 0;
  const canSave = Boolean(slot) && ownerReady && dogReady && service.length > 0;
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!slot || !canSave || saving) return;
    dismissKeyboard();
    setSaving(true);
    const result = await addAppointment({
      ownerName: ownerName.trim(),
      dogName: dogName.trim(),
      breed: breed.trim() || undefined,
      phone: phone.trim() || undefined,
      service,
      startMin: actualStartMin,
      durationMin: clampedDuration,
      date: slot.date,
      existingDogId: matchedDog?.id,
      existingOwnerId: matchedDog?.ownerId,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(
        result.error === "slot_taken"
          ? "Ese hueco se acaba de ocupar. Elige otra hora."
          : "No se pudo guardar la cita. Inténtalo de nuevo.",
      );
      return;
    }

    toast.success(`Cita guardada · ${dogName.trim()}`, {
      description: `${minToLabel(actualStartMin)} · ${durationLabel(clampedDuration)}`,
    });

    // Read the store fresh rather than the dogs/owners captured at render
    // time — addAppointment may have just inserted a brand-new dog/owner
    // (matchedDog is null in that case), and those inserts happened after
    // this render started.
    const { appointment } = result;
    const freshState = useAppStore.getState();
    const dog = freshState.dogs.find((d) => d.id === appointment.dogId);
    const owner = freshState.owners.find((o) => o.id === appointment.ownerId);
    if (dog && owner) {
      setNotifyRecipient({ appointment, dog, owner });
      setStep("notify");
    } else {
      onOpenChange(false);
    }
  }

  // The sheet keeps a fixed size and position regardless of the keyboard —
  // resizing it on every keystroke read as the whole form "dragging" around.
  // The keyboard simply overlaps whatever is currently underneath it; the
  // focused field scrolls into view instead, and the keyboard itself is
  // dismissed the moment typing is done (dismissKeyboard).
  const dayLabel = slot ? formatDayHeading(parseDateKey(slot.date)) : null;

  return (
    <Drawer
      open={open}
      // Ignore dismiss attempts (backdrop tap, handle drag, Escape) while
      // saving — same guard as schedule-override-sheet.tsx's "confirming".
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DrawerContent
        className="flex flex-col sm:max-w-md sm:mx-auto overflow-hidden"
      >
        {step === "notify" && notifyRecipient && business && (
          <NotifyClientsSheet
            type="appointmentConfirmed"
            business={business}
            recipients={[notifyRecipient]}
            onDone={() => onOpenChange(false)}
          />
        )}
        {step === "form" && (
          <>
        <DrawerHeader className="safe-top text-left pb-3 shrink-0">
          <DrawerTitle className="sr-only">Nueva cita</DrawerTitle>
          {slot && dayLabel && (
            <div className="pt-5">
              <div className="capitalize text-[20px] font-semibold tracking-tight mb-1.5">
                {dayLabel.weekday} {dayLabel.day} {dayLabel.month}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-[20px] font-semibold tracking-tight">
                    {minToLabel(actualStartMin)}
                  </span>
                  {activeDurationMin > 0 && (
                    <span className="tabular text-[13px] text-muted-foreground">
                      – {minToLabel(actualStartMin + clampedDuration)}
                    </span>
                  )}
                </div>
                <span className="text-[12px] text-muted-foreground">
                  hueco libre hasta {minToLabel(slot.startMin + slot.maxDurationMin)}
                </span>
              </div>
            </div>
          )}
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Cliente
            </div>
            <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
              <div className="relative">
                <Input
                  ref={ownerInputRef}
                  value={ownerName}
                  onChange={(e) => handleOwnerNameChange(e.target.value)}
                  onFocus={(e) => {
                    setActiveField("owner");
                    scrollFieldIntoView(e.currentTarget);
                  }}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="Nombre del dueño"
                  className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
                  autoComplete="off"
                  enterKeyHint="next"
                />
                {matchedDog && (
                  <Check className="absolute right-4 top-1/2 -translate-y-1/2 size-[18px] text-slot-free" />
                )}
                {activeField === "owner" && suggestions.length > 0 && (
                  <SuggestionList suggestions={suggestions} owners={owners} onPick={pickDog} />
                )}
              </div>

              <div className="relative">
                <Input
                  value={dogName}
                  onChange={(e) => handleDogNameChange(e.target.value)}
                  onFocus={(e) => {
                    setActiveField("dog");
                    scrollFieldIntoView(e.currentTarget);
                  }}
                  onKeyDown={handleFieldKeyDown}
                  placeholder="Nombre del perro"
                  className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
                  autoComplete="off"
                  enterKeyHint="next"
                />
                {activeField === "dog" && suggestions.length > 0 && (
                  <SuggestionList suggestions={suggestions} owners={owners} onPick={pickDog} />
                )}
              </div>

              <Input
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                onKeyDown={handleFieldKeyDown}
                placeholder="Raza del perro"
                className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
                autoComplete="off"
                enterKeyHint="next"
              />

              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onFocus={(e) => scrollFieldIntoView(e.currentTarget)}
                onKeyDown={handleFieldKeyDown}
                placeholder="Número de teléfono"
                className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
                autoComplete="off"
                inputMode="tel"
                enterKeyHint="done"
              />
            </div>

            {matchedDog && (
              <div className="flex items-center gap-2 mt-1.5 px-1 text-[12.5px] text-muted-foreground">
                <span>Cliente existente</span>
                {matchedDog.behaviorNote && (
                  <span className="text-slot-alert">· {matchedDog.behaviorNote}</span>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Servicio
            </div>
            <ServicePicker
              services={services}
              selected={service}
              onSelect={(name) => {
                dismissKeyboard();
                setService(name);
              }}
            />
          </div>

          {service && timeOptions.length > 1 && (
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                Hora de inicio
              </div>
              <TimeGridPicker
                baseMin={slot?.startMin ?? 0}
                options={timeOptions}
                selected={clampedStartOffset}
                onSelect={(o) => {
                  dismissKeyboard();
                  setCustomTimeOpen(false);
                  setStartOffset(o);
                }}
                trailing={{
                  label: isCustomSelected ? minToLabel(actualStartMin) : "Personalizar",
                  active: isCustomSelected,
                  onClick: () => {
                    dismissKeyboard();
                    setCustomTimeOpen((v) => !v);
                  },
                }}
              />
              {customTimeOpen && (
                <label className="block mt-2">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
                    Hora personalizada
                  </div>
                  <input
                    type="time"
                    step={300}
                    defaultValue={minToLabel(actualStartMin)}
                    onChange={(e) => applyCustomTime(e.target.value)}
                    className="tabular w-full h-12 rounded-2xl bg-secondary px-4 text-[16px]"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            disabled={!canSave || saving}
            onClick={handleSave}
            className={cn(
              "w-full h-13 flex items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
              canSave
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
              saving && "opacity-60"
            )}
            style={{ height: 52 }}
          >
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            {saving ? "Guardando…" : "Guardar cita"}
          </button>
        </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function SuggestionList({
  suggestions,
  owners,
  onPick,
}: {
  suggestions: Dog[];
  owners: { id: string; name: string }[];
  onPick: (dog: Dog) => void;
}) {
  return (
    <div className="absolute z-20 top-[calc(100%+6px)] left-0 right-0 rounded-2xl bg-popover border border-border shadow-lg overflow-hidden">
      {suggestions.map((d) => {
        const o = owners.find((ow) => ow.id === d.ownerId);
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onPick(d)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-accent transition-colors"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-slot-next-tint text-slot-next shrink-0">
              <PawPrint className="size-[15px]" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium truncate">
                {d.name}{" "}
                <span className="text-muted-foreground font-normal">· {d.breed}</span>
              </span>
              <span className="block text-[12px] text-muted-foreground truncate">
                {o?.name}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
