"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { DayNav } from "@/components/calendar/day-nav";
import { DayRail } from "@/components/calendar/day-rail";
import { WeekView } from "@/components/calendar/week-view";
import { MonthView } from "@/components/calendar/month-view";
import { NewAppointmentSheet } from "@/components/appointment/new-appointment-sheet";
import { AvailabilitySheet, type AvailabilityPick } from "@/components/appointment/availability-sheet";
import { ClientSheet } from "@/components/appointment/client-sheet";
import { DesktopSidePanel } from "@/components/appointment/desktop-side-panel";
import type { ClientContext } from "@/components/appointment/client-detail-body";
import { GlobalSearch } from "@/components/search/global-search";
import { LoginScreen } from "@/components/auth/login-screen";
import { AdminPanel } from "@/components/admin/admin-panel";
import { WorldworkFooter } from "@/components/worldwork-footer";
import { BusinessMenuSheet } from "@/components/business/business-menu-sheet";
import { ScheduleOverrideSheet } from "@/components/business/schedule-override-sheet";
import { ProfileSheet } from "@/components/business/profile-sheet";
import { useAuth } from "@/lib/auth/use-auth";
import { useAppStore } from "@/lib/store";
import { buildRail } from "@/lib/rail";
import { resolveDay, isProfileConfigured } from "@/lib/data";
import { isSameDay, toDateKey } from "@/lib/time";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useMounted } from "@/hooks/use-mounted";
import { useAppointmentReminders } from "@/hooks/use-appointment-reminders";
import {
  isNotificationsEnabled,
  notificationsSupported,
  setNotificationsEnabled,
} from "@/lib/notifications";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/push";
import type { RailBlock, Dog, ViewMode } from "@/lib/types";
import { toast } from "sonner";

