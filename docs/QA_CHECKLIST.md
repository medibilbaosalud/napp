# QA checklist (MVP)

## Patient
- Signup → email verify → login
- Onboarding:
  - Consent + disclaimer
  - Set tracking level
  - Request link to nutri email
- Today:
  - Check-in saved
  - Digestive (if enabled) saved
- Plan:
  - See plan for current week
  - Open shopping list and edit items
- Register:
  - Photo upload works (Storage path `<patient_id>/<log_id>.jpg`)
- Progress:
  - Weekly metrics render
- Weekly review:
  - Submit review
- Chat:
  - Send/receive messages
- Settings:
  - Change language ES/EU
  - Sign out

## Nutri
- Account only works if email in `nutri_invites`
- Requests:
  - See pending requests
  - Accept (creates care_team + thread)
  - Reject
- Patient:
  - Create/update plan JSON
  - View logs + photo preview
  - Respond weekly review (RPC)
  - Chat send/receive

## Security / RLS (manual)
- Nutri A cannot read patient data from Nutri B
- Patient cannot read other patients
- Storage policies:
  - Patient can upload only to own folder
  - Nutri can read photos only for assigned patients

