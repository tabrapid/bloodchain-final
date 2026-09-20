# Bloodchainga — live presentation guide

Everything needed to give the 8–10 minute public demonstration: how to start it,
what to click, what to say, what to do when something goes wrong, and what not
to open.

Read section 1 and section 2 the morning of the presentation. Section 5 is the
script — print it or keep it on a second screen.

> **One rule above all the others:** every number on every screen comes from the
> local database in front of you. Nothing in this demo is a mock-up, a video, or
> a hard-coded screenshot. If something does not work, say so — the fallbacks in
> section 9 are all honest. Never present a result that did not happen.

---

## 1. Starting up

### The short way — two terminals

```bash
# Terminal 1 — database, API, and all three web consoles
pnpm demo:start

# Terminal 2 — the donor app
pnpm dev:mobile
```

`pnpm demo:start` starts PostgreSQL (through Docker Compose if it is available;
otherwise it assumes PostgreSQL is already running), then the API and the three
Next.js consoles as one process group with their logs prefixed. Ctrl-C stops all
four together. It also raises the sign-in rate limit for the session, because
five people signing in from one laptop otherwise trip the throttle.

Expo stays in its own terminal on purpose: it wants the whole window for its QR
code and its keyboard shortcuts.

### The long way — six terminals

Use this only if you need to restart one piece without disturbing the others.

| Terminal | Command | What it is |
| --- | --- | --- |
| 1 | `docker compose --profile dev up -d postgres mailpit` (or start your local PostgreSQL) | Database |
| 2 | `pnpm dev:api` | API on `http://localhost:3001` |
| 3 | `pnpm dev:hospital` | Hospital console on `http://localhost:3000` |
| 4 | `pnpm dev:blood-center` | Blood-centre console on `http://localhost:3002` |
| 5 | `pnpm dev:admin` | Admin console on `http://localhost:3003` |
| 6 | `pnpm dev:mobile` | Expo dev server for the donor app |

### Then, before you present

```bash
pnpm demo:reset     # back to the exact starting state
pnpm demo:check     # PASS/FAIL on everything the demo needs
```

`demo:check` must end with **✓ All required checks passed**. Warnings about a
console you did not start, or about the mail catcher, are fine.

If you want the strongest possible assurance, `pnpm demo:verify` drives all
three flows against the running API. It takes about a minute and it *is* the
demo, performed by a script.

It does **not** reset the database, before or after — since Sprint 7 each flow
runs against a donor the script creates and deletes, so the accounts above are
left exactly as you left them. That means you can run it after `demo:reset` and
`demo:check` without undoing them, and you can run it again minutes before you
present.

---

## 2. URLs and accounts

| Console | URL |
| --- | --- |
| API | `http://localhost:3001/api/v1` (docs at `/docs`) |
| Hospital | `http://localhost:3000` |
| Blood centre | `http://localhost:3002` |
| Admin | `http://localhost:3003` |
| Donor app | Expo — scan the QR code, or press `i` / `a` for a simulator |

Every account uses the same password: **`DevelopmentOnly!123`**

| Role | Login | Password | Where you use it |
| --- | --- | --- | --- |
| **Primary donor** | `donor@donor.local` | `DevelopmentOnly!123` | Donor app — the whole demo |
| Hospital staff | `hospital.staff@donor.local` | `DevelopmentOnly!123` | Hospital console — donation and SOS |
| Hospital admin | `hospital.admin@donor.local` | `DevelopmentOnly!123` | Hospital console — if you want to show admin rights |
| Blood-centre staff | `blood.center.staff@donor.local` | `DevelopmentOnly!123` | Blood-centre console — laboratory |
| Blood-centre admin | `blood.center.admin@donor.local` | `DevelopmentOnly!123` | Blood-centre console — inventory |
| Lab reviewer | `lab.reviewer@donor.local` | `DevelopmentOnly!123` | Blood-centre console — reviews and publishes a result |
| Platform admin | `admin@donor.local` | `DevelopmentOnly!123` | Admin console — organizations, roles, audit |
| Courier | `courier@donor.local` | `DevelopmentOnly!123` | Only if you demonstrate delivery |
| Second donor | `sardor.donor@donor.local` | `DevelopmentOnly!123` | A spare donor, free of history |

