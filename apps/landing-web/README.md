# BloodChain public landing

Uzbek-language entry point for `bloodchain.uz`, implemented from the user's
uploaded design brief. This revision uses navy/white, clinical-blue actions,
red donor accents, local Inter, soft gradients and rounded cards. The other
portals retain their earlier palette changes.

```bash
# From repository root, with the repository's Node/pnpm versions active:
pnpm dev:landing                 # port 3004
pnpm --filter @bloodchain/landing-web typecheck
pnpm --filter @bloodchain/landing-web lint
pnpm --filter @bloodchain/landing-web build
```

Stop the landing dev server before building: both use `.next`. For the built
app: `pnpm --filter @bloodchain/landing-web exec next start -p 3004`.

- Hero: donor and institution calls to action, plus real product demo captures.
- Audience cards, trust principles, problem/solution, donor steps, module bento,
  portal links, partnership form, FAQ, contact and legal-information footer.
- Partnership recipient is `jaloliddinabduganiyev5@gmail.com`, confirmed by the
  user. The form validates locally and prepares an explicit email draft. It
  does not POST, send email, persist form data, or register/activate accounts.
  The user reviews and sends through their own email application, or copies
  the draft. No SMTP credentials or backend changes are needed for this flow.
- `/privacy` and `/terms` explain the landing behavior and clearly identify the
  full operator/legal documents as pending, rather than publishing repository
  drafts as approved policies.
- No fabricated partner logos, impact figures, clinical guarantees or store links.
- Previews originate from existing synthetic QA captures:
  `artifacts/clinical-workspace-qa/hospital-dashboard.jpg` and
  `artifacts/mobile-v4-visual-qa/android-412x915/tabs/home/light.png`.
  They are labelled as demos, not live production information.
- Inter font files are copied from the installed `@expo-google-fonts/inter`
  package. Its SIL Open Font License is retained in `app/fonts/OFL.txt`.
  No external font service is contacted.

Evidence and repeatable browser checks: `artifacts/landing-v3/`. Earlier v2
captures/checks are historical and describe a superseded layout. This revision
has not been deployed to the production domain.
