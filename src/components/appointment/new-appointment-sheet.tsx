"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, PawPrint } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { TimeGridPicker } from "./time-grid-picker";
import { cn } from "@/lib/utils";
import { durationLabel, formatDayHeading, minToLabel, parseDateKey } from "@/lib/time";
import { useAppStore } from "@/lib/store";
import { serviceOptions } from "@/lib/mock-data";
import type { Dog } from "@/lib/types";
import { toast } from "sonner";

interface SlotContext {
  date: string;
  startMin: number;
  maxDurationMin: number;
  preferredStartMin?: number;
}

const DURATION_STEPS = [30, 45, 60, 75, 90, 120];
const MIN_DURATION = DURATION_STEPS[0];
const TIME_STEP = 30;

export function NewAppointmentSheet({
  slot,
  onOpenChange,
}: {
  slot: SlotContext | null;
  onOpenChange: (open: boolean) => void;
}) {
  const dogs = useAppStore((s) => s.dogs);
  const owners = useAppStore((s) => s.owners);
  const addAppointment = useAppStore((s) => s.addAppointment);

  const [query, setQuery] = useState("");
  const [matchedDog, setMatchedDog] = useState<Dog | null>(null);
  const [ownerNameDraft, setOwnerNameDraft] = useState("");
  const [service, setService] = useState<string>("");
  const [duration, setDuration] = useState<number>(45);
  const [startOffset, setStartOffset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const open = slot !== null;

  // Reset the form whenever a *different* slot is opened. Adjusting state
  // during render (React's documented pattern) instead of in an effect keeps
  // this synchronous with the slot change — no flash of stale form values.
  const slotKey = slot ? `${slot.date}-${slot.startMin}-${slot.preferredStartMin ?? ""}` : null;
  const [lastSlotKey, setLastSlotKey] = useState<string | null>(null);
  if (slotKey !== lastSlotKey) {
    setLastSlotKey(slotKey);
    if (slotKey && slot) {
      setQuery("");
      setMatchedDog(null);
      setOwnerNameDraft("");
      setService("");
      setDuration(Math.min(45, slot.maxDurationMin));
      const preferredOffset = slot.preferredStartMin
        ? slot.preferredStartMin - slot.startMin
        : 0;
      setStartOffset(Math.max(0, preferredOffset));
    }
  }

  // Valid start times within the tapped gap, on a 30-min grid — booking
  // stays chronological (9:00, 9:30, 10:00…), never a jump mid-gap.
  const timeOptions = useMemo(() => {
    if (!slot) return [0];
    const limit = Math.max(0, slot.maxDurationMin - MIN_DURATION);
    const opts: number[] = [];
    for (let o = 0; o <= limit; o += TIME_STEP) opts.push(o);
    if (opts.length === 0) opts.push(0);
    return opts;
  }, [slot]);

  const maxOffset = slot ? Math.max(0, slot.maxDurationMin - MIN_DURATION) : 0;
  const clampedStartOffset = Math.min(startOffset, maxOffset);
  if (clampedStartOffset !== startOffset) setStartOffset(clampedStartOffset);

  const availableAfterStart = slot ? slot.maxDurationMin - clampedStartOffset : 0;
  const durationOptions = DURATION_STEPS.filter((d) => d <= availableAfterStart);
  const clampedDuration = durationOptions.includes(duration)
    ? duration
    : (durationOptions[durationOptions.length - 1] ?? MIN_DURATION);
  if (clampedDuration !== duration) setDuration(clampedDuration);

  const actualStartMin = slot ? slot.startMin + clampedStartOffset : 0;

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [open]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
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
  }, [query, dogs, owners, matchedDog]);

  // The keyboard should only ever be up while the user is actually typing.
  // The moment they act on anything else — pick a suggestion, tap a service,
  // a duration, a time — it must close immediately, in the same gesture,
  // never a separate "dismiss" tap first.
  function dismissKeyboard() {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) el.blur();
  }

  function pickDog(dog: Dog) {
    setMatchedDog(dog);
    setQuery(dog.name);
    setService(dog.lastService ?? "");
    setDuration(Math.min(dog.avgDurationMin, availableAfterStart));
    dismissKeyboard();
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    if (matchedDog) setMatchedDog(null);
  }

  function handleInputFocus() {
    // Give the keyboard a beat to open, then make sure the field (and its
    // suggestion list) aren't left underneath it.
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      dismissKeyboard();
    }
  }

  const owner = matchedDog
    ? owners.find((o) => o.id === matchedDog.ownerId)
    : null;

  const dogName = matchedDog ? matchedDog.name : query.trim();
  const ownerReady = matchedDog ? true : ownerNameDraft.trim().length > 0;
  const canSave = Boolean(slot) && dogName.length > 0 && service.length > 0 && ownerReady;

  function handleSave() {
    if (!slot || !canSave) return;
    dismissKeyboard();
    addAppointment({
      ownerName: matchedDog ? owner?.name ?? "" : ownerNameDraft.trim(),
      dogName,
      breed: matchedDog?.breed,
      service,
      startMin: actualStartMin,
      durationMin: clampedDuration,
      date: slot.date,
      existingDogId: matchedDog?.id,
      existingOwnerId: matchedDog?.ownerId,
    });
    toast.success(`Cita guardada · ${dogName}`, {
      description: `${minToLabel(actualStartMin)} · ${durationLabel(clampedDuration)}`,
    });
    onOpenChange(false);
  }

  // The sheet keeps a fixed size and position regardless of the keyboard —
  // resizing it on every keystroke read as the whole form "dragging" around.
  // The keyboard simply overlaps whatever is currently underneath it; the
  // focused field scrolls into view instead (see handleInputFocus), and the
  // keyboard itself is dismissed the moment typing is done (dismissKeyboard).
  const dayLabel = slot ? formatDayHeading(parseDateKey(slot.date)) : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "flex flex-col sm:max-w-md sm:mx-auto overflow-hidden",
          "data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:h-[100dvh] data-[vaul-drawer-direction=bottom]:max-h-[100dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[20px]"
        )}
      >
        <DrawerHeader className="safe-top text-left pb-2 shrink-0">
          <DrawerTitle className="sr-only">Nueva cita</DrawerTitle>
          {slot && dayLabel && (
            <>
              <div className="capitalize text-[13px] font-medium text-muted-foreground mb-1">
                {dayLabel.weekday} {dayLabel.day} {dayLabel.month}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="tabular text-[20px] font-semibold tracking-tight">
                    {minToLabel(actualStartMin)}
                  </span>
                  <span className="tabular text-[13px] text-muted-foreground">
                    – {minToLabel(actualStartMin + clampedDuration)}
                  </span>
                </div>
                <span className="text-[12px] text-muted-foreground">
                  hueco libre hasta {minToLabel(slot.startMin + slot.maxDurationMin)}
                </span>
              </div>
            </>
          )}
        </DrawerHeader>

        <div
          ref={scrollAreaRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-4 flex flex-col gap-4"
        >
          <div className="relative">
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleInputKeyDown}
              placeholder="Nombre del perro o del dueño"
              className="h-12 text-[16px] rounded-2xl bg-secondary border-0 px-4"
              autoComplete="off"
              enterKeyHint="done"
            />
            {matchedDog && (
              <Check className="absolute right-4 top-1/2 -translate-y-1/2 size-[18px] text-slot-free" />
            )}

            {suggestions.length > 0 && (
              <div className="absolute z-20 top-[calc(100%+6px)] left-0 right-0 rounded-2xl bg-popover border border-border shadow-lg overflow-hidden">
                {suggestions.map((d) => {
                  const o = owners.find((ow) => ow.id === d.ownerId);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => pickDog(d)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-accent transition-colors"
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-slot-next-tint text-slot-next shrink-0">
                        <PawPrint className="size-[15px]" strokeWidth={2} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium truncate">
                          {d.name}{" "}
                          <span className="text-muted-foreground font-normal">
                            · {d.breed}
                          </span>
                        </span>
                        <span className="block text-[12px] text-muted-foreground truncate">
                          {o?.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {matchedDog && owner && (
            <div className="flex items-center gap-2 -mt-1 px-1 text-[12.5px] text-muted-foreground">
              <span>{owner.name}</span>
              {matchedDog.behaviorNote && (
                <span className="text-slot-alert">· {matchedDog.behaviorNote}</span>
              )}
            </div>
          )}

          {!matchedDog && query.trim().length > 0 && suggestions.length === 0 && (
            <Input
              value={ownerNameDraft}
              onChange={(e) => setOwnerNameDraft(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={handleInputKeyDown}
              placeholder="Nombre del dueño (cliente nuevo)"
              className="h-11 text-[16px] rounded-2xl bg-secondary border-0 px-4"
              autoComplete="off"
              enterKeyHint="done"
            />
          )}

          {timeOptions.length > 1 && (
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
                  setStartOffset(o);
                }}
              />
            </div>
          )}

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Servicio
            </div>
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    dismissKeyboard();
                    setService(s);
                  }}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors duration-150 active:scale-[0.96]",
                    service === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground/80 active:bg-accent"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              Duración
            </div>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    dismissKeyboard();
                    setDuration(d);
                  }}
                  className={cn(
                    "tabular px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors duration-150 active:scale-[0.96]",
                    clampedDuration === d
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground/80 active:bg-accent"
                  )}
                >
                  {durationLabel(d)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 pt-3 border-t border-border/60 bg-popover" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={cn(
              "w-full h-13 rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
              canSave
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
            style={{ height: 52 }}
          >
            Guardar cita
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
