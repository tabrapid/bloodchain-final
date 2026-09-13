# Bloodchain — local demo guide

Everything below runs on one machine against a seeded local database. No
internet is required once dependencies are installed.

---

## 1. Start

Four terminals, or one `pnpm demo:start` plus one for Expo.

```bash
# Terminal 1 — local mail, so password reset links are readable (optional)
pnpm mail:dev

# Terminal 2 — infrastructure + API + three web consoles
pnpm demo:start

# Terminal 3 — the donor app
pnpm dev:mobile
```

`demo:start` brings up PostgreSQL through Docker Compose (if Docker is
available; otherwise it assumes Postgres is already running) and then starts the
API and all three consoles, prefixing each service's output. Ctrl-C stops them
all. It also looks for a mail catcher on port 1025 and, if one is listening,
points the API at it — start `pnpm mail:dev` first and password reset emails
land there instead of in the API log. See §10.

If you would rather run them yourself:

```bash
docker compose up -d postgres
pnpm --filter @bloodchain/api dev              # http://localhost:3001
pnpm --filter @bloodchain/hospital-web dev     # http://localhost:3000
pnpm --filter @bloodchain/blood-center-web dev # http://localhost:3002
pnpm --filter @bloodchain/admin-web dev        # http://localhost:3003
pnpm dev:mobile                                # Expo
```

| Service | URL |
| --- | --- |
| API | http://localhost:3001/api/v1 |
| API docs (Swagger) | http://localhost:3001/docs |
| Hospital console | http://localhost:3000 |
| Blood centre console | http://localhost:3002 |
| Admin console | http://localhost:3003 |
| Mail (Mailpit, if used) | http://localhost:8025 |

## 2. Reset to the scripted starting state

```bash
pnpm demo:reset
```

Regenerates the Prisma client, runs migrations, and reseeds. The seed truncates every table it owns first, so
this is repeatable — run it between rehearsals and before you present.

**Sign in again after every reset.** A reset issues new user ids, so any session
from before it is invalid. In the donor app: log out and back in.

`demo:reset`, `demo:check` and `demo:start` all refuse to run unless
`DATABASE_URL` resolves to a loopback host and `NODE_ENV` is not `production`.
A URL that cannot be parsed is refused too.

## 3. Check before presenting

```bash
pnpm demo:check    # is everything present?
pnpm demo:verify   # does it still work?
```

`demo:verify` drives all three flows against the running API — books a
donation, has staff complete it, books and publishes a lab test, raises an
emergency and takes a donor through accepting, travelling, arriving and being
completed — then puts the data back at its starting state. It is the one
command that answers "is the demo going to work", because it does the demo.
Every step is a real request and a real database change; nothing is mocked.


Prints PASS/FAIL for the database, the API, every seeded account, the seeded
organisations, today's bookable slots, the demo donor's eligibility, and each
content surface. The three consoles are reported as warnings, since you may only
have started one.

There is a third command, for the safety rules rather than the happy path:

```bash
pnpm verify:safety   # does the server refuse what it should refuse?
```

It makes the calls a buggy client or an attacker would make — booking a
donation for a donor who is still in their recovery window, checking one in,
reading another donor's laboratory result or journey, listing another
organisation's donations — and asserts the server refuses each one. Run it
after changing eligibility, laboratory or emergency code.

It is not read-only: it completes a real donation, which leaves the demo donor
inside a fresh recovery window. **Run `pnpm demo:reset` after it** — otherwise
`demo:check` will correctly report the demo donor as ineligible.

---

## 4. Accounts

Password for every account: `DevelopmentOnly!123`

These are local development credentials. They must never be used anywhere else.

### Donors — the mobile app