These are development credentials in a local database. Say so if anyone asks —
it is a better answer than looking evasive.

---

## 3. The primary donor's starting state

This is what `donor@donor.local` looks like the moment you reset. Knowing it
means you can tell at a glance whether the data on screen is the starting state
or something the demo just produced.

| | |
| --- | --- |
| Name | Sample Donor |
| Blood group | **O+**, **verified by staff** (not self-reported) |
| Donations | **3 completed**, **1350 mL** total — 350, 182 and 70 days ago |
| Eligible to donate | **Yes**, since 4 September (56 days after the last donation) |
| Laboratory | **3 published results**, about 6 months, 3 months and 1 week ago |
| Health Trends | **5 parameters, 3 points each** — every one draws a real line |
| Calendar | **2 upcoming appointments** |
| Notifications | **5** |
| Gamification | **340 XP**, 3 achievements, 4 badges |
| Emergency | **No open match and no open response** — free to be called for a new SOS |

That last line matters more than it looks. The matching engine deliberately
skips a donor who is already being called out for another emergency, so a donor
left mid-SOS from a previous run will silently fail to match. `demo:check`
reports this as **Presentation donor: free for the live SOS**.

---

## 4. Before you start — the 60-second check

1. `pnpm demo:reset` — takes about 20 seconds.
2. `pnpm demo:check` — must end in ✓.
3. Sign into the donor app and leave it on **Home**.
4. Sign into the hospital console in one browser tab, the blood-centre console
   in a second. Leave the admin console closed until you need it.
5. Turn the phone's Do Not Disturb on, and screen rotation off.

---

## 5. The script

Timings are targets, not a stopwatch. If you are running long, the section to
shorten is 8:30–9:15; the section never to rush is the SOS.

### 0:00–1:00 — The problem, and what this is

*No screen. Look at the audience.*

> "In Uzbekistan, when a hospital needs blood urgently, the search for a donor
> is mostly phone calls — to a list, to relatives, to whoever answers. It works,
> and it is slow, and how fast it works depends on who happens to pick up.
>
> Bloodchainga is one system for the whole chain: the donor's phone, the
> hospital, the blood centre, the laboratory, and the delivery in between. One
> record of a donation, visible to everyone who needs it and nobody who does
> not.
>
> Everything you are about to see is running on this laptop, against a real
> database. The people and the hospitals are invented. Nothing else is."

### 1:00–2:00 — The donor's app

**Donor app · `donor@donor.local` · Home**

| Do | You will see | Say |
| --- | --- | --- |
| Open the app on **Home** | Blood group O+, 3 donations, 1350 mL, next appointment | "This is a donor who has given blood three times. The app knows their blood group, how much they have given, and when they can give again." |
| Tap **Health** | Health card, verified blood group, profile completion | "The blood group carries a mark: it was verified by medical staff, not typed in by the donor. That distinction runs all the way through the system." |
| Tap **Profile** | Level, XP, achievements, badges, language switcher | "There is a light layer of recognition — donating is voluntary, and people come back when it is acknowledged." |
| Tap the language switcher: **O‘zbekcha → Русский → English** | The whole screen changes language immediately | "Uzbek, Russian and English. Not a plan — the app ships with all three." |

Leave it on the language you want for the rest of the demo.

### 2:00–3:30 — Booking a donation

**Donor app · Donate → Book now**

