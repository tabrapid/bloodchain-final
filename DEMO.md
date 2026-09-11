# Bloodchain — local demo guide

Everything below runs on one machine against a seeded local database. No
internet is required once dependencies are installed.

---

## 1. Start

Four terminals, or one `pnpm demo:start` plus one for Expo.

```bash
# Terminal 1 — infrastructure + API + three web consoles
pnpm demo:start

# Terminal 2 — the donor app
pnpm dev:mobile
```

`demo:start` brings up PostgreSQL through Docker Compose (if Docker is
available; otherwise it assumes Postgres is already running) and then starts the
API and all three consoles, prefixing each service's output. Ctrl-C stops them
all.

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
