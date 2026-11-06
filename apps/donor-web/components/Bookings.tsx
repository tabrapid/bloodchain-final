'use client';
import { useCallback, useState } from 'react';
import { DataTable } from '@bloodchain/ui/components';
import * as appointments from '../lib/api/appointments';
import * as lab from '../lib/api/laboratory';
import {
  Action,
  Badge,
  Empty,
  Field,
  Panel,
  Resource,
  date,
  useResource,
  FormMessage,
} from './common';
const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
const cancellable = (status: string) => ['PENDING', 'CONFIRMED'].includes(status);
export function Appointments() {
  const r = useResource(appointments.getMyAppointments);
  const [day, setDay] = useState(today);
  const [type, setType] = useState('BLOOD_DONATION');
  const [reschedule, setReschedule] = useState<appointments.Appointment>();
  const load = useCallback(
    () =>
      appointments.getAvailability({
        date: day,
        appointmentType: reschedule?.appointmentType ?? type,
        organizationId: reschedule?.organization.id,
      }),
    [day, type, reschedule],
  );
  const slots = useResource(load);
  const [message, setMessage] = useState('');
  return (
    <>
      <Panel
        title={
          reschedule ? `Qabulni ko‘chirish · ${reschedule.referenceNumber}` : 'Qabulga yozilish'
        }
        actions={
          reschedule && <button onClick={() => setReschedule(undefined)}>Bekor qilish</button>
        }
      >
        <p className="donor-muted">
          Bo‘sh vaqtni tanlang. Yakuniy donorlik ruxsati tibbiy ko‘rikda belgilanadi.
        </p>
        <div className="donor-form-grid">
          <Field label="Xizmat">
            <select
              disabled={!!reschedule}
              value={reschedule?.appointmentType ?? type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="BLOOD_DONATION">Qon topshirish</option>
              <option value="CONSULTATION">Maslahat</option>
            </select>
          </Field>
          <Field label="Sana">
            <input type="date" min={today()} value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
        </div>
        <FormMessage success={message} />
        <Resource {...slots} retry={slots.reload}>
          <div className="donor-slot-grid">
            {slots.data
              ?.filter((s) => s.availableSpots > 0 && s.status === 'AVAILABLE')
              .map((s) => (
                <div className="donor-slot" key={s.id}>
                  <strong>{s.organization.name}</strong>
                  <p>{date(s.startAt)}</p>
                  <span>{s.availableSpots} ta bo‘sh joy</span>
                  <Action
                    confirm={`${s.organization.name} · ${date(s.startAt)} vaqtini tasdiqlaysizmi?`}
                    onClick={async () => {
                      if (reschedule)
                        await appointments.rescheduleAppointment(reschedule.id, {
                          newSlotId: s.id,
                        });
                      else
                        await appointments.bookAppointment({ slotId: s.id, appointmentType: type });
                      setMessage('Qabul saqlandi.');
                      setReschedule(undefined);
                      await r.reload();
                      await slots.reload();
                    }}
                  >
                    Vaqtni tanlash
                  </Action>
                </div>
              ))}
          </div>
          {!slots.data?.some((s) => s.availableSpots > 0 && s.status === 'AVAILABLE') && (
            <Empty>Ushbu sana uchun bo‘sh vaqt yo‘q. Boshqa sanani tanlang.</Empty>
          )}
        </Resource>
      </Panel>
      <Panel title="Mening qabullarim">
        <Resource {...r} retry={r.reload}>
          {r.data?.length ? (
            r.data.map((a) => (
              <div className="donor-appointment" key={a.id}>
                <div>
                  <Badge>{a.status}</Badge>
                  <h3>{a.organization.name}</h3>
                  <p>{date(a.scheduledStart)}</p>
                  <small>
                    {a.referenceNumber} · {a.appointmentType}
                  </small>
                  {a.cancellationReason && <p>{a.cancellationReason}</p>}
                </div>
                {cancellable(a.status) && (
                  <div className="donor-buttons">
                    <button
                      onClick={() => {
                        setReschedule(a);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                    >
                      Vaqtni ko‘chirish
                    </button>
                    <Action
                      danger
                      confirm="Ushbu qabul bekor qilinsinmi?"
                      onClick={async () => {
                        await appointments.cancelAppointment(a.id, {
                          reason: 'Donor web kabineti orqali bekor qilindi',
                        });
                        await r.reload();
                        await slots.reload();
                      }}
                    >
                      Bekor qilish
                    </Action>
                  </div>
                )}
              </div>
            ))
          ) : (
            <Empty />
          )}
        </Resource>
      </Panel>
    </>
  );
}
const labLoad = async () => {
  const [types, laboratories, bookings, results] = await Promise.all([
    lab.getTestTypes(),
    lab.getLaboratories(),
    lab.getDonorAppointments(),
    lab.getDonorResults(),
  ]);
  return { types, laboratories, bookings, results };
};
export function Laboratory() {
  const r = useResource(labLoad);
  const [labId, setLabId] = useState('');
  const [testId, setTestId] = useState('');
  const [day, setDay] = useState(today);
  const [details, setDetails] = useState<lab.LaboratoryResult>();
  const [trend, setTrend] = useState<lab.ParameterTrend[]>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      labId && testId && day ? lab.getAvailableSlots(labId, testId, day) : Promise.resolve([]),
    [labId, testId, day],
  );
  const slots = useResource(load);
  return (
    <Resource {...r} retry={r.reload}>
      {r.data && (
        <>
          <Panel title="Laboratoriyaga yozilish">
            <div className="donor-form-grid">
              <Field label="Laboratoriya">
                <select
                  value={labId}
                  onChange={(e) => {
                    setLabId(e.target.value);
                    setTestId('');
                  }}
                >
                  <option value="">Laboratoriyani tanlang</option>
                  {r.data.laboratories.map((l) => (
                    <option value={l.id} key={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tahlil turi">
                <select
                  value={testId}
                  disabled={!labId}
                  onChange={(e) => setTestId(e.target.value)}
                >
                  <option value="">Tahlilni tanlang</option>
                  {(
                    r.data.laboratories.find((l) => l.id === labId)?.laboratoryProfile?.testTypes ??
                    r.data.types
                  ).map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sana">
                <input
                  type="date"
                  min={today()}
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>
            </div>
            <FormMessage success={message} />
            {labId && testId && (
              <Resource {...slots} retry={slots.reload}>
                <div className="donor-slot-grid">
                  {slots.data
                    ?.filter(
                      (s) =>
                        s.isAvailable !== false &&
                        s.status === 'AVAILABLE' &&
                        s.capacity > s.bookedCount,
                    )
                    .map((s) => (
                      <div className="donor-slot" key={s.id}>
                        <strong>{date(s.startAt)}</strong>
                        <Action
                          confirm="Tahlil uchun ushbu vaqtga yozilasizmi?"
                          onClick={async () => {
                            await lab.bookLaboratoryAppointment({
                              laboratoryId: labId,
                              testTypeId: testId,
                              slotId: s.id,
                            });
                            setMessage('Tahlil uchun qabul band qilindi.');
                            await r.reload();
                            await slots.reload();
                          }}
                        >
                          Bron qilish
                        </Action>
                      </div>
                    ))}
                </div>
                {!slots.data?.some(
                  (s) =>
                    s.isAvailable !== false &&
                    s.status === 'AVAILABLE' &&
                    s.capacity > s.bookedCount,
                ) && <Empty>Bo‘sh vaqt topilmadi.</Empty>}
              </Resource>
            )}
          </Panel>
          <Panel title="Laboratoriya qabullarim">
            {r.data.bookings.length ? (
              r.data.bookings.map((b) => (
                <div key={b.id} className="donor-list-row">
                  <div>
                    <strong>{b.testType?.name ?? b.referenceNumber}</strong>
                    <p>
                      {b.organization.name} · {date(b.scheduledStart)}
                    </p>
                    <Badge>{b.status}</Badge>
                  </div>
                  {cancellable(b.status) && (
                    <Action
                      danger
                      confirm="Tahlil qabuli bekor qilinsinmi?"
                      onClick={async () => {
                        await lab.cancelDonorAppointment(b.id);
                        await r.reload();
                        await slots.reload();
                      }}
                    >
                      Bekor qilish
                    </Action>
                  )}
                </div>
              ))
            ) : (
              <Empty />
            )}
          </Panel>
          <Panel
            title="Tahlil natijalarim"
            actions={<button onClick={() => window.print()}>Chop etish</button>}
          >
            <FormMessage error={error} />
            {r.data.results.length ? (
              <DataTable
                rows={r.data.results}
                keyExtractor={(x) => x.id}
                columns={[
                  { key: 'testType', header: 'Tahlil', render: (x) => x.testType.name },
                  { key: 'laboratory', header: 'Laboratoriya', render: (x) => x.laboratory.name },
                  {
                    key: 'publishedAt',
                    header: 'E’lon qilingan',
                    render: (x) => date(x.publishedAt),
                  },
                  { key: 'status', header: 'Holat', render: (x) => <Badge>{x.status}</Badge> },
                  {
                    key: 'open',
                    header: 'Natija',
                    render: (x) => (
                      <Action
                        onClick={async () => {
                          setError('');
                          setTrend(undefined);
                          try {
                            setDetails(await lab.getDonorResult(x.id));
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Xato');
                          }
                        }}
                      >
                        Ochish
                      </Action>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty />
            )}
          </Panel>
          {details && (
            <Panel
              title={details.testType.name}
              actions={<button onClick={() => setDetails(undefined)}>Yopish</button>}
            >
              <p>
                {details.laboratory.name} · {date(details.publishedAt)}
              </p>
              <DataTable
                rows={details.items}
                keyExtractor={(x) => x.id}
                columns={[
                  { key: 'parameter', header: 'Ko‘rsatkich', render: (x) => x.parameter.name },
                  {
                    key: 'value',
                    header: 'Qiymat',
                    render: (x) => x.value ?? String(x.numericValue ?? '—'),
                  },
                  { key: 'unit', header: 'Birlik' },
                  { key: 'referenceMin', header: 'Min.' },
                  { key: 'referenceMax', header: 'Maks.' },
                  { key: 'flag', header: 'Belgi', render: (x) => <Badge>{x.flag}</Badge> },
                  {
                    key: 'trend',
                    header: 'Dinamika',
                    render: (x) => (
                      <Action
                        onClick={async () => setTrend(await lab.getParameterTrend(x.parameter.id))}
                      >
                        Tarix
                      </Action>
                    ),
                  },
                ]}
              />
              {trend && (
                <DataTable
                  rows={trend}
                  keyExtractor={(x) => x.date + x.laboratory}
                  columns={[
                    { key: 'date', header: 'Sana', render: (x) => date(x.date) },
                    { key: 'value', header: 'Qiymat' },
                    { key: 'unit', header: 'Birlik' },
                    { key: 'laboratory', header: 'Laboratoriya' },
                  ]}
                />
              )}
              <p className="donor-muted">
                Natijalarni talqin qilish uchun shifokoringizga murojaat qiling.
              </p>
            </Panel>
          )}
        </>
      )}
    </Resource>
  );
}
