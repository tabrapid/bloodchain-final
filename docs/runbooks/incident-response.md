# BloodChain incident response — working procedure

Status: operational draft, 2026-11-05. Before a real-data pilot, name the incident lead, legal contact, clinical lead and communication approver, and verify the reporting channel. Monitoring destinations do not themselves constitute a regulator notification.

## Detection and clocks

Record discovery time in UTC, reporter, affected service, data categories, known recipients/countries, whether unauthorized access/transfer is continuing, and the evidence source. Restrict the record to incident responders. Preserve originals and keep a timeline of decisions.

[Uzbekistan Cabinet Resolution 415, paragraph 4](https://lex.uz/uz/docs/-8369688) sets a 24-hour initial notification and a 72-hour detailed information requirement for a leak detected during cross-border personal-data transfer. Apply that specific scope; do not silently substitute a generic GDPR timetable or assume this is the only applicable duty. Counsel determines other statutory, contractual and data-subject notifications.

## Immediate response

1. Assign incident lead and legal/clinical contacts. Assess impact on donor/patient safety as well as service availability.
2. Contain the affected interface or credential with the smallest effective change. Record what changed. Do not erase logs or overwrite the affected database to make the alert disappear.
3. Preserve restricted logs, relevant configuration, timestamps and evidence hashes. Do not paste credentials, raw clinical records or backup archives into Telegram/email/chat.
4. Determine data scope, access and transfer path, affected recipients, countries, whether data was encrypted, and whether the relevant key was exposed. Uncertainty is recorded explicitly.
5. Where paragraph 4 applies, prepare the initial notification before the 24-hour deadline and the detailed causes/remediation report before 72 hours. Keep submission/receipt evidence. State known facts and unresolved questions separately.

## Recovery and closure

- Rotate affected credentials without locking out the only authorized operator; review active sessions and access grants.
- Restore only into a new isolated database first, reconcile clinical/component histories and verify backups before any cutover. Follow `backup-and-restore.md`.
- Clinical lead handles any incorrect result, lost traceability, quarantine or recall implication; engineering does not invent clinical disposition.
- Reopen affected functions after containment is verified, regression tests pass, monitoring is healthy and the responsible leads approve the scope.
- Record root cause, affected versions/data, notification evidence, remaining risks, corrective actions with owners/deadlines and a follow-up drill. Retain according to the approved incident/evidence schedule; no arbitrary automatic deletion period is assigned here.

## Exercise before pilot

Use synthetic data to simulate a leaked email-verification URL, a wrongly scoped clinical lookup, and an unauthorized third-party notification. Prove detection, containment, timeline creation, escalation and recovery. Exercises do not send real regulator notifications or expose real clinical records.