| Account | Who | Why it exists |
| --- | --- | --- |
| `donor@donor.local` | Sample Donor, O+ | **The account you present with.** Eligible to donate, with a donation 70 days ago, a published lab result, XP 340 / level 3, five notifications and a joined campaign. |
| `recent.donor@donor.local` | Nodira E., A− | Donated 12 days ago, so shows the "not yet eligible" state. |
| `aziza.donor@donor.local` | Aziza K., O− | Leaderboard #1. Emergency match pool. |
| `bekzod.donor@donor.local` | Bekzod R., A+ | Emergency match pool. |
| `dilnoza.donor@donor.local` | Dilnoza Y., B+ | Emergency match pool. |
| `sardor.donor@donor.local` | Sardor T., O+ | Emergency match pool. |

### Hospital staff — http://localhost:3000

| Account | Organisation | Role |
| --- | --- | --- |
| `hospital.admin@donor.local` | Northstar Hospital (Development) | Hospital admin |
| `hospital.staff@donor.local` | Northstar Hospital (Development) | Hospital staff |
| `jizzakh.admin@donor.local` | Jizzakh City Hospital | Hospital admin |
| `jizzakh.staff@donor.local` | Jizzakh City Hospital | Hospital staff |
| `arnasoy.admin@donor.local` | Arnasoy District Hospital | Hospital admin |
| `arnasoy.staff@donor.local` | Arnasoy District Hospital | Hospital staff |

### Blood centre staff — http://localhost:3002

| Account | Organisation | Role |
| --- | --- | --- |
| `blood.center.admin@donor.local` | Northstar Blood Center (Development) | Blood centre admin |
| `blood.center.staff@donor.local` | Northstar Blood Center (Development) | Blood centre staff |
| `rbc.admin@donor.local` | Republican Blood Center — Jizzakh | Blood centre admin |
| `rbc.staff@donor.local` | Republican Blood Center — Jizzakh | Blood centre staff |
| `lab.technician@donor.local` | Northstar Blood Center | Lab technician |
| `lab.reviewer@donor.local` | Northstar Blood Center | Lab reviewer — reviews and publishes results |
| `lab.admin@donor.local` | Northstar Blood Center | Lab admin |

### Platform — http://localhost:3003

| Account | Role |
| --- | --- |
| `admin@donor.local` | Super admin |

### Courier

| Account | Role |
| --- | --- |
| `courier@donor.local` | Courier — the courier screens in the mobile app |

---

## 5. What is seeded

- **5 organisations**: 3 hospitals (Northstar, Jizzakh City, Arnasoy District)
  and 2 blood centres (Northstar, Republican Blood Center — Jizzakh). Every one
  has its own staff accounts, so a booking anywhere reaches a console someone
  can sign in to.
- **~300 bookable slots**: five days from today, six times a day, at every
  organisation — donation slots everywhere, blood-test slots at the blood
  centres.
- **2 laboratories**, each offering Complete Blood Count, Blood Grouping and
  Ferritin, with adult reference ranges per parameter.
- **3 emergency requests** in different states (active, matching, draft).
- **Content**: 8 achievements, 4 badges, 3 campaigns, 3 challenges, 5 community
  posts, 4 education modules, a six-row leaderboard.
- **The demo donor**: one completed donation (70 days ago, 450 mL), one
  published lab result, XP 340 at level 3, five notifications, an upcoming
  laboratory appointment and a joined campaign.

---

## 6. The demo — 7 to 10 minutes

Run the parts in this order. **Donating makes the donor ineligible for 56
days**, so the donation is late in the script on purpose. If you need to start
over, `pnpm demo:reset` and sign in again.

### Part 1 — the donor (1 min)

Sign in to the mobile app as `donor@donor.local`.

- **Home** — greeting, blood group, "eligible to donate", next appointment card.
- **Profile** — level 3, 340 XP, one donation, 450 mL total, achievements.
- Point out that every number comes from the API, not the app.

### Part 2 — book a donation (1.5 min)

Donate tab → **Book a donation**.

- Choose **Jizzakh City Hospital** — deliberately not the default one, to show
  that the booking reaches whichever organisation you pick.
