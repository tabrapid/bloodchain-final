'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, Save, ShieldCheck, TriangleAlert } from 'lucide-react';
import { EmptyState } from '@bloodchain/ui/components';
import { useTranslation } from '@bloodchain/ui/i18n';
import { me, isAuthenticated, MeResponse } from '../../lib/auth';
import {
  geoName,
  getDirectoryEntry,
  getGeographyCoverage,
  listDistricts,
  listRegions,
  updateDirectoryEntry,
  weekOfHours,
  ORGANIZATION_SERVICES,
  type DirectoryOrganization,
  type District,
  type GeographyCoverage,
  type OpeningHours,
  type OrganizationServiceType,
  type Region,
} from '../../lib/directory';
import { AppShell } from '../../components/AppShell';

/**
 * Which organization this portal is editing, and what the shell calls it.
 *
 * A hospital administrator belongs to exactly one hospital in practice, but the
 * membership list is an array: the type is preferred rather than assumed, and
 * the first membership is the fallback, so an account attached to something
 * unexpected still lands on a real organization instead of a blank page.
 */
const PORTAL = {
  organizationType: 'HOSPITAL',
  subtitleKey: 'portal.hospital.console',
  workspace: 'Hospital workspace',
  fallbackName: 'Hospital',
} as const;

/** A number the API will accept, or null; anything else is left for the user. */
function parseCoordinate(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function OrganizationDirectoryPage() {
  const { t, locale, formatWeekday } = useTranslation();
  const [user, setUser] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<DirectoryOrganization | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [coverage, setCoverage] = useState<GeographyCoverage | null>(null);

  const [regionId, setRegionId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [address, setAddress] = useState('');
  const [directionsNote, setDirectionsNote] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [publicPhone, setPublicPhone] = useState('');
  const [acceptsDonations, setAcceptsDonations] = useState(false);
  const [providesLaboratory, setProvidesLaboratory] = useState(false);
  const [services, setServices] = useState<OrganizationServiceType[]>([]);
  const [hours, setHours] = useState<OpeningHours[]>(weekOfHours([]));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /** Fills the form from an entry, so "reset" and "loaded" are the same code. */
  const applyEntry = useCallback((entry: DirectoryOrganization) => {
    setOrganization(entry);
    setRegionId(entry.region?.id ?? '');
    setDistrictId(entry.district?.id ?? '');
    setAddress(entry.address ?? '');
    setDirectionsNote(entry.directionsNote ?? '');
    setLatitude(entry.latitude === null ? '' : String(entry.latitude));
    setLongitude(entry.longitude === null ? '' : String(entry.longitude));
    setPublicPhone(entry.publicPhone ?? '');
    setAcceptsDonations(entry.acceptsDonations);
    setProvidesLaboratory(entry.providesLaboratory);
    setServices(entry.services.map((item) => item.service));
    setHours(weekOfHours(entry.hours));
  }, []);

  useEffect(() => {
    async function load() {
      try {
        if (!isAuthenticated()) return;
        const userData = await me();
        setUser(userData);
        const membership =
          userData.organizations.find((org) => org.type === PORTAL.organizationType) ??
          userData.organizations[0];
        if (!membership) return;

        const [entry, regionList, coverageData] = await Promise.all([
          getDirectoryEntry(membership.organizationId),
          listRegions(),
          getGeographyCoverage(),
        ]);
        setRegions(regionList);
        setCoverage(coverageData);
        applyEntry(entry);
      } catch (err) {
        console.error('Failed to load the directory entry:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [applyEntry]);

  // Districts follow the region, and a district from the previous region is
  // dropped: the server rejects the mismatch, and keeping it in the form would
  // turn every save into the same unexplained error.
  useEffect(() => {
    if (!regionId) {
      setDistricts([]);
      setDistrictId('');
      return;
    }
    let cancelled = false;
    listDistricts(regionId)
      .then((list) => {
        if (cancelled) return;
        setDistricts(list);
        setDistrictId((current) => (list.some((d) => d.id === current) ? current : ''));
      })
      .catch((err) => console.error('Failed to load districts:', err));
    return () => {
      cancelled = true;
    };
  }, [regionId]);

  const toggleService = (service: OrganizationServiceType) => {
    setServices((current) =>
      current.includes(service)
        ? current.filter((item) => item !== service)
        : [...current, service],
    );
  };

  const setDay = (dayOfWeek: number, patch: Partial<OpeningHours>) => {
    setHours((current) =>
      current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)),
    );
  };

  /** A Sunday, so adding the weekday index lands on that weekday's name. */
  const weekAnchor = useMemo(() => new Date(Date.UTC(2024, 0, 7)), []);
  const weekdayName = (dayOfWeek: number) => {
    const date = new Date(weekAnchor);
    date.setUTCDate(weekAnchor.getUTCDate() + dayOfWeek);
    return formatWeekday(date, 'long');
  };

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setError(null);
    setSaved(false);

    const lat = parseCoordinate(latitude);
    const lon = parseCoordinate(longitude);
    if (lat === undefined || lon === undefined) {
      setError(t('directory.coordinatesInvalid'));
      return;
    }

    setSaving(true);
    try {
      const updated = await updateDirectoryEntry(organization.id, {
        regionId: regionId || null,
        districtId: districtId || null,
        address: address.trim() || null,
        directionsNote: directionsNote.trim() || null,
        latitude: lat,
        longitude: lon,
        publicPhone: publicPhone.trim() || null,
        acceptsDonations,
        providesLaboratory,
        services: services.map((service) => ({ service })),
        // Only the days that are actually open carry times; a closed day is
        // stored closed rather than as a day with empty hours.
        hours: hours.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          isClosed: day.isClosed,
          ...(day.isClosed
            ? {}
            : {
                ...(day.opensAt ? { opensAt: day.opensAt } : {}),
                ...(day.closesAt ? { closesAt: day.closesAt } : {}),
              }),
        })),
      });
      applyEntry(updated);
      setSaved(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message || t('directory.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const shell = {
    title: t('directory.entry'),
    subtitle: PORTAL.subtitleKey ? t(PORTAL.subtitleKey) : undefined,
    organizationName: organization?.name ?? PORTAL.fallbackName,
    organizationType: PORTAL.workspace,
    userName: user ? `${user.firstName} ${user.lastName}` : t('ops.common.loadingEllipsis'),
  };

  if (isLoading) {
    return (
      <AppShell {...shell} userName={t('ops.common.loadingEllipsis')}>
        <div className="flex items-center justify-center p-12">
          <Building2 className="animate-spin text-donor-primary" size={32} />
        </div>
      </AppShell>
    );
  }

  if (!user || !organization) {
    return (
      <AppShell {...shell}>
        <div className="bc-glass rounded-card p-8">
          <EmptyState
            title={t('portal.authRequired')}
            description={t('ops.common.signInRequired')}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell {...shell}>
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-donor-text">
              {t('directory.entry')}
            </h1>
            <p className="text-sm text-donor-muted">{t('directory.entryHint')}</p>
          </div>
          <div className="flex items-center gap-3">
            {organization.isVerified ? (
              <span className="flex items-center gap-1.5 rounded-full bg-donor-successMuted px-3 py-1.5 text-xs font-semibold text-donor-onSuccessMuted">
                <ShieldCheck size={14} />
                {t('directory.verified')}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bc-solid px-3 py-1.5 text-xs font-semibold text-donor-muted">
                {t('directory.notVerified')}
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-donor-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Save size={16} />
              {t('directory.save')}
            </button>
          </div>
        </div>

        {organization.isDemo && (
          <div className="flex items-start gap-2 rounded-card bg-donor-warningMuted p-4 text-sm text-donor-onWarningMuted">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{t('directory.demoHint')}</span>
          </div>
        )}
        {error && (
          <div className="rounded-card bg-donor-dangerMuted p-4 text-sm text-donor-onDangerMuted">
            {error}
          </div>
        )}
        {saved && (
          <div className="rounded-card bg-donor-successMuted p-4 text-sm text-donor-onSuccessMuted">
            {t('directory.saved')}
          </div>
        )}

        <section className="bc-glass rounded-card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-donor-text">
            <MapPin size={18} className="text-donor-primary" />
            {t('directory.address')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-donor-muted">{t('directory.region')}</span>
              <select
                value={regionId}
                onChange={(event) => setRegionId(event.target.value)}
                className="rounded-lg bc-solid px-3 py-2 text-donor-text"
              >
                <option value="">{t('directory.anyRegion')}</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {geoName(region, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-donor-muted">{t('directory.district')}</span>
              <select
                value={districtId}
                onChange={(event) => setDistrictId(event.target.value)}
                disabled={!regionId}
                className="rounded-lg bc-solid px-3 py-2 text-donor-text disabled:opacity-50"
              >
                <option value="">
                  {regionId ? t('directory.anyDistrict') : t('directory.chooseRegionFirst')}
                </option>
                {districts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {geoName(district, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
              <span className="text-donor-muted">{t('directory.address')}</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                maxLength={300}
                className="rounded-lg bc-solid px-3 py-2 text-donor-text"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
              <span className="text-donor-muted">{t('directory.directions')}</span>
              <input
                value={directionsNote}
                onChange={(event) => setDirectionsNote(event.target.value)}
                maxLength={300}
                className="rounded-lg bc-solid px-3 py-2 text-donor-text"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-donor-muted">{t('directory.latitude')}</span>
              <input
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                inputMode="decimal"
                className="rounded-lg bc-solid px-3 py-2 text-donor-text"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-donor-muted">{t('directory.longitude')}</span>
              <input
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                inputMode="decimal"
                className="rounded-lg bc-solid px-3 py-2 text-donor-text"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
              <span className="text-donor-muted">{t('directory.publicPhone')}</span>
              <input
                value={publicPhone}
                onChange={(event) => setPublicPhone(event.target.value)}
                maxLength={32}
                className="rounded-lg bc-solid px-3 py-2 text-donor-text"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-donor-muted">{t('directory.coordinatesHint')}</p>
          {coverage?.districtsAuthoritative === false && (
            <p className="mt-1 text-xs text-donor-muted">{t('directory.demoDistricts')}</p>
          )}
        </section>

        <section className="bc-glass rounded-card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-donor-text">
            {t('directory.capabilities')}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-donor-text">
              <input
                type="checkbox"
                checked={acceptsDonations}
                onChange={(event) => setAcceptsDonations(event.target.checked)}
              />
              {t('directory.acceptsDonations')}
            </label>
            <label className="flex items-center gap-2 text-sm text-donor-text">
              <input
                type="checkbox"
                checked={providesLaboratory}
                onChange={(event) => setProvidesLaboratory(event.target.checked)}
              />
              {t('directory.providesLaboratory')}
            </label>
          </div>
        </section>

        <section className="bc-glass rounded-card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold text-donor-text">
            {t('directory.services')}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {ORGANIZATION_SERVICES.map((service) => (
              <label key={service} className="flex items-center gap-2 text-sm text-donor-text">
                <input
                  type="checkbox"
                  checked={services.includes(service)}
                  onChange={() => toggleService(service)}
                />
                {t(`medical.services.${service}`)}
              </label>
            ))}
          </div>
        </section>

        <section className="bc-glass rounded-card p-6">
          <h2 className="mb-1 font-display text-lg font-semibold text-donor-text">
            {t('directory.openingHours')}
          </h2>
          <p className="mb-4 text-xs text-donor-muted">{t('directory.hoursHint')}</p>
          <div className="space-y-2">
            {hours.map((day) => (
              <div
                key={day.dayOfWeek}
                className="flex flex-wrap items-center gap-3 rounded-lg bc-solid px-3 py-2"
              >
                <span className="min-w-28 text-sm text-donor-text">
                  {weekdayName(day.dayOfWeek)}
                </span>
                <label className="flex items-center gap-2 text-sm text-donor-muted">
                  <input
                    type="checkbox"
                    checked={day.isClosed}
                    onChange={(event) => setDay(day.dayOfWeek, { isClosed: event.target.checked })}
                  />
                  {t('directory.closed')}
                </label>
                <label className="flex items-center gap-2 text-sm text-donor-muted">
                  {t('directory.opensAt')}
                  <input
                    type="time"
                    value={day.opensAt ?? ''}
                    disabled={day.isClosed}
                    onChange={(event) => setDay(day.dayOfWeek, { opensAt: event.target.value })}
                    className="rounded-lg bc-solid px-2 py-1 text-donor-text disabled:opacity-40"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-donor-muted">
                  {t('directory.closesAt')}
                  <input
                    type="time"
                    value={day.closesAt ?? ''}
                    disabled={day.isClosed}
                    onChange={(event) => setDay(day.dayOfWeek, { closesAt: event.target.value })}
                    className="rounded-lg bc-solid px-2 py-1 text-donor-text disabled:opacity-40"
                  />
                </label>
              </div>
            ))}
          </div>
        </section>
      </form>
    </AppShell>
  );
}
