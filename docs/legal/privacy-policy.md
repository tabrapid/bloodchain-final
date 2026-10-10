# Bloodchain Donor App — Privacy Policy (draft for legal review)

**Status: DRAFT.** This text describes what the app actually does today, from
the code. It has not been reviewed by a lawyer and names no legal basis under
Uzbek law, no retention period and no supervisory authority. Before it is
published at the URL the store listings point to, the operator of the service
("the blood service") must: (1) fill in the three `[...]` fields, (2) have it
reviewed for the law of the Republic of Uzbekistan on personal data, (3)
publish it in Uzbek and Russian as well as English, and (4) set
`EXPO_PUBLIC_PRIVACY_POLICY_URL` for the production build so the app links to
it. The app ships in three languages; the policy must too.

_Last updated: [date]_

## Who is responsible

The Bloodchain donor app is operated by **[legal name and address of the
operating organisation]** ("we"). Questions about this policy go to
**[privacy contact email]**.

## What the app collects, and why

| Data | When | Why |
| --- | --- | --- |
| Name, email address, password (stored as a hash), optional phone number | When you create an account | To identify you, sign you in and recover your account |
| Blood group and Rh factor, and whether a healthcare provider has verified them | When you complete your donor profile; verification by a blood centre | To match you to donation appointments and emergency requests |
| City and district ("home area"), and optionally your coordinates | When you choose to save a home area | To show nearby centres and, if you opt in, to let nearby emergency requests reach you |
| Your location while you are travelling to an emergency request you accepted, or carrying a delivery as a courier | Only during that journey, only if you allowed it | So the hospital handling the request knows to expect you. Sharing stops when you arrive or cancel |
| Donation records, appointment history, screening and laboratory results published to you, consents you accepted | As the blood service and laboratories record them | These are the blood service's medical records of your donations |
| Notification preferences and, if you allow notifications, a push token for your device | When you enable notifications | To send you appointment reminders, emergency requests near you, and results |
| Device name, IP address and sign-in times for each active session | When you sign in | So you can see and sign out every device; security audit |
| Points, badges, challenge progress, leaderboard position | As you use the app | Recognition features; you can hide yourself from the public leaderboard |

The app does not collect contacts, photos, files, advertising identifiers or
precise location in the background. It does not use analytics or advertising
SDKs. Maps on Android are drawn by Google Maps, which receives the map tiles
it needs to draw; see Google's policy for that service.

## AI features

Where the deployment has enabled them, "AI insights" generate informational
text from your own laboratory results. They are not medical advice. The
results used are yours; nothing is sent to a model until you ask for an
insight, and the app says plainly when the feature is switched off.

## Who sees your data

- The blood centre and hospital staff handling your appointment, donation,
  emergency response or delivery, within their role.
- Laboratories that publish results to you.
- Other donors see only what you choose: your display name and donation
  count on the leaderboard, if you leave the leaderboard switch on.
- We do not sell personal data and do not share it with advertisers.

## Your choices

- **Location sharing** and **leaderboard visibility** are switches in
  Privacy settings.
- **Notifications** are per-category switches in Notification settings and
  can be turned off at the operating-system level.
- **Delete your account**: Privacy → Delete account closes the account for
  good, signs out every device, and removes your display name, photo, home
  area, coordinates, location consent, notification settings and leaderboard
  entry. Your donation record (the identity you registered under, your
  donations, screening and laboratory results, consents and the audit trail)
  stays with the blood service as part of its medical records for
  **[retention period and legal basis — to be stated by the blood service]**.
- **Export**: a copy of your data can be requested at the contact address
  above; in-app export is not available yet.

## Security

Passwords are stored only as salted hashes. Traffic between the app and the
service is encrypted (TLS). Access tokens are short-lived and refresh tokens
can be revoked from the Security screen. Every change to your account is
written to an append-only audit log.

## Children

The app is for blood donors and is not intended for anyone under the
donation age set by the blood service.

## Changes

We will update the date at the top when this policy changes and show the
new version in the app.