- Pick today's date, pick a time, review, confirm.
- The appointment appears on Home and in the Calendar immediately.

### Part 3 — the booking arrives at the hospital (1 min)

Open http://localhost:3000 and sign in as `jizzakh.staff@donor.local`.

- **Donations** in the sidebar. The booking is in **Today's appointments**, with
  the donor's name and time, and "Waiting to check in" reads 1.

### Part 4 — staff record the donation (1.5 min)

On the same screen, one button at a time:

1. **Check in** — creates the donation record; the stage becomes "Checked in".
2. **Approve** — records the health assessment. (**Defer** is the other path.)
3. **Start collection** — the stage becomes "Collecting".
4. **Complete** — enter **450** mL and save.

"Completed today" becomes 1 and "Collected today" shows 450 mL. The donation
appears under **Recent donations**.

### Part 5 — the donor sees it (1 min)

Back in the mobile app, pull to refresh.

- **Donation history** — the new 450 mL donation at Jizzakh City Hospital.
- **Profile** — two donations, 900 mL total, XP risen to 390.
- **Home** — no longer eligible; next eligible date is 56 days out.
- **Notifications** — "Donation Confirmed".

Say plainly: the donor never entered the volume. The hospital did, and this is
the same record.

### Part 6 — a blood test and its results (2 min)

In the mobile app: Health → **Book a blood test** → **Northstar Blood Center** →
today → a time → confirm.

Open http://localhost:3002 as `blood.center.staff@donor.local` → **Laboratory**.
Find the new reference (the most recent one) and work along its row:

1. **Confirm** → **Check In** → **Start Test** → **Sample collected**.
2. **Enter results** — pick Complete Blood Count and fill in:
   Hemoglobin `14.2`, RBC `4.9`, WBC `6800`, Hematocrit `42.5`,
   Platelets `250000`. Save.
3. **Review**, then **Publish to donor**.

Back in the mobile app: Health shows the new result, every parameter flagged
**Normal** against this laboratory's reference range, Health Trends gains a
second measurement so the chart has a line, and the next test date is shown.

### Part 7 — emergency SOS (2 min)

Open http://localhost:3000 as `hospital.staff@donor.local` → **Emergency** →
**New Emergency**.

- Blood type **O**, **Positive**, whole blood, 2 units, **Critical**, location
  "Northstar Hospital". Create, then **Activate**.
- The request moves to **Matching** and shows matched donors.

In the mobile app the emergency appears. Open it, **Accept**, then **Start
journey** — grant the location permission when asked. The hospital's emergency
screen now tracks the donor's position live.

Tap **I have arrived**. On the hospital screen: **Confirm arrival**, then
complete the donation with the volume given. It lands in the donor's history and
statistics exactly like the booked one.

> Run Part 7 **before** Part 4 if you want to show both completions from a fresh
> donor — a donor who has just donated is inside the recovery window and the API
> will correctly refuse the emergency.

---

## 7. Networking

The mobile app finds the API by itself: it reads the host that served the Metro
bundle and talks to port 3001 on that same machine. Nothing to type, and it
follows the laptop between networks.

| Where the app runs | What it uses |
| --- | --- |
| Android emulator | `10.0.2.2:3001` — the host machine as seen from inside the emulator |
| iOS simulator | `localhost:3001` |
| A real phone on the same network as the laptop | the laptop's address, taken from Metro |

The app does not guess once and hope. It probes every candidate address at
startup — the machine that served the bundle, `10.0.2.2` on Android, and
`localhost` — and keeps the first that answers, because `Platform.OS` is
"android" for both an emulator and a phone and the two need different
addresses. So an emulator and a real phone both work with nothing configured.

**What it cannot do is reach a machine on another network.** The app reaches the
API because it reaches the machine that served it; if that machine is somewhere
else, no address exists to find.

Two cases break it:

- **`expo start --tunnel`.** The tunnel relays Metro and nothing else, so the
  API is not reachable at that hostname. The app detects this and says so in the
  error rather than blaming your connection.
