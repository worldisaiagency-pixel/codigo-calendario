"use client";

import { useEffect, useMemo, useState } from "react";
import { TopBar } from "@/components/top-bar";
import { DayNav } from "@/components/calendar/day-nav";
import { DayRail } from "@/components/calendar/day-rail";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import { NewAppointmentSheet } from "@/components/appointment/new-appointment-sheet";
import { ClientSheet } from "@/components/appointment/client-sheet";
import { DesktopSidePanel } from "@/components/appointment/desktop-side-panel";
import type { ClientContext } from "@/components/appointment/client-detail-body";
import { GlobalSearch } from "@/components/search/global-search";
import { useAppStore } from "@/lib/store";
import { buildRail } from "@/lib/rail";
import { isSameDay, toDateKey } from "@/lib/time";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMounted } from "@/hooks/use-mounted";
import { useAppointmentReminders } from "@/hooks/use-appointment-reminders";
import {
  isNotificationsEnabled,
  notificationsSupported,
  registerServiceWorker,
  requestNotificationPermission,
  setNotificationsEnabled,
} from "@/lib/notifications";
import type { RailBlock, Dog, ViewMode } from "@/lib/types";
import { toast } from "sonner";

export default function Home() {
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const appointments = useAppStore((s) => s.appointments);
  const dogs = useAppStore((s) => s.dogs);
  const owners = useAppStore((s) => s.owners);

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const initRealtime = useAppStore((s) => s.initRealtime);

  // The "today" the app opens to must reflect the browser's clock, never the
  // server's — computing it during SSR risks a clock/timezone mismatch that
  // hydration can't self-correct. Render nothing date-dependent until mounted.
  const mounted = useMounted();
  useEffect(() => {
    if (!mounted) return;
    setSelectedDate(new Date());
    return initRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const [freeSlot, setFreeSlot] = useState<
    { date: string; startMin: number; maxDurationMin: number; preferredStartMin?: number } | null
  >(null);
  const [clientContext, setClientContext] = useState<ClientContext | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  // Safe to read synchronously: false on the server (guarded inside
  // isNotificationsEnabled), and the value is only ever rendered once
  // `mounted` is true — by then hydration has already settled.
  const [notificationsEnabled, setNotificationsEnabledState] = useState(
    isNotificationsEnabled
  );

  useAppointmentReminders(notificationsEnabled);

  async function handleToggleNotifications() {
    if (notificationsEnabled) {
      setNotificationsEnabledState(false);
      setNotificationsEnabled(false);
      toast("Recordatorios desactivados");
      return;
    }
    if (!notificationsSupported()) {
      toast.error("Este navegador no admite notificaciones");
      return;
    }
    await registerServiceWorker();
    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      setNotificationsEnabledState(true);
      setNotificationsEnabled(true);
      toast.success("Recordatorios activados", {
        description: "Avisaremos 10 min antes de cada cita",
      });
    } else {
      toast.error("Notificaciones bloqueadas", {
        description: "Actívalas en los ajustes del navegador",
      });
    }
  }

  const dogById = useMemo(() => new Map(dogs.map((d) => [d.id, d])), [dogs]);
  const ownerById = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);

  const dateKey = toDateKey(selectedDate);
  const isToday = isSameDay(selectedDate, new Date());

  const blocks: RailBlock[] = useMemo(
    () =>
      buildRail({
        dateKey,
        isToday,
        appointments,
        dogById,
        ownerById,
      }),
    [dateKey, isToday, appointments, dogById, ownerById]
  );

  function handleFreeTap(block: Extract<RailBlock, { kind: "free" }>, preferredStartMin?: number) {
    setFreeSlot({
      date: dateKey,
      startMin: block.startMin,
      maxDurationMin: block.durationMin,
      preferredStartMin,
    });
  }

  function handleApptTap(block: Extract<RailBlock, { kind: "busy" }>) {
    const ctx: ClientContext = {
      appointment: block.appointment,
      dog: block.dog,
      owner: block.owner,
    };
    setClientContext(ctx);
  }

  function handleSelectDay(d: Date) {
    setSelectedDate(d);
    setViewMode("day");
  }

  function handlePickDogFromSearch(dog: Dog) {
    const owner = ownerById.get(dog.ownerId);
    if (!owner) return;
    const upcoming = appointments
      .filter((a) => a.dogId === dog.id && a.status === "confirmed")
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    setClientContext({ appointment: upcoming ?? null, dog, owner });
  }

  const mobileSheetContext = !isDesktop ? clientContext : null;

  if (!mounted) {
    return (
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        <div className="flex flex-1 min-w-0 flex-col">
          <TopBar
            onSearchClick={() => {}}
            notificationsEnabled={false}
            onToggleNotifications={() => {}}
          />
          <div className="flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="flex flex-1 min-w-0 flex-col">
        <TopBar
          onSearchClick={() => setSearchOpen(true)}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
        />
        <DayNav
          date={selectedDate}
          onChange={setSelectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        {viewMode === "day" && (
          <DayRail
            blocks={blocks}
            isToday={isToday}
            onFreeTap={handleFreeTap}
            onApptTap={handleApptTap}
          />
        )}
        {viewMode === "week" && (
          <WeekView
            date={selectedDate}
            appointments={appointments}
            dogById={dogById}
            ownerById={ownerById}
            onSelectDay={handleSelectDay}
          />
        )}
        {viewMode === "month" && (
          <MonthView
            date={selectedDate}
            appointments={appointments}
            onSelectDay={handleSelectDay}
          />
        )}
      </div>

      <DesktopSidePanel context={clientContext} />

      <NewAppointmentSheet
        slot={freeSlot}
        onOpenChange={(open) => !open && setFreeSlot(null)}
      />

      <ClientSheet
        context={mobileSheetContext}
        onOpenChange={(open) => !open && setClientContext(null)}
      />

      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onPickDog={handlePickDogFromSearch}
      />
    </div>
  );
}
