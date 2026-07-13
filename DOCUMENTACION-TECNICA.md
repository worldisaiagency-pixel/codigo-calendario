# Documentación Técnica Oficial — Sistema de Reservas Multi-Negocio

**Estado documentado:** estado final funcional del sistema tras la sesión de correcciones que cierra con la centralización de `validateAppointment` en Apps Script y la verificación end-to-end de ambos flujos críticos.

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Flujo completo de una reserva](#3-flujo-completo-de-una-reserva)
4. [Sistema multi-tenant](#4-sistema-multi-tenant)
5. [Sistema de disponibilidad](#5-sistema-de-disponibilidad)
6. [Fuente de verdad y sincronización](#6-fuente-de-verdad-y-sincronización)
7. [Cómo añadir un nuevo negocio](#7-cómo-añadir-un-nuevo-negocio)
8. [Despliegue](#8-despliegue)
9. [Evolución del sistema](#9-evolución-del-sistema)
10. [Errores encontrados durante el desarrollo](#10-errores-encontrados-durante-el-desarrollo)
11. [Arquitectura definitiva](#11-arquitectura-definitiva)
12. [Checklist para añadir un nuevo negocio](#12-checklist-para-añadir-un-nuevo-negocio)
13. [Referencia de archivos](#13-referencia-de-archivos)

---

## 1. Resumen ejecutivo

Este proyecto es una aplicación de calendario/reservas para peluquerías caninas/felinas, multi-negocio (multi-tenant), construida sobre:

- **Frontend**: Next.js 16 (App Router), exportado como sitio estático (`output: "export"`).
- **Hosting**: Netlify, con el `out/` subido manualmente (no hay CI/CD automático desde Git).
- **Backend de escritura**: Google Apps Script Web App, único punto con permiso de escritura sobre el Google Sheet.
- **Backend de lectura**: Netlify Functions que leen el Sheet vía su exportación pública `gviz/tq?tqx=out:csv`.
- **Almacén de datos único**: un Google Sheet compartido, con dos pestañas de datos (identidad/config de negocios, y "Reservas") más una tercera ("Overrides") para cierres/bloqueos puntuales.
- **Multi-tenant**: cada negocio se identifica por el par `(negocio, usuario)`; todas las lecturas/escrituras se filtran por ese par.
- **Integraciones externas**: cada negocio puede tener su propia web (construida aparte, p. ej. en Lovable) que consume dos endpoints públicos (`availability.ts`, `create-appointment.ts`) como API REST, o puede usar el widget genérico `public/widget.js`.

El sistema ha sido verificado end-to-end (peticiones reales contra producción) para los dos flujos críticos:

- **Flujo 1** — reserva desde la web pública → aparece en el calendario del negocio correcto, sin duplicados.
- **Flujo 2** — cita creada manualmente desde el calendario → deja de ofrecerse inmediatamente en `availability.ts` y en cualquier consumidor externo.

---

## 2. Arquitectura del sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR DEL NEGOCIO                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐    │
│  │  LoginScreen   │  │  AdminPanel   │  │  Calendario (page.tsx) │    │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬────────────┘    │
└──────────┼──────────────────┼──────────────────────┼─────────────────┘
           │                  │                       │
           ▼                  ▼                       ▼
   ┌───────────────────────────────────────────────────────────┐
   │      Zustand store (src/lib/store.ts) + localStorage        │
   │      caché por negocio (appointments/dogs/owners/overrides)  │
   └───────────────────────────┬───────────────────────────────┘
                                │
                                ▼
   ┌───────────────────────────────────────────────────────────┐
   │                   NETLIFY FUNCTIONS                          │
   │  list-businesses · list-reservas · list-overrides (lectura)  │
   │  save-profile · create-appointment · availability (escritura │
   │  y lectura pública externa)                                  │
   └───────────────────────────┬───────────────────────────────┘
                                │  (solo save-profile / create-appointment)
                                ▼
   ┌───────────────────────────────────────────────────────────┐
   │           GOOGLE APPS SCRIPT WEB APP (doPost)                │
   │   validateAppointment() = autoridad final de negocio          │
   │   LockService.getScriptLock() = autoridad de concurrencia     │
   └───────────────────────────┬───────────────────────────────┘
                                │
                                ▼
   ┌───────────────────────────────────────────────────────────┐
   │                     GOOGLE SHEET (fuente de verdad)          │
   │  Hoja 1: NEGOCIO/USUARIO/WEB/SERVICIOS/HORARIOS/VACACIONES   │
   │  "Reservas": una fila por cita                               │
   │  "Overrides": una fila por cierre/bloqueo puntual            │
   └───────────────────────────┬───────────────────────────────┘
                                │ (lectura pública CSV, sin token)
                                ▼
   ┌───────────────────────────────────────────────────────────┐
   │         WEB EXTERNA DEL NEGOCIO (proyecto aparte)             │
   │  Llama a availability.ts (GET) y create-appointment.ts (POST)│
   └───────────────────────────────────────────────────────────┘
```

### 2.1. Frontend (Next.js)

- **Framework**: Next.js 16, App Router, `output: "export"` (sitio 100% estático, sin servidor Node en producción para las páginas — solo las Netlify Functions son código servidor).
- **Punto de entrada de la app privada**: [src/app/page.tsx](src/app/page.tsx) — decide qué renderizar según `useAuth()`: pantalla de login, panel de admin, o el calendario del negocio autenticado.
- **Punto de entrada de la reserva pública**: [src/app/reservar/page.tsx](src/app/reservar/page.tsx), que monta [ReservarClient](src/components/public-booking/reservar-client.tsx) — formulario de una sola pantalla con scroll (servicio → horario → datos del cliente), sin pasos numerados.
- **Estado global**: [src/lib/store.ts](src/lib/store.ts), un store Zustand con tablas locales por negocio (`createLocalTable`, en [src/lib/realtime/local-table.ts](src/lib/realtime/local-table.ts)) respaldadas en `localStorage`, más un polling de 45s (`RESERVAS_POLL_MS`) que sincroniza contra el Sheet.

### 2.2. Panel de administración

- [src/components/admin/admin-panel.tsx](src/components/admin/admin-panel.tsx): lista todos los negocios (`dataProvider.listBusinesses()`), permite crear (`BusinessCreateSheet`) y editar/eliminar (`BusinessEditSheet`).
- Acceso: credenciales hardcodeadas `negocio="worldwork"`, `usuario="2008"` en [src/lib/auth/admin.ts](src/lib/auth/admin.ts), con un throttle anti-fuerza-bruta en [src/lib/auth/admin-throttle.ts](src/lib/auth/admin-throttle.ts) (5 intentos, bloqueo 5 min). **Es una autenticación deliberadamente débil** (client-side, visible en el bundle) — documentado como tal en el propio código, no un descuido.

### 2.3. Calendario (panel del negocio)

- [src/app/page.tsx](src/app/page.tsx): vista día/semana/mes (`DayRail`, `WeekView`, `MonthView`), creación de citas (`NewAppointmentSheet`), ver disponibilidad (`AvailabilitySheet`), buscador global (`GlobalSearch`), menú del negocio (`BusinessMenuSheet`) desde el que se accede a `ProfileSheet` (servicios/horarios/vacaciones) y `ScheduleOverrideSheet` (cierres puntuales con reagendado automático).
- El "rail" (línea de tiempo del día) se construye con [src/lib/rail.ts](src/lib/rail.ts) → `buildRail()`, que combina citas + bloqueos de overrides en un único array ordenado de bloques `free`/`busy`/`blocked`/`closed`.

### 2.4. Wizard de reservas (público)

- No es un wizard de pasos: [reservar-client.tsx](src/components/public-booking/reservar-client.tsx) es un formulario de scroll único (servicio → lista de horarios reales → nombre/teléfono/mascota → confirmar).
- **Importante**: el asistente de 10 pasos ("PASO X DE 10") que pueda verse en la web de un negocio (p. ej. Solycann) **no es parte de este repositorio** — es un componente (`booking.tsx`) de un proyecto externo (Lovable) que consume `availability.ts`/`create-appointment.ts` como API. Ver sección 10 para el bug detectado ahí.

### 2.5. Netlify

- Despliegue manual: se sube la carpeta completa del proyecto (o se arrastra `out/` + `netlify/functions/`) al panel de Netlify. **No hay CI/CD automático conectado a GitHub** para el despliegue — el repositorio Git es solo para control de versiones/backup.
- `netlify.toml`: `publish = "out"`, `functions = "netlify/functions"`.

### 2.6. Netlify Functions

Todas viven en [netlify/functions/](netlify/functions/):

| Función | Método | Propósito | Requiere token |
|---|---|---|---|
| [list-businesses.ts](netlify/functions/list-businesses.ts) | GET | Proxy de lectura de la hoja de identidad — evita que `SHEET_ID` viaje al bundle del cliente | No |
| [list-reservas.ts](netlify/functions/list-reservas.ts) | GET | Proxy de lectura de "Reservas" filtrado por `negocio`+`usuario` | No |
| [list-overrides.ts](netlify/functions/list-overrides.ts) | GET | Proxy de lectura de "Overrides" filtrado por `negocio`+`usuario` | No |
| [availability.ts](netlify/functions/availability.ts) | GET | Endpoint público de disponibilidad — CORS abierto, pensado para ser llamado desde cualquier web externa | No |
| [create-appointment.ts](netlify/functions/create-appointment.ts) | POST | Endpoint público de creación de cita — contrato JSON limpio en inglés, para webs externas | No (pero reenvía al Apps Script que sí lo exige) |
| [save-profile.ts](netlify/functions/save-profile.ts) | POST | Passthrough genérico de acciones (perfil, negocio, citas, overrides) hacia Apps Script — usado por la app interna y `/reservar` | Sí (server-side, nunca llega al navegador) |
| [push-subscribe.ts](netlify/functions/push-subscribe.ts) / [push-unsubscribe.ts](netlify/functions/push-unsubscribe.ts) | POST | Suscripción/baja de notificaciones push (Netlify Blobs + VAPID) | No |
| [lib/apps-script-bridge.ts](netlify/functions/lib/apps-script-bridge.ts) | — | Helper compartido: añade el token server-side y reenvía a Apps Script | — |

**Responsabilidad clave**: las Netlify Functions son solo un *proxy*. No toman ninguna decisión de negocio (no deciden si una cita "puede" crearse) — eso es exclusivamente responsabilidad de Apps Script. Su única lógica propia es UX (pre-checks para dar feedback rápido) y ocultar el `SHEET_ID`/token.

### 2.7. Google Apps Script

Único archivo: [scripts/sheet-write-apps-script.js](scripts/sheet-write-apps-script.js) (~800 líneas). Es la **autoridad final absoluta** sobre toda escritura al Sheet. Dispatcher único (`doPost`) que valida el token compartido y despacha por `action`:

```
saveProfile · updateIdentity · createBusiness · deleteBusiness ·
createAppointment · updateAppointment · deleteAppointment ·
createOverride · deleteOverride · reformatSeparators
```

**La función central es `validateAppointment(...)`** (añadida en la última fase de correcciones): es la única autoridad sobre si una cita puede escribirse. La llaman tanto `handleCreateAppointment` como `handleUpdateAppointment` (esta última solo cuando cambia fecha/hora/duración/servicio), siempre bajo el mismo `LockService.getScriptLock()`. Valida, en este orden:

1. **Existencia del negocio** (`findBlock` sobre la hoja de identidad) → `business_not_found`.
2. **Servicio registrado y duración exacta** (parseo propio de `SERVICIOS`, portado a mano desde `sheets-provider.ts` porque Apps Script no puede importar TS) → `service_not_found` / `invalid_duration`.
3. **Horario del día** (parseo de `HORARIOS`, con vacaciones aplicadas) → si no hay horario ese día, `schedule_blocked`; si el rango pedido cae fuera de horario, `outside_hours`.
4. **Overrides** (`closed` sustituye el día entero, `hours` sustituye la ventana, `block` recorta un sub-rango) → `schedule_blocked`.
5. **Solapes con otras citas** (`findConflictingAppointment`, con `excludeId` para que un reagendado no choque consigo mismo) → `slot_taken`.

### 2.8. Google Sheets

- **Hoja 1 (sin nombre fijo, "primera hoja")**: bloques verticales `NEGOCIO`/`USUARIO`/`WEB`/`SERVICIOS`/`HORARIOS`/`VACACIONES` apilados, uno por negocio, separados visualmente con un borde amarillo.
- **"Reservas"**: una fila por cita — `ID, NEGOCIO, USUARIO, FECHA, INICIO_MIN, DURACION_MIN, SERVICIO, CLIENTE, TELEFONO, PERRO, RAZA, ESTADO, ORIGEN, EMAIL, NOTAS`.
- **"Overrides"**: una fila por cierre/bloqueo puntual — `ID, NEGOCIO, USUARIO, FECHA, KIND, OPEN_MIN, CLOSE_MIN, BLOCK_START, BLOCK_END, NOTE`.
- Todas las celdas se fuerzan a formato texto plano (`setNumberFormat("@")`) antes de escribir, para que Sheets nunca reinterprete `"2026-07-15"` como fecha real y la reformatee en la exportación CSV.
- Lectura pública sin autenticación vía `https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?tqx=out:csv&sheet=<nombre>` (o `&gid=<gid>` para la primera hoja).

### 2.9. Widget

[public/widget.js](public/widget.js): script vanilla JS sin dependencias, para negocios que no tienen web propia con integración a medida. Se pega como `<script src=".../widget.js" data-negocio="X" data-usuario="Y" defer>` y añade un botón flotante "Reservar cita" que enlaza a `/reservar?negocio=X&usuario=Y`. Generado automáticamente por [src/lib/booking-link.ts](src/lib/booking-link.ts) (`bookingEmbedSnippet`), copiable desde el panel de admin al crear/editar un negocio.

### 2.10. Sistema multi-tenant

Cada negocio se identifica por el par `(negocio, usuario)` — nunca por un ID numérico autoincremental. Ese par se usa para:
- Filtrar filas del Sheet en cada lectura (`fetchReservas(negocio, usuario)`, `fetchOverrides(negocio, usuario)`).
- Encontrar el bloque de identidad correcto en Apps Script (`findBlock(data, negocio, usuario)`).
- Construir el `id` local del negocio en el frontend: `slug(negocio + "__" + usuario)` (ver `sheets-provider.ts`).
- Aislar la caché local: cada tabla de `localStorage` se namespacea como `appointments:${business.id}`, `scheduleOverrides:${business.id}`, etc.

No hay ningún otro mecanismo de aislamiento (no hay Row Level Security real, no hay base de datos con claves foráneas) — el aislamiento es por convención de filtrado en cada punto de lectura/escritura.

---

## 3. Flujo completo de una reserva

### 3.1. Flujo 1 — Reserva desde la web pública

```
Cliente                                                    Archivo
   │
   │ 1. Abre /reservar?negocio=X&usuario=Y (o la web externa
   │    del negocio con su propio formulario)
   ▼
Frontend (ReservarClient)                        src/components/public-booking/reservar-client.tsx
   │
   │ 2. dataProvider.listBusinesses() → busca el negocio      src/lib/data/proxied-reads.ts
   │    por (negocio, usuario)
   │ 3. fetchReservas(negocio, usuario) +                     src/lib/data/proxied-reads.ts
   │    fetchOverrides(negocio, usuario) — huecos reales
   │ 4. findAvailableSlots({..., allSlotsPerGap:true})        src/lib/availability.ts
   │    → lista de horarios reales, uno cada 30 min
   │
   │ 5. Cliente elige servicio + horario + rellena datos
   │ 6. Al confirmar: re-fetch de reservas frescas y
   │    re-chequeo local del hueco (fast-fail UX, no autoridad)
   ▼
Netlify Function (POST)                          netlify/functions/save-profile.ts
   │  body: { action:"createAppointment", id (uuid), negocio,
   │          usuario, fecha, inicioMin, duracionMin, servicio,
   │          cliente, telefono, perro, raza, estado:"confirmed",
   │          origen:"web" }
   │
   │ 7. Valida que action esté en ALLOWED_ACTIONS (allowlist)
   │ 8. Añade el token secreto server-side (nunca visible al
   │    navegador) y reenvía                                  netlify/functions/lib/apps-script-bridge.ts
   ▼
Google Apps Script (doPost)                       scripts/sheet-write-apps-script.js
   │
   │ 9. Verifica token compartido
   │ 10. LockService.getScriptLock() — bloqueo atómico
   │ 11. validateAppointment(...) — AUTORIDAD FINAL:
   │     negocio existe, servicio+duración correctos,
   │     dentro de horario, sin overrides bloqueando,
   │     sin solape con otra cita
   │ 12. Si todo ok: escribe fila en "Reservas" (texto plano)
   │ 13. lock.releaseLock()
   ▼
Google Sheet — pestaña "Reservas"
   │
   │ 14. Nueva fila visible inmediatamente vía CSV público
   ▼
Calendario del negocio (si tiene sesión abierta)   src/lib/store.ts
   │
   │ 15. pullReservas() en su ciclo de polling (cada 45s)
   │     → fetchReservas() + mergeRemoteAppointment()
   │     (inserción idempotente por id — sin duplicados)
   ▼
Disponibilidad actualizada
   │  Cualquier nueva llamada a availability.ts o al propio
   │  /reservar vuelve a leer el Sheet ya con la cita nueva
   │  incluida en el cálculo de huecos ocupados.
```

**JSON real de ejemplo** (lo que envía `save-profile.ts` a Apps Script, con el token ya añadido server-side):

```json
{
  "action": "createAppointment",
  "id": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "negocio": "Solycann",
  "usuario": "Solycann",
  "fecha": "2026-07-13",
  "inicioMin": 600,
  "duracionMin": 30,
  "servicio": "Baño y secado",
  "cliente": "María López",
  "telefono": "600111222",
  "perro": "Toby",
  "raza": "Yorkshire",
  "estado": "confirmed",
  "origen": "web",
  "token": "<SHEET_WRITE_TOKEN, nunca visible en el navegador>"
}
```

**Respuesta de éxito**: `{"ok": true, "id": "3f2504e0-..."}`
**Respuesta de rechazo** (ejemplos reales de `validateAppointment`): `{"ok": false, "error": "slot_taken"}`, `{"ok": false, "error": "schedule_blocked"}`, `{"ok": false, "error": "outside_hours"}`.

### 3.2. Flujo 2 — Cita creada manualmente desde el calendario

```
Negocio (calendario)                              src/app/page.tsx
   │
   │ 1. Toca un hueco libre → NewAppointmentSheet     src/components/appointment/new-appointment-sheet.tsx
   │ 2. Rellena cliente/mascota/servicio
   ▼
Zustand store — addAppointment()                  src/lib/store.ts
   │
   │ 3. Inserta optimistamente en la tabla local
   │    (localStorage) — el calendario se actualiza
   │    al instante para ESTE dispositivo
   │ 4. Llama a createAppointmentInSheet({..., origen:"app"}) src/lib/data/sheets-writer.ts
   ▼
Netlify Function → Apps Script → Google Sheet
   │  (mismo camino y misma validateAppointment() que el Flujo 1)
   │
   │ 5. Si Apps Script rechaza (p. ej. slot_taken): rollback —
   │    se elimina la inserción optimista local              src/lib/store.ts (addAppointment)
   ▼
Google Sheet — pestaña "Reservas" (fila nueva)
   │
   │ 6. Visible inmediatamente vía CSV público — sin caché
   ▼
availability.ts (Netlify Function)                netlify/functions/availability.ts
   │
   │ 7. Cada petición GET vuelve a leer fetchReservas() +
   │    fetchOverrides() en fresco — sin caché — y recalcula
   │    findAvailableSlots() desde cero
   ▼
Web pública / cualquier consumidor externo
   │  El hueco recién ocupado deja de aparecer en la
   │  siguiente respuesta de availability.ts — verificado
   │  empíricamente: sin retraso, sin caché intermedia.
```

**Verificación empírica realizada** (con `netlify dev` real contra el Sheet de producción "Solycann"): se escribió una cita de prueba simulando `origen:"app"`, se confirmó que `list-reservas.ts` (lo que sondea el calendario) la devolvía inmediatamente, y que `availability.ts` dejaba de ofrecer ese slot exacto en la siguiente petición. Ambas filas de prueba se limpiaron después (`deleteAppointment`), sin dejar residuo en el Sheet real.

### 3.3. Por qué no hay reservas duplicadas

- **Entre web y calendario**: ambos escriben a la MISMA pestaña "Reservas" a través del MISMO `handleCreateAppointment`, bajo el MISMO lock. No hay dos tablas distintas que puedan divergir.
- **Entre dos clientes reservando el mismo hueco a la vez**: `LockService.getScriptLock()` serializa todo `handleCreateAppointment`/`handleUpdateAppointment` — el segundo request re-lee el Sheet (ya con la escritura del primero aplicada) antes de decidir, nunca contra una foto obsoleta.
- **En la caché local del calendario**: `mergeRemoteAppointment()` es idempotente por `id` — si una fila ya existe en la tabla local, no se vuelve a insertar.

---

## 4. Sistema multi-tenant

Ver sección 2.10 para el mecanismo. Puntos operativos clave:

- El **login** ([src/components/auth/login-screen.tsx](src/components/auth/login-screen.tsx)) compara `(negocio, usuario)` contra `dataProvider.listBusinesses()`, sin distinguir mayúsculas/minúsculas.
- La **sesión** ([src/lib/auth/session.ts](src/lib/auth/session.ts)) se guarda en `localStorage` como `{kind:"business", businessId, negocio, usuario}` o `{kind:"admin"}`.
- Al restaurar sesión (`use-auth.ts`), se vuelve a pedir la lista de negocios y se busca por `businessId` — si el negocio ya no existe (borrado desde el panel de admin), la sesión se limpia automáticamente.
- **No existe autenticación real de negocio** — el "login" es solo un lookup por nombre; cualquiera que conozca el par `(negocio, usuario)` de otro negocio podría "iniciar sesión" como él. Esto es una limitación conocida y aceptada del proyecto, coherente con el resto del modelo de seguridad (ver sección 11).

---

## 5. Sistema de disponibilidad

### 5.1. Piezas involucradas

| Archivo | Responsabilidad |
|---|---|
| [src/lib/data/schedule.ts](src/lib/data/schedule.ts) | `scheduleForDate()` — horario base de un día, aplicando vacaciones |
| [src/lib/data/schedule-overrides.ts](src/lib/data/schedule-overrides.ts) | `resolveDay()` — compone el horario base con los overrides de ese día |
| [src/lib/rail.ts](src/lib/rail.ts) | `buildRail()` — convierte horario + citas + bloqueos en una lista ordenada de bloques `free`/`busy`/`blocked`/`closed` |
| [src/lib/availability.ts](src/lib/availability.ts) | `findAvailableSlots()` — recorre días hacia adelante y extrae huecos reservables de los bloques `free` |
| [netlify/functions/availability.ts](netlify/functions/availability.ts) | Expone todo lo anterior como endpoint público GET |

### 5.2. `findAvailableSlots()` en detalle

```ts
findAvailableSlots({
  business, scheduleOverrides, appointments, dogById, ownerById,
  durationMin, rangeStart, rangeEnd, limit, allSlotsPerGap,
})
```

Por cada día entre `rangeStart` y `rangeEnd`:
1. `resolveDay(business, scheduleOverrides, día)` → horario efectivo + bloques manuales de override.
2. Si no hay horario ese día (cerrado, vacaciones, override `"closed"`) → se salta el día entero.
3. `buildRail(...)` → lista de bloques del día.
4. Por cada bloque `free` con hueco suficiente para `durationMin`:
   - **Modo por defecto** (`allSlotsPerGap: false`, usado por el panel interno "Ver disponibilidad"): un único resultado, el inicio más temprano del hueco — deliberado, para repartir resultados entre huecos/días distintos.
   - **Modo `allSlotsPerGap: true`** (usado por `/reservar`, `availability.ts` y el pre-check de `create-appointment.ts`): un resultado cada 30 minutos (`SLOT_STEP_MIN`) dentro del hueco — necesario para que un cliente externo pueda elegir una hora concreta, no solo "la primera libre".

### 5.3. Cómo afectan horarios, vacaciones, overrides y citas

- **Horarios** (`business.hours[weekday]`): definen la ventana `open`/`close` de cada día de la semana.
- **Vacaciones** (`business.vacations`): rango de fechas `YYYY-MM-DD` que anula el horario de esos días (`scheduleForDate` devuelve `null`).
- **Overrides** (`ScheduleOverride[]`, tabla "Overrides"):
  - `kind: "closed"` → anula el horario ese día completo.
  - `kind: "hours"` → sustituye `open`/`close` ese día.
  - `kind: "block"` → recorta un sub-rango dentro de un día por lo demás normal (ocupa espacio igual que una cita, en `buildRail`).
- **Citas existentes**: se marcan como bloques `busy` en `buildRail`, restando del espacio libre.

### 5.4. Cómo se evita una doble reserva — validaciones por capa

| Capa | Qué valida | Autoridad real |
|---|---|---|
| **Frontend** (`reservar-client.tsx`) | Re-fetch de reservas justo antes de enviar + comprobación local de solape | No — solo UX (mensaje rápido "ese hueco se acaba de ocupar") |
| **Netlify Function** (`create-appointment.ts`) | Pre-check de solape contra `fetchReservas` fresco | No — solo fast-fail antes del roundtrip a Apps Script |
| **Apps Script** (`validateAppointment`, bajo `LockService`) | Negocio existe, servicio+duración, horario, vacaciones, overrides, solape con otras citas | **Sí — autoridad final absoluta** |

La razón de esta separación: el frontend y las Netlify Functions dan feedback rápido (evitan un roundtrip innecesario en el caso común), pero **ninguno de los dos puede impedir que alguien llame directamente al endpoint** con una petición HTTP fabricada a mano. Solo Apps Script, protegido por el token compartido y ejecutando bajo un lock atómico contra el propio Sheet, es la autoridad que de verdad decide si la cita se escribe.

---

## 6. Fuente de verdad y sincronización

### 6.1. Por qué Google Sheets es la única fuente de verdad

- Es el único almacén que **todos** los consumidores (calendario interno, `/reservar`, webs externas, widget) leen — no hay una base de datos intermedia ni una caché de servidor compartida.
- Cualquier caché local (Zustand + `localStorage`) es **desechable y reconstruible** en cualquier momento a partir del Sheet — nunca al revés. Esto es explícito en el código: cuando Apps Script rechaza una escritura, el store hace *rollback* de la inserción optimista local (ver `addAppointment`/`updateAppointment` en `store.ts`).
- No hay ID autoincremental de base de datos: los `id` de citas y overrides son UUIDs generados en el cliente (`crypto.randomUUID()`), lo que permite que una fila creada desde cualquier dispositivo/origen (app, web, widget) tenga una clave única sin coordinación central.

### 6.2. Cómo se sincronizan los distintos consumidores

| Consumidor | Mecanismo de sincronización | Frecuencia |
|---|---|---|
| Calendario interno (`store.ts`) | Polling (`pullReservas`) → `fetchReservas` + `fetchOverrides` → merge idempotente | Cada 45s (`RESERVAS_POLL_MS`) + al cargar el negocio |
| `/reservar` (`reservar-client.tsx`) | Fetch único al cargar + re-fetch justo antes de confirmar | Bajo demanda |
| `availability.ts` | Lee el Sheet en fresco en cada petición GET, sin caché | Cada petición |
| `create-appointment.ts` | Pre-check con fetch fresco antes de reenviar a Apps Script | Cada petición |
| Apps Script | Lee la hoja con `getDataRange().getValues()` dentro del propio lock, siempre la versión más reciente | Cada escritura |

No existe un mecanismo de push/websockets — todo es *pull* (polling o fetch bajo demanda). Esto es deliberado: mantiene la arquitectura simple (sin servidor persistente) a costa de una latencia máxima de sincronización de 45s en el peor caso para el calendario interno viendo cambios hechos desde otro dispositivo — la escritura en sí, y su efecto sobre disponibilidad pública, es instantánea (sin caché).

---

## 7. Cómo añadir un nuevo negocio

### Paso 1 — Crear el negocio desde el panel de administración

1. Entra en la app con las credenciales de administrador (`negocio: worldwork`, `usuario: 2008`) desde la pantalla de login normal.
2. Se muestra el [AdminPanel](src/components/admin/admin-panel.tsx) con la lista de negocios existentes.
3. Pulsa el botón **"+"** (esquina superior derecha) → abre [BusinessCreateSheet](src/components/admin/business-create-sheet.tsx).
4. Rellena:
   - **Negocio** (obligatorio) — el nombre visible, p. ej. `"Peluquería Rex"`.
   - **Usuario** (obligatorio) — la credencial de login de ese negocio, p. ej. `"rex2026"`.
   - **Link de la página web** (opcional) — se guarda como referencia, no afecta a la lógica.
5. Pulsa **"Crear negocio"**.

**Qué ocurre internamente**: `createBusinessInSheet({negocio, usuario, websiteUrl})` → POST a `save-profile.ts` con `action:"createBusiness"` → Apps Script `handleCreateBusiness`:
- Comprueba que no exista ya un bloque con ese `(negocio, usuario)` (`findBlock`) → si existe, `{ok:false, error:"already exists"}`.
- Añade un bloque nuevo al final de la hoja de identidad:
  ```
  NEGOCIO   | Peluquería Rex
  USUARIO   | rex2026
  WEB       | (lo que se haya puesto)
  SERVICIOS | (vacío)
  HORARIOS  | (vacío)
  VACACIONES| (vacío)
  ```
- Redibuja los separadores visuales (`applySeparatorBorders`).

**Qué usuario se genera**: ninguno adicional — el propio valor `usuario` introducido ES la credencial de login (junto con `negocio`). No hay contraseña separada.

**Cómo queda identificado el negocio**: por el `id` calculado en el cliente como `slug("Peluquería Rex__rex2026")` (función `slug()` en `sheets-provider.ts`) — se usa como clave de las tablas locales (`appointments:<id>`, etc.), nunca se escribe en el Sheet.

Tras crear el negocio, la pantalla muestra el **enlace de reserva** (`bookingUrl`) y el **snippet del widget** (`bookingEmbedSnippet`), listos para copiar.

### Paso 2 — Primer login del negocio y configuración de perfil

1. El negocio nuevo inicia sesión con `(negocio, usuario)` recién creados.
2. Como su perfil está vacío (`isProfileConfigured()` devuelve `false`), la app abre automáticamente [ProfileSheet](src/components/business/profile-sheet.tsx) (ver `page.tsx`, efecto `checkedProfileFor`).

#### 2.1. Servicios

En `ProfileSheet` → sección "Servicios" → "Añadir servicio": nombre, precio (texto libre, p. ej. `"25€"`) y duración en minutos.

**Dónde se guardan**: al pulsar "Guardar", `updateProfile({services, hours, vacations})` (store.ts) llama a `saveProfileToSheet(...)` → Apps Script `action:"saveProfile"` → `handleSaveProfile` reescribe el bloque `SERVICIOS` completo con líneas con el formato `"Nombre · Precio · Duración"` (p. ej. `"Baño y secado · 25€ · 30min"`), generado por `formatServiceLine()` en [src/lib/data/sheet-format.ts](src/lib/data/sheet-format.ts).

**Cómo llegan al formulario público**: `sheetsProvider.listBusinesses()` → `parseServiceLine()` en `sheets-provider.ts` reconstruye `{name, priceLabel, durationMin}` a partir de esa misma línea de texto — el mismo formato se parsea también en Apps Script (`parseServiceLineGAS`) para validar duraciones en `validateAppointment`.

#### 2.2. Horarios

En `ProfileSheet` → sección "Horarios": un switch abrir/cerrar por día de la semana, con selectores de hora `open`/`close` cuando está abierto.

**Cómo se almacenan**: `formatHoursCompact()` genera una única línea compacta, p. ej. `"Lunes a Viernes 9:00-19:00, Sábado 10:00-14:00, Domingo cerrado"` — colapsando días consecutivos con el mismo horario. Se guarda en la celda `HORARIOS` del bloque del negocio.

**Cómo afectan a la disponibilidad**: `parseHours()` (cliente, en `sheets-provider.ts`) y `parseHoursGAS()` (Apps Script, portado a mano) reconstruyen `Record<Weekday, {open,close}|null>` — usado por `scheduleForDate()`/`resolveDay()` para determinar la ventana reservable de cada día.

#### 2.3. Vacaciones

En `ProfileSheet` → sección "Vacaciones": selector de fecha inicio/fin → "Añadir".

**Cómo se almacenan**: `formatVacationLine()` genera una línea `"dd/mm/yyyy - dd/mm/yyyy"` por cada rango, en la celda `VACACIONES`.

**Cómo afectan al cálculo**: `scheduleForDate()` comprueba si la fecha cae dentro de cualquier rango de vacaciones (`dateKey >= v.start && dateKey <= v.end`) y, si es así, devuelve `null` (día cerrado) independientemente del horario semanal.

#### 2.4. Overrides (cierres/bloqueos puntuales)

Desde el calendario del negocio: menú del negocio (`BusinessMenuSheet`) → "Modificar horario temporalmente" → [ScheduleOverrideSheet](src/components/business/schedule-override-sheet.tsx).

**Cómo funcionan**: se elige uno o varios días + un tipo (`Cerrar completamente` = `kind:"closed"`, `Bloquear unas horas` = `kind:"block"`, `Ampliar/Modificar horario` = `kind:"hours"`). Si el cambio desplaza citas ya confirmadas, [src/lib/rebooking.ts](src/lib/rebooking.ts) (`planScheduleChange`) busca automáticamente el hueco más cercano para reubicarlas (`findAvailableSlots` con `limit:1`), mostrando un resumen antes de confirmar.

**Cómo se sincronizan**: `addScheduleOverride()` (store.ts) inserta primero en la tabla local (reacción instantánea en este dispositivo) y llama a `createOverrideInSheet(...)` → Apps Script `action:"createOverride"` → escribe una fila en la pestaña "Overrides". El polling de 45s (`pullReservas`) trae también `fetchOverrides()` y las mezcla vía `mergeRemoteOverride()` (idempotente), para que otros dispositivos y la web pública se enteren.

**Qué ocurre internamente al validar una cita nueva**: `validateAppointment()` en Apps Script lee la pestaña "Overrides" filtrando por `(negocio, usuario, fecha)` y aplica la misma composición que `resolveDay()` en el cliente (closed anula, hours sustituye, block se acumula) — así ninguna cita puede crearse por API directa saltándose un cierre puntual.

### Paso 3 — Configurar la web del negocio

Hay dos caminos, no excluyentes:

#### 3.1. Widget genérico (`public/widget.js`)

Copiar el snippet generado en el panel de admin (`bookingEmbedSnippet`):
```html
<script src="https://<dominio-del-calendario>/widget.js" data-negocio="Peluquería Rex" data-usuario="rex2026" defer></script>
```
Pegarlo una vez en el HTML de la web del negocio. Añade un botón flotante "Reservar cita" que enlaza a `/reservar?negocio=Peluquería%20Rex&usuario=rex2026`.

#### 3.2. Integración a medida (web propia, p. ej. Lovable)

La web propia debe:
1. Fijar dos constantes con el `negocio` y `usuario` **exactos** tal como están en el Sheet (la comparación es insensible a mayúsculas/minúsculas, pero deben coincidir en el resto).
2. Fijar la URL base del calendario desplegado (`CALENDAR_APP_BASE`).
3. Llamar a `GET {CALENDAR_APP_BASE}/.netlify/functions/availability?negocio=<negocio>&usuario=<usuario>&service=<nombre servicio>` para obtener servicios y huecos.
4. Llamar a `POST {CALENDAR_APP_BASE}/.netlify/functions/create-appointment` con este JSON exacto para confirmar una reserva:

```json
{
  "business": "Peluquería Rex",
  "user": "rex2026",
  "ownerName": "María López",
  "petName": "Toby",
  "breed": "Yorkshire",
  "phone": "600111222",
  "service": "Baño y secado",
  "date": "2026-07-20",
  "time": "10:00",
  "email": "maria@example.com",
  "notes": "Un poco nervioso con el secador"
}
```

Campos obligatorios: `business, user, ownerName, petName, phone, service, date, time`. `email`/`breed`/`notes` son opcionales. Respuesta de éxito: `{"ok":true,"id":"<uuid>"}`. Errores posibles: `missing_fields`, `invalid_date`, `invalid_time`, `business_not_found`, `service_not_found`, `slot_taken` (409), o cualquier código devuelto por `validateAppointment` reenviado desde Apps Script.

**Ejemplo real de referencia**: `lovable-project-74008ed0/src/components/booking.tsx` (proyecto externo, no forma parte de este repositorio) — sus dos constantes clave son:
```ts
const NEGOCIO = "Solycann";
const USUARIO = "solycann";
const CALENDAR_APP_BASE = "https://fanciful-baklava-356797.netlify.app";
```

### Paso 4 — Conectar la web al calendario (verificación)

No requiere ninguna acción adicional: en cuanto la web externa usa el `(negocio, usuario)` correcto contra la URL del calendario correcta, toda reserva hecha desde ella pasa por el mismo `create-appointment.ts` → mismo Apps Script → misma pestaña "Reservas" que lee el calendario interno. La "conexión" es, en esencia, que ambos apunten al mismo Sheet a través del mismo `(negocio, usuario)`.

---

## 8. Despliegue

| Tipo de cambio | ¿Redeploy del calendario (Netlify)? | ¿Redeploy de la web del negocio? | ¿Nueva versión del Apps Script? |
|---|---|---|---|
| Cambio en `scripts/sheet-write-apps-script.js` (validaciones, nuevas acciones, LockService) | No | No | **Sí, obligatorio** |
| Cambio en `netlify/functions/*.ts` (nuevos endpoints, cambios de contrato) | **Sí** | Solo si el contrato JSON cambió | No |
| Cambio en `src/lib/*.ts` o componentes React (UI, `findAvailableSlots`, store) | **Sí** | No | No |
| Cambio de servicios/horarios/vacaciones/overrides de un negocio (vía panel) | No | No | No |
| Alta de un nuevo negocio (vía panel de admin) | No | No (solo si esa web aún no existe, hay que crearla/desplegarla) | No |
| Cambio en `booking.tsx` u otro código de la web externa de un negocio | No | **Sí** | No |
| Cambio del `SHEET_WRITE_TOKEN` o `SHEET_WRITE_URL` (rotación de secretos) | **Sí** (variables de entorno de Netlify) | No | No (el token vive en el propio script, revisar que coincida) |

**Cómo desplegar cada pieza:**

- **Calendario (Netlify)**: `npm run build` genera `out/`; se sube manualmente (arrastrar carpeta) al sitio de Netlify correspondiente, o se actualiza vía el panel de Netlify. Las Netlify Functions (`netlify/functions/`) se despliegan en el mismo paso.
- **Apps Script**: abrir el Google Sheet → Extensiones → Apps Script → pegar el contenido actualizado de `scripts/sheet-write-apps-script.js` (sustituyendo `SHARED_TOKEN` por el valor real, que **nunca** se commitea) → Desplegar → Gestionar implementaciones → icono de lápiz → Versión: "Nueva versión" → Desplegar. Esto mantiene la misma URL del Web App.
- **Web del negocio**: depende de dónde esté alojada (Lovable, Netlify propio, etc.) — seguir su propio proceso de build/deploy.

**Importante**: los tres componentes (calendario, Apps Script, web del negocio) se despliegan de forma **completamente independiente y manual**. No existe ningún pipeline que los sincronice automáticamente — es responsabilidad del operador recordar desplegar Apps Script después de cada cambio en `sheet-write-apps-script.js`, ya que de lo contrario las validaciones nuevas (p. ej. `validateAppointment`) no estarán activas en producción aunque el resto del sistema sí las tenga en el código fuente.

---

## 9. Evolución del sistema

### Arquitectura inicial

El proyecto arrancó como una app de calendario **de un solo negocio**, con datos de ejemplo en memoria (`src/lib/mock-data.ts`), sin backend real, sin Google Sheets, sin multi-tenant. La disponibilidad (`findAvailableSlots`) devolvía un único resultado por hueco libre, pensado solo para el uso interno del propio negocio viendo "próximos huecos".

### Evolución cronológica

1. **De datos mock a Google Sheets como backend real**
   → Se introdujo `src/lib/data/` (types, provider, sheets-provider) para leer un Sheet público vía CSV, y `sheets-writer.ts` + Apps Script para escribir. Esto convirtió la app de un prototipo a un sistema con persistencia real compartible entre dispositivos.

2. **De un solo negocio a multi-tenant**
   → Se rediseñó `store.ts` para tener tablas locales por negocio (`createLocalTable`), se añadió el login por `(negocio, usuario)`, y todas las lecturas/escrituras empezaron a filtrar por ese par. Se añadieron horarios/vacaciones por negocio (antes globales).

3. **Aparición del panel de administración**
   → Antes, crear un negocio nuevo requería editar el Sheet a mano. Se construyó `AdminPanel` + `BusinessCreateSheet`/`BusinessEditSheet`, con credenciales de admin hardcodeadas (aceptado como límite conocido, no un descuido).

4. **Reserva pública (`/reservar`) y luego integración externa**
   → Primero se construyó `/reservar` como única vía pública. Después, para permitir que cada negocio tuviera su propia web con su propio diseño, se crearon los endpoints públicos `availability.ts` y `create-appointment.ts` con contrato JSON limpio, desacoplados de la implementación interna.

5. **`scheduleOverrides` — de solo localStorage a sincronizado en el Sheet**
   → *Antes*: los cierres puntuales ("hoy cierro antes", "urgencia de 19 a 20h") solo vivían en `localStorage` de un dispositivo — invisibles para la web pública y para cualquier otro dispositivo del mismo negocio.
   → *Problema*: un cliente podía reservar en un horario que el negocio creía haber bloqueado.
   → *Detectado*: durante la revisión de arquitectura completa solicitada explícitamente por el usuario.
   → *Solución*: nueva pestaña "Overrides" en el Sheet, endpoints `createOverride`/`deleteOverride` en Apps Script, `list-overrides.ts` como proxy de lectura, y `fetchOverrides()` integrado en `availability.ts`, `reservar-client.tsx` y el propio `validateAppointment()`.
   → *Estado final*: los overrides son datos compartidos de primera clase, con la misma autoridad que horarios/vacaciones.

6. **`allSlotsPerGap` en `findAvailableSlots`**
   → *Antes*: un único slot por hueco libre (pensado para el panel interno "Ver disponibilidad", que reparte resultados por distintos huecos/días a propósito).
   → *Problema*: la web pública solo ofrecía "la primera hora libre" de cada hueco, nunca "las 10:30" si el hueco empezaba a las 10:00 — un defecto real para un cliente que necesita elegir hora.
   → *Solución*: parámetro opcional `allSlotsPerGap`, activado solo en los consumidores públicos (`/reservar`, `availability.ts`, pre-check de `create-appointment.ts`), sin tocar el comportamiento del panel interno.

7. **Exposición de `SHEET_ID` en el bundle del cliente → proxy de lecturas**
   → *Antes*: `sheets-provider.ts`/`reservas-sync.ts` se importaban directamente desde componentes cliente, lo que enviaba el `SHEET_ID`/`gid` al bundle JS público — cualquiera podía construir la misma URL CSV y leer todos los negocios de golpe.
   → *Detectado*: en la revisión de código completa.
   → *Solución*: `list-businesses.ts`, `list-reservas.ts`, `list-overrides.ts` como Netlify Functions server-side, y `proxied-reads.ts` como nueva implementación de `DataProvider` para el cliente. `sheets-provider.ts`/`reservas-sync.ts`/`overrides-sync.ts` pasaron a usarse solo desde código servidor.
   → *Estado final*: el `SHEET_ID` ya no aparece en ningún archivo de `out/` (verificado con build + grep). **Límite conocido**: el Sheet sigue siendo de acceso público por enlace — esto reduce la exposición, no la elimina del todo.

8. **`LockService` — de solo creación a creación + actualización + borrado**
   → *Antes*: `handleCreateAppointment` ya tenía lock y chequeo de solape; `handleUpdateAppointment`/`handleDeleteAppointment` no tenían ninguna protección de concurrencia.
   → *Problema*: un reagendado podía aterrizar silenciosamente encima de otra cita sin ningún chequeo.
   → *Solución*: mismo patrón de lock extendido a los tres handlers, con `findConflictingAppointment(..., excludeId)` para que un reagendado no se bloquee a sí mismo.

9. **`updateAppointment` en el store — de fire-and-forget a await + rollback**
   → *Antes*: `updateAppointment` escribía local y disparaba la escritura al Sheet sin esperar respuesta ni manejar el fallo.
   → *Problema*: inconsistente con `addAppointment` (que sí esperaba y revertía), y un fallo de Apps Script podía dejar el calendario local mostrando algo que el Sheet había rechazado.
   → *Solución*: `updateAppointment` ahora es `async`, espera `updateAppointmentInSheet`, y revierte la tabla local si `result.ok` es `false`. El único call site (`schedule-override-sheet.tsx`) se adaptó para esperar cada movimiento y mostrar un resumen de fallos.

10. **`save-profile.ts` — de aceptar cualquier `action` a un allowlist**
    → *Antes*: cualquier valor de `action` se reenviaba tal cual a Apps Script.
    → *Solución*: `ALLOWED_ACTIONS` explícito; se eliminó además el CORS abierto (innecesario, ya que este endpoint solo lo llama la propia app, nunca terceros — para eso está `create-appointment.ts`).
    → *Límite conocido, documentado explícitamente*: esto no es autenticación real de llamador — solo defensa en profundidad contra acciones inesperadas.

11. **Centralización de reglas de negocio en Apps Script (`validateAppointment`)**
    → *Antes*: `handleCreateAppointment` tenía su propio chequeo de solape; `handleUpdateAppointment` otro casi idéntico; ninguno validaba horarios/vacaciones/overrides/duración de servicio — esas reglas solo existían del lado del frontend (UX), no de la autoridad final.
    → *Problema*: una llamada directa a la API (sin pasar por la UI) podía crear una cita en un horario bloqueado por un override, o con una duración inventada.
    → *Solución*: una única función `validateAppointment(...)`, autoridad absoluta, reutilizada por ambos handlers bajo el mismo lock. Ver sección 2.7 para el detalle completo.
    → *Verificación*: harness Node (`vm` con stubs de `SpreadsheetApp`/`LockService`) con 15 casos sobre el validador + 6 casos a nivel de handler completo, todos con el resultado esperado, antes de dar el cambio por bueno.

12. **Verificación end-to-end de los dos flujos críticos**
    → Tras cada fase de cambios, se verificó contra el Sheet real (no solo lectura de código): reserva desde la web aparece en `list-reservas.ts`; cita desde el calendario bloquea `availability.ts` en la siguiente petición, sin caché. Confirmado dos veces en esta sesión, con limpieza de los datos de prueba en ambas.

### Estado final

El sistema es ahora: multi-tenant, con una única fuente de verdad (Sheet), una única autoridad de negocio (`validateAppointment` en Apps Script bajo lock), lecturas públicas server-proxied (sin exponer `SHEET_ID`), disponibilidad consciente de overrides en todos los consumidores, y ambos flujos críticos verificados empíricamente.

---

## 10. Errores encontrados durante el desarrollo

Para cada error: **problema → por qué ocurría → cómo se detectó → cómo se solucionó → solución definitiva**.

### 10.1. Sincronización web ↔ calendario inexistente para overrides

- **Problema**: un cierre puntual creado desde el calendario no se reflejaba en la web pública.
- **Por qué**: `scheduleOverrides` vivía solo en `localStorage`, sin ningún camino de escritura al Sheet.
- **Detectado**: en la revisión de arquitectura completa (petición explícita del usuario de auditar el sistema antes de tocar nada).
- **Solucionado**: pestaña "Overrides" en el Sheet + acciones `createOverride`/`deleteOverride` en Apps Script + `list-overrides.ts` + `fetchOverrides()` integrado en todos los consumidores de disponibilidad.
- **Solución definitiva**: overrides como dato de Sheet de primera clase, con la misma autoridad que horarios/vacaciones — ver sección 9.5.

### 10.2. Riesgo de doble reserva por falta de `LockService` en update/delete

- **Problema**: `handleUpdateAppointment`/`handleDeleteAppointment` no tenían ninguna protección de concurrencia.
- **Por qué**: solo `handleCreateAppointment` se había protegido en su momento; update/delete se añadieron después sin el mismo cuidado.
- **Detectado**: en la revisión de código completa.
- **Solucionado**: mismo patrón de `LockService.getScriptLock()` + `findConflictingAppointment` extendido a los tres handlers.
- **Solución definitiva**: ver sección 9.8, y ahora absorbido dentro de `validateAppointment` (sección 9.11).

### 10.3. `updateAppointment` sin validación ni rollback en el store

- **Problema**: un reagendado fallido en el Sheet dejaba el calendario local mostrando una cita movida que en realidad no se había movido.
- **Por qué**: `updateAppointment` era fire-and-forget, inconsistente con `addAppointment`.
- **Detectado**: en la revisión de código, comparando el patrón de ambas funciones.
- **Solucionado**: `updateAppointment` ahora es `async`, espera la respuesta y revierte en caso de fallo (sección 9.9).
- **Solución definitiva**: patrón await-then-rollback simétrico entre `addAppointment` y `updateAppointment`.

### 10.4. `deleteAppointment` — coherencia con el resto de escrituras

- **Problema/contexto**: `handleDeleteAppointment` no tenía lock (podía interleavearse con una creación/actualización concurrente leyendo la hoja a medio modificar).
- **Solucionado**: se le añadió el mismo `LockService`, aunque su lógica en sí (buscar por `id` y borrar la fila) no necesitaba chequeo de solape.

### 10.5. `availability.ts` — un único slot por hueco (no un bug, pero una limitación real para uso público)

- **Problema**: la web pública solo ofrecía la hora más temprana de cada hueco libre.
- **Por qué**: `findAvailableSlots` se diseñó originalmesmo para el panel interno, donde repartir resultados por huecos distintos es la UX correcta.
- **Detectado**: en la revisión de arquitectura, al trazar el flujo completo de disponibilidad pública.
- **Solucionado**: parámetro `allSlotsPerGap` opt-in, activado solo donde corresponde (sección 9.6).
- **Solución definitiva**: comportamiento por defecto sin cambios (panel interno), comportamiento explícito para consumidores públicos.

### 10.6. Exposición de `SHEET_ID`/`gid` en el bundle del cliente

- **Problema**: cualquiera con acceso a las devtools del navegador podía leer `SHEET_ID` y construir la misma URL CSV para volcar todos los negocios.
- **Por qué**: `sheets-provider.ts`/`reservas-sync.ts` se importaban directamente desde componentes cliente.
- **Detectado**: en la revisión de código.
- **Solucionado**: proxy server-side (`list-businesses.ts`, `list-reservas.ts`, `list-overrides.ts`) + `proxied-reads.ts` como nuevo `DataProvider` cliente.
- **Solución definitiva**: verificado con `npm run build` + `grep` sobre `out/` — cero coincidencias del `SHEET_ID`. **Límite conocido, no resuelto por esto**: el Sheet en sí sigue siendo de acceso público por enlace.

### 10.7. `save-profile.ts` sin allowlist de acciones

- **Problema**: cualquier `action` desconocida se reenviaba tal cual a Apps Script.
- **Solucionado**: `ALLOWED_ACTIONS` explícito + eliminación de CORS abierto innecesario (sección 9.10).
- **Solución definitiva, límite conocido y documentado en el propio código**: esto es defensa en profundidad, no autenticación de llamador — no impide una llamada directa que ya conozca la URL y una acción válida.

### 10.8. Reglas de negocio duplicadas y parciales entre `handleCreateAppointment` y `handleUpdateAppointment`

- **Problema**: cada handler validaba un subconjunto distinto de reglas (solo solapes), y ninguno validaba horario/vacaciones/overrides/duración de servicio a nivel de autoridad final.
- **Por qué**: las reglas se habían ido añadiendo de forma incremental, cada vez en el sitio más cercano al problema puntual que se estaba resolviendo, sin una función central.
- **Detectado**: petición explícita del usuario de centralizar toda la lógica de validación en un único punto, tras revisar los flujos críticos.
- **Solucionado**: `validateAppointment(...)`, autoridad única reutilizada por ambos handlers bajo el mismo lock (sección 9.11).
- **Solución definitiva**: cualquier regla de negocio futura (tiempo de limpieza entre citas, pausas, límite de citas diarias) se añade en un único sitio.

### 10.9. Bug de `AnimatePresence` en la web externa de un negocio (fuera de este repositorio)

- **Problema reportado**: la web pública de Solycann mostraba "No hay huecos disponibles" con el calendario en un mes incorrecto.
- **Investigación**: se verificó en vivo, contra producción real, que `availability.ts` devolvía cientos de huecos correctos para ese negocio exacto (petición interceptada en el propio navegador con `fetch` monkey-patched). El backend de este repositorio quedó exonerado con evidencia directa.
- **Causa real**: un bug de `AnimatePresence mode="wait"` en `booking.tsx` (proyecto Lovable externo, `lovable-project-74008ed0`), que puede dejar el contenido visual de un paso del asistente desincronizado del estado real (`step` avanza, pero el DOM se queda con el paso anterior) si la animación de salida no llega a completarse.
- **Solución propuesta (no aplicada, repositorio ajeno)**: quitar `mode="wait"` o sustituirlo por `mode="popLayout"` en `booking.tsx`.
- **Relevancia para este documento**: ejemplo de cómo diagnosticar con evidencia real (interceptando `fetch` en el navegador) en lugar de asumir que el fallo está en el sistema de reservas solo porque el síntoma aparece en una web relacionada.

---

## 11. Arquitectura definitiva

### 11.1. Responsabilidades por componente

| Componente | Responsabilidad | Lo que NO debe hacer |
|---|---|---|
| **Frontend** (React/Next.js) | UI, estado optimista local, pre-checks de UX (mensajes rápidos de error), construcción de las peticiones | Decidir si una cita "puede" existir — nunca debe ser la última palabra |
| **Netlify Functions** | Proxy de lectura (ocultar `SHEET_ID`/token), passthrough de escritura, contrato JSON público limpio para terceros, pre-checks de fast-fail | Contener reglas de negocio de fondo (horarios, overlaps definitivos) — solo optimizaciones de latencia |
| **Apps Script** | **Autoridad final absoluta**: `validateAppointment` + `LockService` deciden si una escritura se realiza | Servir contenido al navegador directamente, lógica de presentación |
| **Google Sheets** | Único almacén persistente, fuente de verdad, legible públicamente sin autenticación | Ejecutar lógica — es un almacén pasivo |

### 11.2. Qué validaciones pertenecen a cada capa y por qué

- **Frontend**: valida solo lo que mejora la experiencia de forma inmediata (campos obligatorios del formulario, un fast-fail de solape justo antes de enviar). Nunca es fuente de confianza porque cualquiera puede saltarse el frontend con una petición HTTP directa.
- **Netlify Functions**: valida forma (JSON bien formado, campos obligatorios presentes, tipos correctos) y hace un pre-check de solape *antes* de gastar un roundtrip contra Apps Script — pura optimización, nunca la decisión final.
- **Apps Script**: es la única capa que se ejecuta *dentro* del mismo proceso que tiene acceso exclusivo de escritura al Sheet, bajo un lock atómico. Por eso, y solo por eso, puede garantizar que dos peticiones simultáneas no produzcan un resultado inconsistente. Todas las reglas de negocio "de verdad" (horario, vacaciones, overrides, duración de servicio, solapes) viven aquí, en `validateAppointment`.

### 11.3. Qué responsabilidades no deben moverse de sitio

- El **lock de concurrencia** no puede vivir en Netlify Functions ni en el frontend — ninguno de los dos tiene acceso exclusivo y atómico al Sheet; solo Apps Script, vía `LockService`, lo tiene.
- La **verdad sobre disponibilidad** no puede cachearse en un servidor intermedio de forma persistente — cualquier caché rompería la garantía de "lo que ves es lo que hay ahora mismo", que es lo que hace que el Flujo 2 (cita del calendario bloquea la web al instante) funcione.
- El **parseo de horarios/servicios/vacaciones** existe duplicado a propósito en dos sitios (`src/lib/data/sheets-provider.ts` en TS, y las funciones `parseHoursGAS`/`parseServiceLineGAS`/`parseVacationLineGAS` en Apps Script) porque Apps Script no puede importar módulos TypeScript del repo — es una duplicación deliberada y documentada, no un descuido; si el formato de texto cambia en un lado, debe cambiar a mano en el otro.

---

## 12. Checklist para añadir un nuevo negocio

```
☐ Crear negocio desde el panel de administración (AdminPanel → "+").
☐ Comprobar que el bloque NEGOCIO/USUARIO/WEB aparece correctamente en la
  hoja de identidad del Google Sheet.
☐ Iniciar sesión como el nuevo negocio (negocio, usuario).
☐ Configurar servicios (nombre, precio, duración) en ProfileSheet.
☐ Configurar horarios (por día de la semana) en ProfileSheet.
☐ Configurar vacaciones (rangos de fechas) en ProfileSheet.
☐ Guardar el perfil y comprobar en el Sheet que SERVICIOS/HORARIOS/
  VACACIONES se han escrito con el formato esperado.
☐ (Si procede) Crear un override de prueba desde "Modificar horario
  temporalmente" y comprobar que aparece en la pestaña "Overrides".
☐ Copiar el enlace de reserva (bookingUrl) o el snippet del widget
  (bookingEmbedSnippet) desde el panel de administración.
☐ Si el negocio tiene web propia: configurar NEGOCIO/USUARIO/
  CALENDAR_APP_BASE exactos en su código, apuntando a este calendario.
☐ Abrir /reservar?negocio=...&usuario=... (o la web propia) y comprobar
  que aparecen los servicios y huecos de disponibilidad reales.
☐ Hacer una reserva de prueba desde la web pública.
☐ Verificar que esa reserva aparece en el calendario del negocio correcto
  (puede tardar hasta 45s por el polling, o forzar recarga).
☐ Verificar que NO aparece duplicada ni en el calendario ni en el Sheet.
☐ Crear una cita de prueba manualmente desde el calendario.
☐ Verificar que ese horario deja de ofrecerse inmediatamente en
  availability.ts (sin esperar, sin caché).
☐ Verificar que la web pública ya no muestra ese hueco como disponible.
☐ Intentar reservar ese mismo hueco desde la web — debe rechazarse
  (slot_taken) tanto si se intenta por la UI como por una llamada directa
  al endpoint.
☐ Confirmar que LockService sigue protegiendo creación/actualización/
  borrado (dos peticiones casi simultáneas al mismo hueco — solo una
  debe tener éxito).
☐ Confirmar que validateAppointment en Apps Script sigue siendo la
  autoridad final (una petición directa a create-appointment.ts con un
  horario fuera de servicio, o con duración incorrecta, debe rechazarse).
☐ Confirmar que Google Sheets sigue siendo la única fuente de verdad —
  borrar la caché local (localStorage) del negocio y comprobar que el
  calendario se reconstruye igual a partir del Sheet.
☐ Eliminar cualquier cita/override de prueba creado durante esta
  verificación, dejando el Sheet limpio.
```

---

## 13. Referencia de archivos

### Frontend — páginas y componentes principales

| Archivo | Rol |
|---|---|
| [src/app/page.tsx](src/app/page.tsx) | Enrutado por estado de sesión: login / admin / calendario |
| [src/app/reservar/page.tsx](src/app/reservar/page.tsx) | Página pública de reserva |
| [src/components/public-booking/reservar-client.tsx](src/components/public-booking/reservar-client.tsx) | Formulario de reserva pública |
| [src/components/admin/admin-panel.tsx](src/components/admin/admin-panel.tsx) | Panel de administración |
| [src/components/admin/business-create-sheet.tsx](src/components/admin/business-create-sheet.tsx) | Alta de negocio |
| [src/components/admin/business-edit-sheet.tsx](src/components/admin/business-edit-sheet.tsx) | Edición/borrado de negocio |
| [src/components/business/profile-sheet.tsx](src/components/business/profile-sheet.tsx) | Servicios/horarios/vacaciones |
| [src/components/business/schedule-override-sheet.tsx](src/components/business/schedule-override-sheet.tsx) | Editor de cierres puntuales + reagendado |
| [src/components/business/business-menu-sheet.tsx](src/components/business/business-menu-sheet.tsx) | Menú del negocio |
| [src/components/auth/login-screen.tsx](src/components/auth/login-screen.tsx) | Pantalla de login |

### Lógica de datos y negocio (`src/lib/`)

| Archivo | Rol |
|---|---|
| [src/lib/store.ts](src/lib/store.ts) | Estado global Zustand, tablas locales, polling, acciones de escritura |
| [src/lib/availability.ts](src/lib/availability.ts) | `findAvailableSlots` |
| [src/lib/rail.ts](src/lib/rail.ts) | `buildRail` |
| [src/lib/rebooking.ts](src/lib/rebooking.ts) | `planScheduleChange` (reagendado automático) |
| [src/lib/booking-link.ts](src/lib/booking-link.ts) | URL de reserva y snippet del widget |
| [src/lib/auth/](src/lib/auth/) | Sesión, admin, throttle |
| [src/lib/data/types.ts](src/lib/data/types.ts) | Tipos: `Business`, `ScheduleOverride`, etc. |
| [src/lib/data/sheets-provider.ts](src/lib/data/sheets-provider.ts) | Lectura directa del Sheet (identidad) — solo server-side |
| [src/lib/data/reservas-sync.ts](src/lib/data/reservas-sync.ts) | Lectura directa de "Reservas" — solo server-side |
| [src/lib/data/overrides-sync.ts](src/lib/data/overrides-sync.ts) | Lectura directa de "Overrides" — solo server-side |
| [src/lib/data/proxied-reads.ts](src/lib/data/proxied-reads.ts) | Lecturas cliente vía Netlify Functions |
| [src/lib/data/sheets-writer.ts](src/lib/data/sheets-writer.ts) | Todas las escrituras hacia `save-profile.ts` |
| [src/lib/data/schedule.ts](src/lib/data/schedule.ts) / [schedule-overrides.ts](src/lib/data/schedule-overrides.ts) | Resolución de horario efectivo por día |
| [src/lib/data/sheet-format.ts](src/lib/data/sheet-format.ts) | Formato de texto para escribir en el Sheet |

### Netlify Functions

Ver tabla completa en la sección 2.6.

### Apps Script

| Archivo | Rol |
|---|---|
| [scripts/sheet-write-apps-script.js](scripts/sheet-write-apps-script.js) | Único backend de escritura — dispatcher, `validateAppointment`, todos los handlers |

### Widget

| Archivo | Rol |
|---|---|
| [public/widget.js](public/widget.js) | Botón flotante de reserva embebible en cualquier web |

---

*Fin de la documentación técnica oficial. Este documento refleja el estado del código en el momento de su generación — cualquier cambio futuro en la arquitectura (nuevas reglas de negocio, nuevos endpoints, nuevas capas de validación) debe actualizarse aquí para que siga siendo la referencia válida.*