- **The phone is on mobile data while the laptop is on Wi-Fi.** Different
  networks, same outcome.

The fix for both is to put them on one network: turn on the phone's hotspot,
**connect the laptop to it**, and start Expo without `--tunnel`. Metro then
reports the laptop's hotspot address and the API follows it. Being "on the
phone's internet" is not enough on its own — the laptop has to be on it too.

If you genuinely cannot share a network, expose the API yourself and point the
app at it:

```bash
# a tunnel for the API, alongside Metro's
npx ngrok http 3001
EXPO_PUBLIC_API_URL=https://<the-ngrok-host> pnpm dev:mobile
```

Override it only if the API is somewhere else: set `EXPO_PUBLIC_API_URL` (or
`extra.apiUrl` in `app.json`) and restart `expo start` — `EXPO_PUBLIC_*` values
are baked into the bundle when it is built, not read at runtime.

The app prints the address it is using on startup: `[api] http://…:3001/api/v1`,
followed by `[api] <reason>` when that address is unlikely to work. The same
reason is shown in the sign-in error in development builds, so you can read it
off the phone without a console.

Sign-in is rate limited to 5 attempts per minute per IP. On a demo laptop every
client shares one address — three consoles, a phone, and `demo:check`'s own nine
logins — so `pnpm demo:start` sets `AUTH_THROTTLE_LIMIT=100`. Starting the API
by hand, raise it yourself:

```bash
AUTH_THROTTLE_LIMIT=100 pnpm --filter @bloodchain/api dev
```

### 7.1 When the phone cannot reach the API

The error names the address it tried. Start there.

**If it is an `exp.direct`, `ngrok` or `trycloudflare` host** — Metro is
tunnelled and the API is not. See the two cases above.

**If it is an ordinary address** (`192.168.…`, `172.20.…`, `10.…`) then the app
picked the right machine, and the question is only whether port 3001 on it is
reachable. The bundle already arrived from that address on port 8081, so the
network path itself works.

Note *which* error you got — they mean different things:

| Message | What it means |
| --- | --- |
| "Could not reach the server" (fails immediately) | Nothing is listening. The API is not running — start it. |
| "The server took too long to respond" (hangs, then fails) | Something is dropping the packets. On a Mac this is almost always the firewall. |

To confirm, open this in the **phone's own browser** (`pnpm demo:check` prints
the exact URLs):

```
http://<that same address>:3001/api/v1/health
```

- **JSON comes back** → the API is reachable and the problem is in the app.
- **The page hangs, or the browser sits there and gives up** → the connection is
  being dropped. On macOS, in order:

  1. `pnpm demo:check` reports the firewall state. If it says **stealth mode is
     on**, that is the cause: stealth mode drops incoming connections silently,
     which is exactly a hang. System Settings → Network → Firewall → Options →
     turn off **Enable stealth mode**.
  2. Still hanging: in the same Options list, set **node** to *Allow incoming
     connections*. Metro was allowed the first time you ran it; if the API runs
     from a different Node install it is a different binary and is asked
     separately — which is why the bundle loads and the API does not.
  3. Quickest for a demo: turn the firewall off entirely until you are done.

- **The browser says it cannot connect, immediately** → nothing is listening.
  The API is not running, or not on that machine. Start it and check its
  startup log.

The API prints the addresses it answers on when it starts:

```
BloodChain API listening on port 3001
  reachable at http://localhost:3001/api/v1
  reachable at http://192.168.1.14:3001/api/v1
```

If the address the app named is not in that list, the laptop changed networks
after the API started — restart it.

---

## 8. If something goes wrong

