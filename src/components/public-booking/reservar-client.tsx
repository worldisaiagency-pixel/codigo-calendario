"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, PawPrint } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ServicePicker } from "@/components/appointment/service-picker";
import { cn } from "@/lib/utils";
import { dataProvider, fetchReservas, createAppointmentInSheet } from "@/lib/data";
import type { Business } from "@/lib/data";
import { findAvailableSlots, type AvailabilitySlot } from "@/lib/availability";
import { addDays, durationLabel, formatDayHeading, minToLabel, parseDateKey } from "@/lib/time";
import type { Appointment, Dog, Owner } from "@/lib/types";

type LoadState = "loading" | "ready" | "not-found" | "error";
type SubmitState = "idle" | "submitting" | "done" | "error";

export function ReservarClient() {
  const params = useSearchParams();
  const negocio = params.get("negocio")?.trim() ?? "";
  const usuario = params.get("usuario")?.trim() ?? "";

  const invalidLink = !negocio || !usuario;
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [business, setBusiness] = useState<Business | null>(null);
  const [bookedAppointments, setBookedAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    if (invalidLink) return; // rendered directly below, no fetch needed
    let cancelled = false;
    (async () => {
      try {
        const businesses = await dataProvider.listBusinesses();
        const match = businesses.find(
          (b) =>
            b.name.trim().toLowerCase() === negocio.toLowerCase() &&
            b.username.trim().toLowerCase() === usuario.toLowerCase()
        );
        if (cancelled) return;
        if (!match) {
          setLoadState("not-found");
          return;
        }
        const reservas = await fetchReservas(match.name, match.username);
        if (cancelled) return;
        setBookedAppointments(
          reservas.map((r) => ({
            id: r.id,
            dogId: r.id,
            ownerId: r.id,
            date: r.date,
            startMin: r.startMin,
            durationMin: r.durationMin,
            service: r.service,
            status: r.status,
          }))
        );
        setBusiness(match);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidLink]);

  if (invalidLink) return <CenteredMessage>Enlace de reserva no válido.</CenteredMessage>;
  if (loadState === "loading") return <CenteredMessage>Cargando…</CenteredMessage>;
  if (loadState === "not-found") {
    return <CenteredMessage>Enlace de reserva no válido.</CenteredMessage>;
  }
  if (loadState === "error" || !business) {
    return (
      <CenteredMessage>
        No se pudo conectar. Inténtalo de nuevo en un momento.
      </CenteredMessage>
    );
  }

  return <BookingForm business={business} bookedAppointments={bookedAppointments} />;
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full items-center justify-center px-6 text-center text-[14px] text-muted-foreground">
      {children}
    </div>
  );
}

const emptyDogById = new Map<string, Dog>();
const emptyOwnerById = new Map<string, Owner>();

function BookingForm({
  business,
  bookedAppointments,
}: {
  business: Business;
  bookedAppointments: Appointment[];
}) {
  const services = business.services;
  const serviceDurationMin = useMemo(
    () => Object.fromEntries(services.map((s) => [s.name, s.durationMin])),
    [services]
  );

  const [service, setService] = useState("");
  const [selected, setSelected] = useState<AvailabilitySlot | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [dogName, setDogName] = useState("");
  const [breed, setBreed] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const results = useMemo(() => {
    if (!service) return [];
    const durationMin = serviceDurationMin[service];
    const today = new Date();
    return findAvailableSlots({
      business,
      appointments: bookedAppointments,
      dogById: emptyDogById,
      ownerById: emptyOwnerById,
      durationMin,
      rangeStart: today,
      rangeEnd: addDays(today, 45),
      limit: 8,
    });
  }, [business, service, bookedAppointments, serviceDurationMin]);

  const canSubmit =
    Boolean(service && selected) && ownerName.trim().length > 0 && dogName.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || !selected) return;
    setSubmitState("submitting");
    const result = await createAppointmentInSheet({
      id: crypto.randomUUID(),
      negocio: business.name,
      usuario: business.username,
      date: selected.date,
      startMin: selected.slotStartMin,
      durationMin: serviceDurationMin[service],
      service,
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      dogName: dogName.trim(),
      breed: breed.trim(),
      status: "confirmed",
      origin: "web",
    });
    setSubmitState(result.ok ? "done" : "error");
  }

  if (submitState === "done") {
    const { weekday, day, month } = formatDayHeading(parseDateKey(selected!.date));
    return (
      <CenteredMessage>
        <div className="flex flex-col items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-full bg-slot-free-tint text-slot-free">
            <Check className="size-7" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-[16px] font-semibold text-foreground">Cita confirmada</p>
            <p className="mt-1 capitalize">
              {weekday} {day} {month} · {minToLabel(selected!.slotStartMin)}
            </p>
          </div>
        </div>
      </CenteredMessage>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-5 py-8">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight">{business.name}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">Reserva tu cita en unos pasos</p>
      </div>

      <Section title="Servicio">
        <ServicePicker
          services={services}
          selected={service}
          onSelect={(name) => {
            setService(name);
            setSelected(null);
          }}
        />
      </Section>

      {service && (
        <Section title="Elige día y hora">
          {results.length === 0 ? (
            <p className="px-1 text-[13.5px] text-muted-foreground">
              No hay huecos disponibles próximamente.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {results.map((r) => {
                const isSelected =
                  selected?.date === r.date && selected?.slotStartMin === r.slotStartMin;
                const { weekday, day, month } = formatDayHeading(parseDateKey(r.date));
                return (
                  <button
                    key={`${r.date}-${r.slotStartMin}`}
                    type="button"
                    onClick={() => setSelected(r)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 active:scale-[0.99]",
                      isSelected
                        ? "bg-slot-free-tint border border-slot-free"
                        : "bg-secondary border border-transparent active:bg-accent"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium capitalize truncate">
                        {weekday} {day} {month}
                      </span>
                      <span className="tabular block text-[12.5px] text-muted-foreground">
                        {minToLabel(r.slotStartMin)} –{" "}
                        {minToLabel(r.slotStartMin + serviceDurationMin[service])} ·{" "}
                        {durationLabel(serviceDurationMin[service])}
                      </span>
                    </span>
                    {isSelected && (
                      <Check className="size-[18px] text-slot-free shrink-0" strokeWidth={2.25} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {selected && (
        <Section title="Tus datos">
          <div className="rounded-2xl bg-secondary overflow-hidden divide-y divide-border/60">
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Tu nombre"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="name"
            />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="tel"
              inputMode="tel"
            />
            <Input
              value={dogName}
              onChange={(e) => setDogName(e.target.value)}
              placeholder="Nombre de tu mascota"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="off"
            />
            <Input
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Raza (opcional)"
              className="h-12 text-[16px] rounded-none bg-transparent border-0 px-4"
              autoComplete="off"
            />
          </div>
        </Section>
      )}

      {selected && (
        <button
          type="button"
          disabled={!canSubmit || submitState === "submitting"}
          onClick={handleSubmit}
          className={cn(
            "w-full rounded-2xl text-[16px] font-semibold transition-all duration-150 active:scale-[0.985]",
            canSubmit
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground",
            submitState === "submitting" && "opacity-60"
          )}
          style={{ height: 52 }}
        >
          {submitState === "submitting" ? "Confirmando…" : "Confirmar cita"}
        </button>
      )}

      {submitState === "error" && (
        <p className="text-center text-[13px] text-destructive">
          No se pudo confirmar la cita. Inténtalo de nuevo.
        </p>
      )}

      <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
        <PawPrint className="size-3" strokeWidth={2} />
        Reservas gestionadas por Agenda
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
        {title}
      </div>
      {children}
    </div>
  );
}
