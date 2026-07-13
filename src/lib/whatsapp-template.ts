import { formatDayHeading, minToLabel, parseDateKey } from "./time";

/** Every kind of WhatsApp message the app can generate. This is the single
 * place that knows the full set — everything else (defaults, the profile
 * editor, storage) derives from WHATSAPP_TEMPLATE_DEFINITIONS below, so
 * adding a future type (e.g. "appointmentNoShow") means adding one entry
 * here and nowhere else. Not wired to any automatic sender yet — today
 * "appointmentChanged" is only used by the manual reschedule-notify flow
 * (see notify-clients-sheet.tsx); the rest exist so their templates can be
 * configured ahead of whatever triggers them later. */
export type WhatsAppTemplateType =
  | "appointmentChanged"
  | "appointmentReminder"
  | "appointmentConfirmed"
  | "appointmentCancelled"
  | "appointmentReview";

export interface WhatsAppTemplateDefinition {
  type: WhatsAppTemplateType;
  label: string;
  emoji: string;
  defaultTemplate: string;
}

const DEFAULT_APPOINTMENT_CHANGED_TEMPLATE = `Hola, {cliente} 👋

Te escribimos para avisarte de que, por un cambio en nuestra disponibilidad, hemos tenido que reprogramar la cita de {perro}.

📅 Nueva cita:
{fecha}

🕒 {hora}

Si este nuevo horario no te viene bien, ponte en contacto con nosotros y buscaremos otra alternativa.

Muchas gracias y disculpa las molestias.`;

const DEFAULT_APPOINTMENT_REMINDER_TEMPLATE = `Hola {cliente} 👋

Te recordamos que la cita de {perro} para {servicio} es:

📅 {fecha_hora}

Si no puedes asistir, ponte en contacto con nosotros.

Muchas gracias.

{negocio}`;

const DEFAULT_APPOINTMENT_CONFIRMED_TEMPLATE = `Hola {cliente} 👋

Tu reserva para {perro} ha sido confirmada.

📅 {fecha_hora}

Servicio:
{servicio}

Te esperamos.

{negocio}`;

const DEFAULT_APPOINTMENT_CANCELLED_TEMPLATE = `Hola {cliente} 👋

Lamentamos comunicarte que la cita de {perro} prevista para:

📅 {fecha_hora}

ha sido cancelada.

Si deseas reservar otra fecha estaremos encantados de ayudarte.

{negocio}`;

const DEFAULT_APPOINTMENT_REVIEW_TEMPLATE = `Hola {cliente} 👋

Esperamos que todo haya ido genial con {elemento}.

Muchas gracias por confiar en {negocio}.

Si tienes un minuto, nos ayudaría muchísimo dejando una reseña:

{review_link}

¡Muchas gracias! ❤️`;

/** The full template registry — order here is display order in the profile
 * editor. To add a new template type: add its WhatsAppTemplateType above,
 * one entry here with its default copy, and nothing else — storage,
 * substitution, the editor UI and the preview all derive from this list. */
export const WHATSAPP_TEMPLATE_DEFINITIONS: WhatsAppTemplateDefinition[] = [
  {
    type: "appointmentChanged",
    label: "Cambio de cita",
    emoji: "📅",
    defaultTemplate: DEFAULT_APPOINTMENT_CHANGED_TEMPLATE,
  },
  {
    type: "appointmentReminder",
    label: "Recordatorio de cita",
    emoji: "⏰",
    defaultTemplate: DEFAULT_APPOINTMENT_REMINDER_TEMPLATE,
  },
  {
    type: "appointmentConfirmed",
    label: "Confirmación de reserva",
    emoji: "✅",
    defaultTemplate: DEFAULT_APPOINTMENT_CONFIRMED_TEMPLATE,
  },
  {
    type: "appointmentCancelled",
    label: "Cancelación de cita",
    emoji: "❌",
    defaultTemplate: DEFAULT_APPOINTMENT_CANCELLED_TEMPLATE,
  },
  {
    type: "appointmentReview",
    label: "Solicitud de reseña",
    emoji: "⭐",
    defaultTemplate: DEFAULT_APPOINTMENT_REVIEW_TEMPLATE,
  },
];

/** Per-business overrides, one optional custom string per template type —
 * missing/empty keys fall back to that type's default (see
 * resolveWhatsAppTemplate). Every template type shares this exact same map
 * shape and the exact same variable set, by construction: there's only one
 * substitution function (applyWhatsAppTemplate) and it doesn't know or care
 * which type it's rendering. */
export type WhatsAppTemplateMap = Partial<Record<WhatsAppTemplateType, string>>;