| Problem | What to do |
| --- | --- |
| **"Server took too long to respond" on sign-in** | The message names the address it tried. Work through §7.1. |
| **429 / "too many attempts"** | The login throttle. Restart the API with `AUTH_THROTTLE_LIMIT=100`, or wait a minute. |
| **Everything is signed out after a reset** | Expected: a reset issues new user ids. Sign in again. |
| **GPS is slow in the emulator** | Set a location first: Android emulator → ⋯ → Location → enter 40.1158 / 67.8422 → Send. iOS simulator → Features → Location → Custom Location. The donor screen shows a waiting state until the first fix; it is not stuck. |
| **Location permission denied** | The app shows the real denied state. Grant it in the emulator's app settings and reopen the emergency. |
| **Push notifications don't arrive** | Push needs credentials this demo does not have. In-app notifications are persisted and work without it — show the Notifications screen instead. |
| **Realtime updates look stale** | The hospital tracking screen reconnects on its own; pressing Refresh forces a reload. Nothing in the demo depends on a socket staying up. |
| **No slots on the date you picked** | Slots are seeded for five days from the day you last reset. Reset again, or pick a nearer date. |
| **The donor cannot accept an emergency** | They are inside the 56-day recovery window — probably because you already ran Part 4. Reset, or use a different donor. |
| **"This donor is in the post-donation recovery window until …" when booking or checking in** | Working as intended: the server refuses a donation for a donor who is not yet due, at booking and again at check-in. It happens to `donor@donor.local` once you have completed a donation in this session — `pnpm demo:reset` puts them back. `recent.donor@donor.local` is seeded inside the window deliberately. |
| **`demo:check` says the demo donor is not eligible, right after `verify:safety` passed** | `verify:safety` completes a real donation, so it leaves the demo donor inside a fresh recovery window. Run `pnpm demo:reset`. |
| **The reset email never arrives** | With no `SMTP_HOST` set, mail is logged instead of sent — the full message, including the link, is in the API log. Start `pnpm mail:dev` before `pnpm demo:start` to have it delivered somewhere readable (§10). |
| **"This link no longer works" on the reset screen** | Reset links are single-use and expire within the hour. The API answers the same way for an unknown, used and expired token on purpose, so the app cannot tell you which. Request a new one and open the most recent email. |
| **`verify:recovery` says port 1025 is busy** | It runs its own mail sink so it can read the message. Stop `pnpm mail:dev` (or `docker compose stop mailpit`) and run it again. |
| **"You already have an appointment at this time" when booking** | Fixed: the seed used to book the demo donor at the exact moment of seeding, which collided with the hours a presenter picks from. Pull and `pnpm demo:reset`. |
| **The API logs dozens of "property does not exist" errors, and seeded accounts cannot sign in** | The generated Prisma client is older than the schema, so the API will not compile and the seed cannot run — every other symptom is downstream of this. Run `pnpm db:generate`, or just `pnpm demo:reset`, which now does it first. `pnpm demo:check` reports it as the first line. |
| **`demo:check` says accounts cannot sign in, right after a run that passed** | Sign-in allows 5 attempts per minute per IP and the check makes nine. It now says so explicitly instead of reporting "login refused". `pnpm demo:start` sets `AUTH_THROTTLE_LIMIT=100` for you; otherwise wait a minute. |
| **No internet** | Nothing here needs it. The consoles load their fonts from Google Fonts and fall back to system fonts without them; everything else is local. |

---

## 9. Notes

- **Redis** is not used by the API — there is nothing to start and nothing that
  degrades without it.
- **Docker** is used only for PostgreSQL. If you already run Postgres locally,
  `demo:start` uses that.
- **The donor never completes their own donation.** Check-in, assessment,
  collection and completion are all staff actions, and the volume the donor sees
  is the one staff typed.