| Do | You will see | Say |
| --- | --- | --- |
| Tap **Donate**, then **Book now** | Step 1 of the booking wizard | "A donor books a donation the way they would book anything else." |
| Choose **Blood donation** | Step 2 — a list of places | |
| Tap **Show filters**, then **Region** | All 14 regions of Uzbekistan | "The whole country is in here — the fourteen regions, by their official codes." |
| Choose **Toshkent shahri**, then **District** | Districts in that region, with a note that district names are sample data | "The regions are the official list. The districts are placeholders until we import the official classifier — and the app says so rather than pretending." |
| Clear the region, pick **Northstar Hospital (Development)** | Address, services, opening hours, a DEMO badge | "Every fictional organization is labelled. Nothing here is a real hospital." |
| Pick a **date**, then a **time** | Available slots only | |
| **Review**, then **Confirm** | A confirmation screen with a reference like `DON-2026-…` | "That is a real booking, in the database, with a reference." |
| Go back to **Home** → tap the bell | A new notification: **Appointment Booked** | "And the donor is told, in the app — not only on the screen they happened to be looking at." |

### 3:30–4:30 — The hospital sees it

**Hospital console · `hospital.staff@donor.local` · `http://localhost:3000`**

| Do | You will see | Say |
| --- | --- | --- |
| Open **Appointments** | Today's list, with the booking that was just made | "Same moment, different building. The booking is already in the hospital's queue." |
| Open the booking | The donor's name, blood group, reference | "Staff see who is coming and what they have given before." |
| Click **Donors** | The donor directory, with verification status per donor | "This is where a blood group becomes a medical fact instead of a claim." |
| Search the donor's surname, click **Verify** | The verification panel — the group on file, who verified it, when | "A donor cannot verify their own blood group. Staff do it, and the system records who and when. That record cannot be edited by the donor." |
| Close the panel without saving | | |

### 4:30–5:15 — The donation is completed

**Hospital console, then back to the phone**

| Do | You will see | Say |
| --- | --- | --- |
| On the appointment, **Check in** | The donation opens | "The donor has arrived." |
| Record the **assessment**, then **Start** | Status moves through the collection | "A short health check first, then collection." |
| **Complete**, volume **450 mL** | The donation closes | "450 millilitres. One donation, one bag — and the bag is created in inventory in the same step. It is not possible to finish a donation here and have nothing appear in the fridge." |
| Back on the phone, pull to refresh **Home** | 4 donations, 1800 mL, a new next-eligible date | "The donor's history, total and next eligible date all move — from the same record, not a copy of it." |
| Tap the bell | A donation notification, and XP awarded | |

### 5:15–6:30 — A laboratory result

**Donor app → Blood-centre console → back**

| Do | You will see | Say |
| --- | --- | --- |
| Donor app: **Health → Laboratory → Book a test** | The laboratory booking flow | "The same donor books a blood test." |
| Book any available slot | A `LAB-2026-…` reference | |
| Blood-centre console, `blood.center.staff@donor.local` → **Laboratory** | The booking in the queue | "The blood centre sees it." |
| **Confirm → Check in → Start → Complete**, then enter the five values | Haemoglobin, red cells, white cells, haematocrit, platelets | "Staff enter what the analyser measured." |
| Sign in as `lab.reviewer@donor.local`, **Review**, then **Publish** | The result becomes visible to the donor | "A second person reviews before the donor sees anything. One person cannot enter a result and publish it alone." |
| Donor app: **Health → Laboratory** | The new result | |
| Tap **Health Trends → Haemoglobin** | A line across four points | "This donor has been tested four times now. The line is their own history — the app shows the trend, it does not interpret it. No diagnosis is being made here." |

### 6:30–8:30 — The emergency

This is the part to slow down for.

**Hospital console → donor app → hospital console**

