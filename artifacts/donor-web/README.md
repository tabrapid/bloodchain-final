# Donor web verification

The screenshots show synthetic development data from the local seeded PostgreSQL database, served through the actual API and donor gateway. They are not screenshots of a live public deployment.

- `desktop.png`: 1440px donor dashboard.
- `mobile.png`: 390px responsive dashboard.

Verified locally:

- Full repository `pnpm verify` passed after integrating the latest branch: all workspace typechecks/lints/unit tests, and 291 API end-to-end tests.
- Donor-specific regression suite: 17 tests covering secure cookie transport, origin rejection, session refresh/revocation, pagination, booking success/conflict/confirmation and account entry/recovery.
- Browser login and all 15 donor sections passed against the real API; no browser runtime errors or horizontal mobile overflow.
- A web-created donor reservation was readable by a separate admin session, then cancellation updated the donor worklist.
- Profile edits persisted in the shared user API.
- Donor and landing production builds passed.
- API and donor Docker images built successfully on Node 22.22.2. Their runtime was checked together using Docker service DNS and the disposable database.
- Forced expired access-cookie renewal succeeded through the real gateway/API.
- Nested environment files were verified absent from both shipping images.
- Deployment script syntax, merged Compose service validation and `--check` passed.

Public DNS/HTTPS/VPS deployment remains unverified: the DNS A record has not been added and SSH from the cloud executor is refused. See `docs/donor-web.md` for the tested workflow and deployment procedure.