export default function Home() {
  const { status, login, loginAdmin, logout } = useAuth();
  const business = useAppStore((s) => s.business);
  const selectedDate = useAppStore((s) => s.selectedDate);
  const setSelectedDate = useAppStore((s) => s.setSelectedDate);
  const appointments = useAppStore((s) => s.appointments);
  const dogs = useAppStore((s) => s.dogs);
  const owners = useAppStore((s) => s.owners);
  const scheduleOverrides = useAppStore((s) => s.scheduleOverrides);

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // The "today" the app opens to must reflect the browser's clock, never the
  // server's — computing it during SSR risks a clock/timezone mismatch that
  // hydration can't self-correct. Render nothing date-dependent until mounted.
  const mounted = useMounted();
  useEffect(() => {
    if (!mounted) return;
    setSelectedDate(new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const [freeSlot, setFreeSlot] = useState<
    | {
        date: string;
        startMin: number;
        maxDurationMin: number;
        preferredStartMin?: number;
        presetService?: string;
      }
    | null
  >(null);
  const [clientContext, setClientContext] = useState<ClientContext | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  // Safe to read synchronously: false on the server (guarded inside
  // isNotificationsEnabled), and the value is only ever rendered once
  // `mounted` is true — by then hydration has already settled.
  const [notificationsEnabled, setNotificationsEnabledState] = useState(
    isNotificationsEnabled
  );

  useAppointmentReminders(notificationsEnabled);

  // First time this business logs in on this device, its profile
  // (services/horarios/vacaciones) is empty — nudge straight to the profile
  // screen instead of showing a silently "closed every day" calendar.
  // Adjusting state during render (React's documented pattern) instead of an
  // effect keeps this a single synchronous check per business, not a
  // separate cascading render.
  const [checkedProfileFor, setCheckedProfileFor] = useState<string | null>(null);
  if (status === "authenticated" && business && checkedProfileFor !== business.id) {
    setCheckedProfileFor(business.id);
    if (!isProfileConfigured(business)) setProfileOpen(true);
  }

  async function handleToggleNotifications() {
    if (!business) return;
    if (notificationsEnabled) {
      setNotificationsEnabledState(false);
      setNotificationsEnabled(false);
      await unsubscribeFromPush(business.id);
      toast("Recordatorios desactivados");
      return;
    }
    if (!notificationsSupported()) {
      toast.error("Este navegador no admite notificaciones");
      return;
    }
    const enabled = await subscribeToPush(business.id);
    if (enabled) {
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
  const resolvedDay = useMemo(
    () => (business ? resolveDay(business, scheduleOverrides, selectedDate) : null),
    [business, scheduleOverrides, selectedDate]
  );
  const schedule = resolvedDay?.schedule ?? null;

  const blocks: RailBlock[] = useMemo(
    () =>
      schedule
        ? buildRail({
            dateKey,
            isToday,
            appointments,
            dogById,
            ownerById,
            schedule,
            manualBlocks: resolvedDay?.blocks ?? [],
          })
        : [],
    [dateKey, isToday, appointments, dogById, ownerById, schedule, resolvedDay]
  );

  function handleFreeTap(block: Extract<RailBlock, { kind: "free" }>, preferredStartMin?: number) {
    setFreeSlot({
      date: dateKey,
      startMin: block.startMin,
      maxDurationMin: block.durationMin,
      preferredStartMin,
    });
  }

  function handleAvailabilityConfirm(pick: AvailabilityPick) {
    setFreeSlot({
      date: pick.date,
      startMin: pick.blockStartMin,
      maxDurationMin: pick.blockDurationMin,
      preferredStartMin: pick.slotStartMin,
      presetService: pick.service,
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

  if (!mounted || status === "loading") {
    return (
      <div className="flex h-dvh w-full overflow-hidden bg-background">
        <div className="flex flex-1 min-w-0 flex-col">
          <div className="flex-1" />
        </div>
      </div>
    );
  }

  if (status === "authenticated-admin") {
    return <AdminPanel onLogout={logout} />;
  }

  if (status === "unauthenticated" || !business) {
    return <LoginScreen onSuccess={login} onAdminSuccess={loginAdmin} />;
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <div className="flex flex-1 min-w-0 flex-col">
        <TopBar
          businessName={business.name}
          onOpenBusinessMenu={() => setBusinessMenuOpen(true)}
          onSearchClick={() => setSearchOpen(true)}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={handleToggleNotifications}
        />
        <div className="px-4 pt-2 pb-4">
          <button
            type="button"
            onClick={() => setAvailabilityOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-secondary py-2.5 text-[13.5px] font-medium text-foreground/80 transition-colors duration-150 active:bg-accent"
          >
            <CalendarClock className="size-[15px]" strokeWidth={2} />
            Ver disponibilidad
          </button>
        </div>
        <DayNav
          date={selectedDate}
          onChange={setSelectedDate}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        {viewMode === "day" && (
          <DayRail
            blocks={blocks}
            schedule={schedule}
            isToday={isToday}
            onFreeTap={handleFreeTap}
            onApptTap={handleApptTap}
          />
        )}
        {viewMode === "week" && (
          <WeekView
            date={selectedDate}
            business={business}
            scheduleOverrides={scheduleOverrides}
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
        <WorldworkFooter />
      </div>

      <DesktopSidePanel context={clientContext} />

      <NewAppointmentSheet
        slot={freeSlot}
        services={business.services}
        onOpenChange={(open) => !open && setFreeSlot(null)}
      />

      <AvailabilitySheet
        open={availabilityOpen}
        onOpenChange={setAvailabilityOpen}
        business={business}
        scheduleOverrides={scheduleOverrides}
        appointments={appointments}
        dogById={dogById}
        ownerById={ownerById}
        onConfirm={handleAvailabilityConfirm}
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

      <BusinessMenuSheet
        open={businessMenuOpen}
        onOpenChange={setBusinessMenuOpen}
        business={business}
        scheduleOverrides={scheduleOverrides}
        onOpenScheduleEditor={() => {
          setBusinessMenuOpen(false);
          setScheduleEditorOpen(true);
        }}
        onOpenProfile={() => {
          setBusinessMenuOpen(false);
          setProfileOpen(true);
        }}
        onLogout={logout}
      />

      <ScheduleOverrideSheet
        open={scheduleEditorOpen}
        onOpenChange={setScheduleEditorOpen}
      />

      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