| Do | You will see | Say |
| --- | --- | --- |
| Hospital console → **Emergency** → **New** | The emergency form | "A patient needs O-positive blood now." |
| Blood group **O+**, **2 units**, urgency **Critical**, then **Create** | A draft `SOS-2026-…` | |
| Click **Activate** | The request goes live and matched donors appear | "Activation runs the matching. It looks for donors whose blood is compatible, who are verified, who can be reached, and who are outside their recovery window — someone who gave blood last week is never asked." |
| Show the matched list | Our donor among them | "It found this donor. Nobody typed their name." |
| **Phone**: the SOS screen, or the notification | The emergency, with blood group, units and hospital | "On the donor's phone, immediately." |
| Tap into it, then **Yes, I can help** | The request moves to accepted | "Accepting is a commitment, so it is one clear action." |
| Tap **Start journey** | Location sharing begins | "From here the donor shares their location — only while they are on their way, and only with the hospital expecting them." |
| **Hospital console**, refresh the emergency | The donor shown as en route, with their position | "The hospital can see they are coming. That is the difference between hoping and knowing." |
| **Phone**: **I have arrived** | Status changes | |
| **Hospital console**: **Confirm arrival**, then **Complete** | The response closes and a donation is recorded | "And that donation is recorded as an emergency donation — linked to this request, not guessed from the donor's history." |
| **Phone**: Home | Totals updated again | |

**Getting GPS to cooperate** — do this *before* you present, not during:

- **iOS Simulator**: Features → Location → Custom Location… → latitude `41.3380`,
  longitude `69.2870`. Set it once; it persists.
- **Android emulator**: the `…` button → Location → enter the same coordinates →
  **Set location**. Send it once before you start.
- **A real phone**: allow location when the app asks, and be somewhere with a
  view of the sky. Stand near a window during the previous section.
- The app asks for permission the first time you tap **Start journey**. Grant it
  once, before the audience is watching.

If location never arrives, see the fallback in section 9. Do not fake it.

### 8:30–9:15 — Community and recognition

**Donor app**

| Do | You will see | Say |
| --- | --- | --- |
| **Community** | A feed, impact statistics, a leaderboard | "Donors see what their community has achieved together." |
| **Donate → Campaigns** | Active campaigns | "Blood centres run campaigns and the app carries them." |
| **Profile → Achievements** | Unlocked achievements | "Small acknowledgements. They cost nothing and they bring people back." |

### 9:15–10:00 — Uzbekistan, safety, and the close

**Admin console · `admin@donor.local` · `http://localhost:3003`** (optional)

| Do | You will see | Say |
| --- | --- | --- |
| **Organizations** | The directory, every entry marked DEMO | "Organizations are verified by the platform before they can act. Nobody can register a hospital and start requesting blood." |
| **Audit logs** | Real entries from the last ten minutes | "Everything you just watched is written down — who did what, when, from where." |

Then close the laptop lid on the demo and finish to the audience:

> "What you saw is one donation, one laboratory result and one emergency, end to
> end, on a real database. Three languages, the fourteen regions, and roles that
> keep each hospital's data to itself.
>
> What it is not, yet: this has not been through clinical validation or
> regulatory approval, and it is not connected to any real hospital system. That
> is the next conversation, and it is the right one to have with the Ministry
> and with the blood service, not with a laptop.
>
> Thank you."

---

## 6. Features to mention, not to open

Each of these works and is covered by tests. Talking about them costs ten
seconds; opening them costs two minutes and a risk.

| Feature | One sentence for the audience |
| --- | --- |
| **Courier delivery** | "When blood moves between buildings, a courier carries it and the app tracks the handover, so nobody loses a bag between two fridges." |
| **Inventory** | "Every blood centre sees what it holds, by group and by expiry date, and is warned before anything expires." |
| **Blood requests** | "A hospital can request units from a blood centre through the system instead of by telephone." |
| **Shipments** | "A request becomes a shipment with a temperature-sensitive package, tracked from door to door." |
| **Audit logs** | "Every action that touches a medical record is written down — who, what, when." |
| **Roles and permissions** | "A courier cannot read laboratory results. A hospital cannot see another hospital's donors. That is enforced on the server, not hidden in the interface." |
| **Organization verification** | "An organization has to be verified by the platform before it can request blood or verify a donor." |
| **Multilingual** | "Uzbek, Russian and English throughout — including the medical terms, which are reviewed separately." |
| **Phone sign-in with a one-time code** | "Sign-in by phone number with an SMS code, because that is how most people here would want to sign in." |
| **Campaigns** | "Blood centres run donation drives and can see who joined." |
| **Education** | "Short explanations of what donating involves, for people who have never done it." |
| **Analytics** | "Each organization sees its own activity — how many donations, which groups are short." |
| **Privacy and security** | "Passwords are hashed, sessions can be revoked, location is only shared during an emergency journey and is deleted afterwards." |
| **AI health insights** | "The app can summarise a donor's own trends in plain language. It does not diagnose, and it says so." |

