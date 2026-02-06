# PRD (MVP)

## Product
MediBilbao Salud — companion clínico para consulta de nutrición (Bilbao).

## Value prop
Plan claro + registro en 20–30s + revisión semanal con 2–3 ajustes.

## Roles
- Patient: plan, registro (check-in/foto), progreso semanal, revisión semanal, chat.
- Nutri: acepta solicitudes, asigna/edita plan, revisa registros, responde revisión, chat.

## MVP scope
- Auth email/password + verificación email + “Forgot password”.
- Roles seguros: `nutri` solo via allowlist `nutri_invites`.
- Vinculación paciente↔nutri por solicitud (email) + aceptación **atómica** (RPC).
- Plan semanal (A/B/fuera de casa) + lista de la compra editable.
- Registro: check-in + foto (Storage con `<patient_id>/<log_id>.jpg`).
- Progreso: tendencias semanales simples.
- Revisión semanal + respuesta del nutri.
- Chat asíncrono (Realtime).
- Biblioteca de píldoras (15–30).
- IA (MVP+): Asistente “sobre mi plan” limitado a plan + píldoras.

## Non-goals (MVP)
Comunidad, IA que crea dietas, tracking hiper detallado obligatorio, wearables.

## V2
Panel web nutri más potente, exportación de datos, editor visual de planes, push notifications, adjuntos.