export function getDefaultWhatsAppTemplate(type: WhatsAppTemplateType): string {
  const def = WHATSAPP_TEMPLATE_DEFINITIONS.find((d) => d.type === type);
  if (!def) throw new Error(`Unknown WhatsApp template type: ${type}`);
  return def.defaultTemplate;
}

/** A business's effective template for one type — its own custom text if
 * it wrote one, otherwise the official default. This is the one place that
 * decides "custom vs. default", so every caller (the notify flow today,
 * any future automation) gets identical fallback behavior for free. */
export function resolveWhatsAppTemplate(
  templates: WhatsAppTemplateMap | undefined,
  type: WhatsAppTemplateType
): string {
  return templates?.[type] || getDefaultWhatsAppTemplate(type);
}

/** One entry per {variable} a template author can use — shared by every
 * template type (see buildVariableValues) and drives the on-screen variable
 * guide, so the list only needs to change in one place. Any future variable
 * added here is automatically available to every existing and future
 * template type — no per-template wiring needed. */
export const WHATSAPP_TEMPLATE_VARIABLES: { key: string; description: string }[] = [
  { key: "cliente", description: "Nombre del cliente" },
  { key: "elemento", description: "Nombre de la mascota, zona o elemento reservado" },
  { key: "servicio", description: "Servicio reservado" },
  { key: "telefono", description: "Teléfono del cliente" },
  { key: "dia", description: "Día de la semana" },
  { key: "fecha", description: "Fecha de la cita" },
  { key: "hora", description: "Hora de la cita" },
  { key: "fecha_hora", description: "Fecha y hora completas" },
  { key: "negocio", description: "Nombre del negocio" },
  { key: "review_link", description: "Enlace de reseñas del negocio" },
];

export interface WhatsAppTemplateData {
  clientName: string;
  dogName: string;
  service: string;
  phone: string;
  businessName: string;
  /** YYYY-MM-DD — the same date-key shape used everywhere else in the app
   * (see src/lib/time.ts's toDateKey/parseDateKey). */
  date: string;
  /** Minutes from 00:00 — the same unit used everywhere else in the app. */
  startMin: number;
  /** The business's configured Google Reviews (or similar) link — see
   * BusinessProfile.reviewLink. Empty string if not configured yet. */
  reviewLink?: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** All date/time formatting for the message runs through the calendar's own
 * formatDayHeading/minToLabel (src/lib/time.ts) — never a second copy of
 * that logic — so {dia}/{fecha}/{hora}/{fecha_hora} always read exactly like
 * the rest of the app. */
function buildVariableValues(data: WhatsAppTemplateData): Record<string, string> {
  const { weekday, day, month } = formatDayHeading(parseDateKey(data.date));
  const dia = capitalize(weekday);
  const fecha = `${dia} ${day} de ${month}`;
  const hora = minToLabel(data.startMin);

  return {
    cliente: data.clientName,
    // "perro" kept as an alias of "elemento" so businesses that already
    // customized a template before this generic rename keep working exactly
    // as before — see WHATSAPP_TEMPLATE_VARIABLES for the current name.
    perro: data.dogName,
    elemento: data.dogName,
    servicio: data.service,
    telefono: data.phone,
    dia,
    fecha,
    hora,
    fecha_hora: `${fecha} a las ${hora}`,
    negocio: data.businessName,
    review_link: data.reviewLink ?? "",
  };
}

/** Fills ANY template — regardless of type — with the data for one
 * appointment. Unknown placeholders (anything that isn't one of
 * WHATSAPP_TEMPLATE_VARIABLES) are left exactly as written — e.g.
 * "{direccion}" passes through untouched — so a typo in a custom template
 * never breaks message generation. This is the only place template
 * variables get substituted: the live preview in the profile editor, the
 * reschedule-notify flow today, and any future automated sender all call
 * this exact function, so they can never drift apart. */
export function applyWhatsAppTemplate(template: string, data: WhatsAppTemplateData): string {
  const values = buildVariableValues(data);
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
}

/** Fixed, fictitious appointment used to render the live preview in the
 * profile editor, for every template type — 2025-07-21 is a real Monday, so
 * {dia}/{fecha}/{fecha_hora} come out exactly as "Lunes 21 de julio ..."
 * without inventing a second, fake date system. Only {negocio} varies,
 * filled in with the business actually being edited. */
export function buildWhatsAppPreviewData(
  businessName: string,
  reviewLink?: string
): WhatsAppTemplateData {
  return {
    clientName: "José",
    dogName: "Toby",
    service: "Baño y secado",
    phone: "612345678",
    businessName,
    date: "2025-07-21",
    startMin: 630, // 10:30
    reviewLink: reviewLink || "https://g.page/r/tu-negocio/review",
  };
}