---

## 7. Questions the audience will ask

**Is this real hospital data?**
No. Every person, hospital and blood centre in this database is invented, and
every organization is labelled DEMO in the interface. Nothing here came from a
real patient or a real hospital.

**Can anyone just say they are a donor?**
Anyone can register, the same as any app. But a self-declared blood group is
marked as self-reported and is not trusted by anything that matters: emergency
matching only considers donors whose blood group has been verified by staff.

**Who verifies the blood type?**
Authorised staff at a hospital or a blood centre, from a laboratory result or a
medical record. The system records who verified it, when, and on what basis, and
a donor cannot verify their own.

**What if a donor edits their blood group afterwards?**
The verification is withdrawn automatically — the profile goes back to "needs
review" and the donor stops being matched for emergencies until staff verify it
again.

**Can a donor complete their own donation?**
No. Only staff at the organization where the donation is happening can check a
donor in, record the assessment, or complete it. That is enforced by the server.

**What happens if the donor refuses GPS permission?**
They can still accept an emergency and still donate. Location sharing is
optional and only affects whether the hospital can see them approaching. The app
asks, explains why, and carries on if the answer is no.

**Is medical data secure?**
Passwords are hashed with argon2, sessions can be revoked, every request is
authorised against roles and permissions on the server, and every action on a
medical record is written to an audit log. Location history from an emergency
journey is deleted after a configurable retention period. It has not been
through an external security audit — that is on the list, not behind us.

**Does it work without internet?**
No. It needs a connection, like any system that has to tell a hospital something
now. Offline support is not built.

**Does the AI diagnose people?**
No. It summarises a donor's own measurements in plain language and repeatedly
says it is not medical advice. No clinical decision in this system is made by a
model.

**Can hospitals see each other's data?**
No. Each organization sees its own donations, appointments, inventory and
requests. Staff of one hospital asking for another's data get a refusal from the
server, not a filtered screen.

**Is this deployed in Uzbekistan already?**
No. This is a working system running locally. It has not been deployed, it has
not been through clinical or regulatory review, and it is not connected to any
hospital.

**How are emergency donors chosen?**
By blood compatibility, verified blood group, a contactable account, and being
outside the recovery window after their last donation. Compatible donors of
other groups are included — a universal O-negative donor is reached for an
A-positive patient — but exact-group donors are ranked first so the rarest blood
is not spent unnecessarily.

**Can it work for the whole country?**
The data model is national: all fourteen regions, districts, and organizations
with their own geography. Whether it *scales* to national traffic is an
engineering question we have not tested at that volume, and I would not claim it
until we had.

**What languages does it support?**
Uzbek, Russian and English, across the donor app and all three consoles. Uzbek
is the default.

**How do you stop someone registering a fake hospital?**
An organization cannot act until the platform verifies it. Until then it can
neither request blood nor verify donors.

**What happens to donated blood after collection?**
Completing a donation creates a blood unit in that organization's inventory,
with its group, volume and collection time. From there it can be reserved,
shipped to a hospital and marked as used. The system will not let a donation be
completed without creating the unit.

**How long before a donor can give again?**
56 days for whole blood, in this configuration. The system enforces it at
booking and again at check-in, and will not offer that donor to an emergency
either.

**What if two hospitals need the same donor at once?**
A donor who is already answering one emergency is not offered to another. They
finish or cancel first.

**Does a donor get told their results before a doctor sees them?**
No. A result is entered by one person and reviewed by another before it is
published to the donor. Nothing reaches the donor unreviewed.

**What does it cost to run?**
We have not costed a deployment. What I can say is what it is built on: an
ordinary PostgreSQL database and a standard web stack, no specialised hardware.