- **The recovery window is enforced by the server**, at booking (against the
  slot's time) and again at check-in (against now). `recent.donor@donor.local`
  is seeded inside that window on purpose: trying to book a donation as that
  account is a 409 with `DONOR_IN_RECOVERY_WINDOW`, and they are not alerted for
  emergencies either. Use them to show a refusal; use `donor@donor.local` for
  everything that should succeed.
- **Password reset works locally without SMTP.** `POST /auth/forgot-password`
  always answers the same way, and with no `SMTP_HOST` configured the message —
  including the reset link — is written to the API log instead of being sent.
  §10 sets up something more readable.
- **Emergency location history is pruned** once a journey is closed, after
  `EMERGENCY_LOCATION_RETENTION_HOURS` (72 by default in development). That
  default is a development convenience, not a retention decision for
  production.

---

## 10. Account recovery and local email

Nothing here needs a real mail provider, and nothing here should ever be given
one: these are local tools with no credentials.

### Catching the mail

Two ways, both listening on SMTP port **1025**, so the API is configured the
same either way:

```bash
pnpm mail:dev                                # prints every message, links first
docker compose --profile dev up -d mailpit   # browsable inbox at :8025
```

`pnpm mail:dev` is a small SMTP server that accepts everything and delivers
nothing, printing each message with any link pulled out onto its own line. For a
demo that is usually what you want — the link is on screen, in the same terminal
you are already looking at. Mailpit gives you a real inbox instead; it is in the
`dev` Compose profile, so a plain `docker compose up` never starts it.

Start either one **before** `pnpm demo:start`, which looks for a listener on
1025 and points the API at it. Without one, mail still "works": the API logs the
message body rather than sending it.

### The flow, in a console

All three consoles have the same two pages, each in its own house style:
**Forgot password?** under the password field on the sign-in form →
`/forgot-password` → `/reset-password`. Success returns to the console you
started from.

The link in the email is addressed to the console the account actually signs in
to: hospital staff to :3000, blood centre and laboratory staff to :3002, a
platform admin to :3003. Set `WEB_URL_HOSPITAL`, `WEB_URL_BLOOD_CENTER` and
`WEB_URL_ADMIN` to change where each goes; unset, they all fall back to the
first `WEB_URL` entry.

### The flow, on the phone

1. **Sign in → "Forgot password?"** under the password field.
2. **Reset password** — type the email address, tap *Send reset link*. The
   confirmation says "if an account exists", for every address, because the
   server does not say which addresses are registered and the app must not
   either.
3. **The email** arrives in your mail terminal with two links: a web one
   (`http://localhost:3000/reset-password?token=…`) and a deep link
   (`donor://reset-password?token=…`). The deep link opens the app straight on
   the reset screen.
4. **New password** — 12 characters with an uppercase, a lowercase, a number and
   a symbol; the form checks the rule rather than spending a round trip on it.
5. **Password updated** — every other session is revoked, and *Sign in* takes
   you back to Login.

No deep link? On an emulator, `adb shell am start -a android.intent.action.VIEW
-d "donor://reset-password?token=…"` opens it. Or open **Reset password →
"Already have a reset code?"** and paste the token from the link.

### Checking it end to end

```bash
pnpm verify:recovery
```

Starts its own mail sink, asks the API for a real reset, reads the link out of
the delivered message, spends it, and then checks the things that are easy to
get wrong: that the link opens the mobile route, that the token cannot be used
twice, that a used and an unknown token are answered identically, and that a
session held before the reset is dead afterwards.

It also issues a second link and ages it past its expiry in the database rather
than waiting an hour, to confirm an expired link is refused the same way — and
finishes by exercising Register, resend-verification and Login, since recovery
shares a module with them.

It changes a seeded account's password (`recent.donor@donor.local`), so run
`pnpm demo:reset` after it. Stop `pnpm mail:dev` first — the script runs its own
sink on the same port so it can read the message rather than print it.

### What production still needs

Nothing here is production email. A deployment needs real SMTP credentials, a
sender address the domain is authorised to use, SPF/DKIM/DMARC on that domain,
and public `WEB_URL*` values so the link in the mail resolves. Rate limiting
also needs a shared store before a second API instance exists. The full handover
list is in `docs/security.md` under **Not Yet Configured: Deployment
Requirements**.
