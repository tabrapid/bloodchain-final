'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Droplet,
  FlaskConical,
  HeartPulse,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { StatCard, DataTable } from '@bloodchain/ui/components';
import * as donors from '../lib/api/donors';
import * as donations from '../lib/api/donations';
import * as appointments from '../lib/api/appointments';
import * as games from '../lib/api/gamification';
import * as trends from '../lib/api/health-trends';
import * as users from '../lib/api/users';
import * as organizations from '../lib/api/organizations';
import * as sessions from '../lib/api/sessions';
import { authAction } from '../lib/api/auth';
import { TrendChart } from './TrendChart';
import {
  Action,
  Badge,
  Empty,
  Field,
  FormMessage,
  Panel,
  Resource,
  date,
  useResource,
} from './common';
const overview = async () => {
  const [profile, stats, next, level] = await Promise.all([
    donors.getDonorProfile(),
    donations.getMyDonationStatistics(),
    appointments.getNextAppointment(),
    games.getGamificationProfile(),
  ]);
  return { profile, stats, next, level };
};
export function Overview() {
  const r = useResource(overview);
  const d = r.data;
  return (
    <Resource {...r} retry={r.reload}>
      {d && (
        <>
          <section className="donor-welcome">
            <div>
              <span className="donor-eyebrow">SIZNING DONORLIK YO‘LINGIZ</span>
              <h2>Salom, {d.profile.user.firstName}!</h2>
              <p>Har bir donatsiya — yana bir imkoniyat.</p>
              <Link href="/appointments" className="primary">
                Qabulga yozilish <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="donor-blood-card">
              <Droplet size={28} />
              <strong>
                {d.profile.bloodType ?? '—'}
                {d.profile.rhFactor === 'POSITIVE'
                  ? '+'
                  : d.profile.rhFactor === 'NEGATIVE'
                    ? '−'
                    : ''}
              </strong>
              <span>
                {d.profile.bloodTypeVerifiedAt
                  ? 'Qon guruhi tasdiqlangan'
                  : 'Qon guruhi tasdiqlanmagan'}
              </span>
            </div>
          </section>
          <div className="donor-metrics">
            <StatCard label="Donatsiyalar" value={String(d.stats.totalDonations)} icon={Droplet} />
            <StatCard
              label="Topshirilgan qon"
              value={`${d.stats.totalVolumeMl} ml`}
              icon={HeartPulse}
            />
            <StatCard
              label="Daraja"
              value={String(d.level.level)}
              note={`${d.level.totalXp} XP`}
              icon={ShieldCheck}
            />
          </div>
          <div className="donor-columns">
            <Panel title="Keyingi qabul">
              {d.next ? (
                <>
                  <Badge>{d.next.status}</Badge>
                  <h3>{d.next.organization.name}</h3>
                  <p>{date(d.next.scheduledStart)}</p>
                  <Link href="/appointments">Qabulni boshqarish →</Link>
                </>
              ) : (
                <Empty>
                  Yaqinlashayotgan qabul yo‘q. <Link href="/appointments">Vaqt tanlang</Link>
                </Empty>
              )}
            </Panel>
            <Panel title="Donorlik holati">
              <dl className="donor-details">
                <div>
                  <dt>Holat</dt>
                  <dd>
                    <Badge>{d.profile.donorStatus}</Badge>
                  </dd>
                </div>
                <div>
                  <dt>Keyingi donatsiya sanasi</dt>
                  <dd>
                    {d.stats.nextDonationDate
                      ? date(d.stats.nextDonationDate)
                      : 'Tibbiy baholashda aniqlanadi'}
                  </dd>
                </div>
              </dl>
              <p className="donor-muted">
                Donatsiyaga ruxsat tibbiy ko‘rik natijasida belgilanadi.
              </p>
            </Panel>
          </div>
          <div className="donor-quick-links">
            {[
              [CalendarDays, 'Qabul va bronlar', 'appointments'],
              [FlaskConical, 'Tahlil natijalari', 'laboratory'],
              [HeartPulse, 'Sog‘liq dinamikasi', 'health'],
            ].map(([Icon, label, href]) => {
              const I = Icon as typeof Droplet;
              return (
                <Link key={String(href)} href={`/${href}`}>
                  <I size={23} />
                  <span>{String(label)}</span>
                  <ArrowUpRight size={16} />
                </Link>
              );
            })}
          </div>
        </>
      )}
    </Resource>
  );
}
export function Donations() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<donations.Donation>();
  const load = useCallback(
    () => donations.getMyDonations({ page, limit: 15, status: status || undefined }),
    [page, status],
  );
  const r = useResource(load);
  return (
    <Panel
      title="Donatsiyalar tarixi"
      actions={
        <select
          aria-label="Donatsiya holati"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Barcha holatlar</option>
          {['COMPLETED', 'CANCELLED', 'IN_PROGRESS', 'ABORTED'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      }
    >
      <Resource {...r} retry={r.reload}>
        {r.data && (
          <>
            <DataTable
              columns={[
                { key: 'donationReference', header: 'Raqam' },
                { key: 'organization', header: 'Markaz', render: (d) => d.organization.name },
                { key: 'createdAt', header: 'Sana', render: (d) => date(d.createdAt) },
                { key: 'volumeMl', header: 'Hajm (ml)' },
                { key: 'status', header: 'Holat', render: (d) => <Badge>{d.status}</Badge> },
              ]}
              rows={r.data.data}
              keyExtractor={(d) => d.id}
              onRowClick={setSelected}
            />
            <div className="donor-pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                ← Oldingi
              </button>
              <span>
                {page} / {r.data.meta?.totalPages ?? page}
              </span>
              <button
                disabled={!r.data.meta || page >= r.data.meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Keyingi →
              </button>
            </div>
          </>
        )}
      </Resource>
      {selected && (
        <Panel
          title={selected.donationReference}
          actions={<button onClick={() => setSelected(undefined)}>Yopish</button>}
        >
          <dl className="donor-details">
            {[
              ['Turi', selected.donationType],
              ['Holat', selected.status],
              ['Markaz', selected.organization.name],
              ['Yakunlangan', date(selected.completedAt)],
              ['Keyingi sana', date(selected.nextDonationDate)],
              [
                'Izoh',
                selected.rejectedReason ??
                  selected.abortedReason ??
                  selected.cancellationReason ??
                  '—',
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      )}
    </Panel>
  );
}
export function Health() {
  const summary = useResource(trends.getTrendSummary);
  const [parameter, setParameter] = useState('');
  const [range, setRange] = useState('3M');
  const load = useCallback(
    () => (parameter ? trends.getParameterTrend(parameter, { range }) : Promise.resolve(null)),
    [parameter, range],
  );
  const r = useResource(load);
  return (
    <>
      <Panel title="Sog‘liq dinamikasi">
        <Resource {...summary} retry={summary.reload}>
          {summary.data && (
            <>
              <p>
                Jami tahlillar: <strong>{summary.data.totalTests}</strong> · Oxirgi tahlil:{' '}
                {date(summary.data.lastTestDate)}
              </p>
              <div className="donor-form-grid">
                <Field label="Ko‘rsatkich">
                  <select value={parameter} onChange={(e) => setParameter(e.target.value)}>
                    <option value="">Ko‘rsatkichni tanlang</option>
                    {summary.data.availableParameters.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.unit})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Davr">
                  <select value={range} onChange={(e) => setRange(e.target.value)}>
                    {['1M', '3M', '6M', '1Y', '2Y', 'ALL'].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
              </div>
              {!summary.data.availableParameters.length && <Empty />}
            </>
          )}
        </Resource>
      </Panel>
      {parameter && (
        <Panel title="O‘lchovlar tarixi">
          <Resource {...r} retry={r.reload}>
            {r.data ? (
              <>
                <div className="donor-trend-summary">
                  <strong>
                    {r.data.latestValue} {r.data.unit}
                  </strong>
                  <Badge>{r.data.trend}</Badge>
                </div>
                <TrendChart points={r.data.points} unit={r.data.unit} />
                <DataTable
                  rows={r.data.points}
                  keyExtractor={(p) => `${p.date}-${p.resultId}`}
                  columns={[
                    { key: 'date', header: 'Sana', render: (p) => date(p.date) },
                    { key: 'value', header: 'Qiymat' },
                    { key: 'unit', header: 'Birlik' },
                    { key: 'referenceMin', header: 'Min.' },
                    { key: 'referenceMax', header: 'Maks.' },
                    { key: 'laboratoryName', header: 'Laboratoriya' },
                  ]}
                />
                <p className="donor-muted">
                  Ko‘rsatkichlar tashxis emas. Natijalarni shifokor bilan muhokama qiling.
                </p>
              </>
            ) : (
              <Empty />
            )}
          </Resource>
        </Panel>
      )}
    </>
  );
}
const profileLoad = async () => ({
  user: await users.getUserProfile(),
  donor: await donors.getDonorProfile(),
  completion: await donors.getProfileCompletion(),
});
export function Profile() {
  const r = useResource(profileLoad);
  return (
    <Resource {...r} retry={r.reload}>
      {r.data && (
        <ProfileForm
          key={r.data.user.id + r.data.donor.updatedAt}
          data={r.data}
          reload={r.reload}
        />
      )}
    </Resource>
  );
}
function ProfileForm({
  data,
  reload,
}: {
  data: Awaited<ReturnType<typeof profileLoad>>;
  reload: () => Promise<void>;
}) {
  const [user, setUser] = useState({
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    displayName: data.user.displayName ?? '',
    phone: data.user.phone ?? '',
  });
  const [donor, setDonor] = useState({
    bloodType: data.donor.bloodType ?? '',
    rhFactor: data.donor.rhFactor ?? '',
    city: data.donor.city ?? '',
    district: data.donor.district ?? '',
    dateOfBirth: (data.donor.dateOfBirth ?? '').slice(0, 10),
    consentLocation: data.donor.consentLocation,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Panel title="Profilni to‘ldirish">
        <progress max={100} value={data.completion.percentage} />
        <p>{data.completion.percentage}% to‘ldirilgan</p>
        <p className="donor-muted">{data.completion.missing.join(', ')}</p>
      </Panel>
      <Panel title="Shaxsiy ma’lumotlar">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await users.updateUserProfile(
                Object.fromEntries(Object.entries(user).filter(([, v]) => v)),
              );
              await donors.updateDonorProfile({
                ...donor,
                bloodType: donor.bloodType || undefined,
                rhFactor: donor.rhFactor || undefined,
                dateOfBirth: donor.dateOfBirth || undefined,
              });
              setSuccess('Ma’lumotlar saqlandi.');
              await reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Saqlanmadi');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="donor-form-grid">
            {(Object.keys(user) as (keyof typeof user)[]).map((k) => (
              <Field
                key={k}
                label={
                  {
                    firstName: 'Ism',
                    lastName: 'Familiya',
                    displayName: 'Ko‘rinadigan ism',
                    phone: 'Telefon',
                  }[k]
                }
              >
                <input
                  required={k === 'firstName' || k === 'lastName'}
                  value={user[k]}
                  onChange={(e) => setUser({ ...user, [k]: e.target.value })}
                />
              </Field>
            ))}
            <Field label="Qon guruhi">
              <select
                value={donor.bloodType}
                onChange={(e) => setDonor({ ...donor, bloodType: e.target.value })}
              >
                <option value="">Noma’lum</option>
                {['O', 'A', 'B', 'AB'].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Rh faktor">
              <select
                value={donor.rhFactor}
                onChange={(e) => setDonor({ ...donor, rhFactor: e.target.value })}
              >
                <option value="">Noma’lum</option>
                <option value="POSITIVE">Musbat (+)</option>
                <option value="NEGATIVE">Manfiy (−)</option>
              </select>
            </Field>
            {(['city', 'district', 'dateOfBirth'] as const).map((k) => (
              <Field
                key={k}
                label={{ city: 'Shahar', district: 'Tuman', dateOfBirth: 'Tug‘ilgan sana' }[k]}
              >
                <input
                  type={k === 'dateOfBirth' ? 'date' : 'text'}
                  value={donor[k]}
                  onChange={(e) => setDonor({ ...donor, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <label className="donor-check">
            <input
              type="checkbox"
              checked={donor.consentLocation}
              onChange={(e) => setDonor({ ...donor, consentLocation: e.target.checked })}
            />
            Joylashuv ma’lumotidan foydalanishga roziman
          </label>
          <p className="donor-muted">Qon guruhini faqat tibbiy tashkilot tasdiqlaydi.</p>
          <FormMessage error={error} success={success} />
          <button className="primary" disabled={busy}>
            Saqlash
          </button>
        </form>
      </Panel>
    </>
  );
}
export function Security() {
  const r = useResource(sessions.getSessions);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Panel title="Parolni o‘zgartirish">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await authAction('change-password', { currentPassword: current, newPassword: next });
              setCurrent('');
              setNext('');
              setSuccess('Parol yangilandi. Boshqa qurilmalar sessiyalari yopildi.');
              await r.reload();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Xato');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="donor-form-grid">
            <Field label="Hozirgi parol">
              <input
                required
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>
            <Field label="Yangi parol">
              <input
                required
                minLength={8}
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </Field>
          </div>
          <FormMessage error={error} success={success} />
          <button disabled={busy}>Parolni yangilash</button>
        </form>
      </Panel>
      <Panel title="Faol sessiyalar">
        <Resource {...r} retry={r.reload}>
          {r.data?.map((s) => (
            <div className="donor-list-row" key={s.id}>
              <div>
                <strong>{s.deviceName ?? s.deviceType ?? 'Qurilma'}</strong>
                <p>
                  {s.ipAddress} · {date(s.lastUsedAt ?? s.createdAt)}{' '}
                  {s.isCurrent && '· Shu qurilma'}
                </p>
              </div>
              <Action
                confirm="Ushbu sessiyani yopasizmi?"
                onClick={async () => {
                  await sessions.revokeSession(s.id);
                  if (s.isCurrent) window.location.assign('/auth');
                  else await r.reload();
                }}
              >
                Yopish
              </Action>
            </div>
          ))}
          <Action
            danger
            confirm="Barcha qurilmalardan chiqasizmi?"
            onClick={async () => {
              await sessions.revokeAllSessions();
              window.location.assign('/auth');
            }}
          >
            Barcha sessiyalarni yopish
          </Action>
        </Resource>
      </Panel>
      <Panel title="Maxfiylik va akkauntni o‘chirish">
        <p>
          Akkauntni o‘chirish qaytarib bo‘lmaydigan amal. Tibbiy yozuvlar qonuniy saqlash
          talablariga muvofiq saqlanishi mumkin.
        </p>
        <Action
          danger
          confirm="Akkauntingizni butunlay o‘chirishni tasdiqlaysizmi?"
          onClick={async () => {
            await users.deleteAccount();
            window.location.assign('/auth');
          }}
        >
          Akkauntni o‘chirish
        </Action>
      </Panel>
    </>
  );
}

export function Organizations() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    radiusKm: number;
  }>();
  const [error, setError] = useState('');
  const load = useCallback(
    () => organizations.discoverOrganizations({ search: query, page, limit: 12, ...location }),
    [query, page, location],
  );
  const r = useResource(load);
  return (
    <Panel title="Donorlik va laboratoriya markazlari">
      <form
        className="donor-form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
          setPage(1);
        }}
      >
        <Field label="Markaz nomi yoki manzili">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish…"
          />
        </Field>
        <div className="donor-buttons">
          <button>Qidirish</button>
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) {
                setError('Joylashuv xizmati mavjud emas.');
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (p) => {
                  setLocation({
                    latitude: p.coords.latitude,
                    longitude: p.coords.longitude,
                    radiusKm: 50,
                  });
                  setPage(1);
                  setError('');
                },
                () => setError('Joylashuvni olishga ruxsat berilmadi.'),
              );
            }}
          >
            Yaqin atrofda (50 km)
          </button>
          {location && (
            <button type="button" onClick={() => setLocation(undefined)}>
              Masofa filtrini tozalash
            </button>
          )}
        </div>
      </form>
      <FormMessage error={error} />
      <Resource {...r} retry={r.reload}>
        {r.data && (
          <>
            <div className="donor-card-grid">
              {r.data.organizations.map((o) => (
                <article className="donor-content-card" key={o.id}>
                  <Badge>
                    {o.isVerified ? 'Tasdiqlangan markaz' : 'Markaz'}
                    {o.isDemo ? ' · Demo' : ''}
                  </Badge>
                  <h3>{o.name}</h3>
                  <p>{o.address}</p>
                  <p>{o.publicPhone ?? o.phone}</p>
                  <p>{o.distanceKm != null ? `${o.distanceKm.toFixed(1)} km` : ''}</p>
                  <p>{o.services.map((s) => s.service).join(' · ')}</p>
                  {o.directionsNote && <p>{o.directionsNote}</p>}
                  <div className="donor-buttons">
                    {o.acceptsDonations && <Link href="/appointments">Donatsiyaga yozilish →</Link>}
                    {o.providesLaboratory && <Link href="/laboratory">Tahlilga yozilish →</Link>}
                    {o.latitude != null &&
                      o.longitude != null &&
                      Number.isFinite(Number(o.latitude)) &&
                      Number.isFinite(Number(o.longitude)) && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.latitude},${o.longitude}`)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Xaritada ko‘rish ↗
                        </a>
                      )}
                  </div>
                </article>
              ))}
            </div>
            {!r.data.organizations.length && <Empty />}
            <div className="donor-pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Oldingi
              </button>
              <span>
                {page} / {r.data.totalPages}
              </span>
              <button disabled={page >= r.data.totalPages} onClick={() => setPage(page + 1)}>
                Keyingi
              </button>
            </div>
          </>
        )}
      </Resource>
    </Panel>
  );
}