**Who owns the donor's data?**
The donor. They can see everything held about them in the app. Deletion and
export rights would have to be settled against Uzbek data protection law before
any deployment — that is a legal conversation we have not had yet.

**How is it different from a phone call?**
A phone call reaches the people you can think of. This reaches everyone who is
compatible, verified and available, at the same time, and shows the hospital who
is coming.

**Is the blockchain in the name real?**
The name is aspirational. There is no blockchain in what you just saw — it is an
audited database. I would rather tell you that than let the name do the talking.

---

## 8. Things not to open

Not because they are broken, but because they are unfinished in ways an audience
will notice and you will have to explain.

| Do not | Why |
| --- | --- |
| **Security → Sessions** | Every session offers a "Revoke" link, including the one you are using. Nothing records which session is current. |
| **Push notifications on a real device** | Push needs a registered device and a build. Every notification in this demo is in-app, which is enough to show — do not promise a phone buzzing. |
| **AI insight "confidence"** | The insight cards are real; a confidence percentage is not produced by the pipeline. Do not point at a number that is not there. |
| **Distance on the SOS card** | The donor's distance from the hospital is not computed. The card shows time remaining and units needed — talk about those. |
| **The courier flow, live** | It works, but it is a fourth actor and a fourth login. Mention it (section 6); do not open it inside ten minutes. |
| **Registering a brand-new account live** | Registration requires email verification, which means finding the message. Use the seeded donor. |
| **`recent.donor@donor.local`** | That donor is deliberately inside their recovery window — useful for showing a refusal, confusing if opened by accident. |

---

## 9. When something goes wrong

Every one of these keeps you honest. None of them shows a result that did not
happen.

**Expo disconnects, or the app shows a red screen**
Press `r` in the Expo terminal to reload. If that fails, shake the device →
Reload. Your place in the demo is unaffected: the database has not changed, so
sign in again and carry on from the same step.
*Say:* "The development server dropped — one moment." Nothing more.

**The API restarts, or stops answering**
In the `demo:start` terminal, Ctrl-C and run `pnpm demo:start` again. Then
`pnpm demo:check` before continuing. Data survives a restart — nothing is in
memory.
*Say:* "I am restarting the server. The data is in the database, so nothing is
lost."

**A console logs you out**
The access token lasts 15 minutes and refreshes silently; a logout usually means
the API restarted. Sign in again with the same account from section 2.

**GPS takes too long, or never arrives**
Wait no more than about 20 seconds, then move on. The donor can still arrive and
the hospital can still confirm — location is an enhancement, not the mechanism.
*Say:* "Location is not coming through on this network, so let me do the part
that does not depend on it — the donor marks arrival, and the hospital confirms
it." Then do exactly that. **Do not** type coordinates into the database.

**A notification does not appear**
Pull to refresh. Notifications are raised by a handler a moment after the action,
so they can lag a second or two. If it still does not appear, open the bell icon
directly — the list is fetched fresh.
*Say:* "It arrives a moment after the action, let me refresh."

**A browser tab shows stale data**
Refresh the page. Every console reads from the API on load; nothing is cached
across a reload.

**The donor is not matched by the emergency**
Almost always because a previous run left them mid-SOS. Run `pnpm demo:reset`,
sign in again, and redo the emergency section. `pnpm demo:check` reports this as
**Presentation donor: free for the live SOS**.

**You changed the demo data by accident**
`pnpm demo:reset` — about 20 seconds — then sign in again on every device,
because a reset issues new accounts ids and old sessions stop working. This has
been tested: run the whole demo, reset, and the database is byte-for-byte back at
the starting state described in section 3.

**Something genuinely does not work in front of the audience**
Say so plainly, move to the next section, and offer to show it afterwards. An
audience forgives a bug in a live demo. It does not forgive being told something
worked when it did not.

---

## 10. After the presentation

```bash
pnpm demo:reset
```

Leave the database at the starting state, so the next person to open this
project finds the same demo you did.
