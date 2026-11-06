'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { notificationHref } from '../lib/notification-href';
import * as emergency from '../lib/api/emergency';
import * as notifications from '../lib/api/notifications';
import * as ai from '../lib/api/ai-health';
import * as lab from '../lib/api/laboratory';
import * as trends from '../lib/api/health-trends';
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
export function Emergencies() {
  const r = useResource(emergency.getDonorEmergencies);
  const [tracking, setTracking] = useState<emergency.DonorTrackingResponse>();
  const [sharing, setSharing] = useState(false);
  const [locationError, setLocationError] = useState('');
  useEffect(() => {
    if (!sharing || !tracking) return;
    let last = 0;
    let live = true;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() - last < 15000) return;
        last = Date.now();
        void emergency
          .updateLocation(tracking.id, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
          .catch((e) => {
            if (live) setLocationError(e instanceof Error ? e.message : 'Joylashuv yuborilmadi');
          });
      },
      (err) => {
        if (live) {
          setLocationError(err.message);
          setSharing(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => {
      live = false;
      navigator.geolocation.clearWatch(id);
    };
  }, [sharing, tracking]);
  const requests = r.data
    ? [...new Map([...r.data.active, ...r.data.myResponses].map((x) => [x.id, x])).values()]
    : [];
  return (
    <>
      <div className="donor-emergency-note">
        <strong>Shoshilinch donor chaqiriqlari</strong>
        <p>
          Bu bo‘lim shifoxonaning donor so‘rovlariga javob berish uchun. Tibbiy favqulodda vaziyatda
          103 raqamiga qo‘ng‘iroq qiling.
        </p>
      </div>
      <Panel title="Chaqiriqlar va javoblarim">
        <Resource {...r} retry={r.reload}>
          {requests.length ? (
            requests.map((e) => (
              <article className="donor-emergency-card" key={e.id}>
                <Badge>
                  {e.urgencyLevel} · {e.status}
                </Badge>
                <h3>{e.hospital.name}</h3>
                <p>{e.donationLocation ?? e.hospital.address}</p>
                <p>
                  {e.bloodType} {e.rhFactor} · {e.unitsRequired} birlik · {e.emergencyReference}
                </p>
                <p>{e.description}</p>
                <p>Muddat: {date(e.requiredBefore)}</p>
                {e.responseStatus && <Badge>{e.responseStatus}</Badge>}
                <div className="donor-buttons">
                  {e.matchId && !e.responseId && (
                    <>
                      <Action onClick={() => emergency.viewEmergencyMatch(e.matchId!)}>
                        Ko‘rdim
                      </Action>
                      {e.canAccept && (
                        <Action
                          confirm="Shifoxonaga donor sifatida yordam berishni tasdiqlaysizmi?"
                          onClick={async () => {
                            await emergency.acceptEmergency(e.matchId!);
                            await r.reload();
                          }}
                        >
                          Qabul qilish
                        </Action>
                      )}
                      <Action
                        onClick={async () => {
                          await emergency.declineEmergency(e.matchId!);
                          await r.reload();
                        }}
                      >
                        Rad etish
                      </Action>
                    </>
                  )}
                  {e.responseId && (
                    <Action
                      onClick={async () => {
                        setSharing(false);
                        setTracking(await emergency.getDonorTracking(e.responseId!));
                      }}
                    >
                      Yo‘l va javobni boshqarish
                    </Action>
                  )}
                </div>
              </article>
            ))
          ) : (
            <Empty>Sizga mos faol chaqiriqlar hozircha mavjud emas.</Empty>
          )}
        </Resource>
      </Panel>
      {tracking && (
        <Panel
          title="Shifoxonaga yo‘l"
          actions={
            <button
              onClick={() => {
                setSharing(false);
                setTracking(undefined);
              }}
            >
              Yopish
            </button>
          }
        >
          <h3>{tracking.emergencyRequest.hospital.name}</h3>
          <p>
            {tracking.emergencyRequest.donationLocation ??
              tracking.emergencyRequest.hospital.address}
          </p>
          <Badge>{tracking.status}</Badge>
          <FormMessage error={locationError} />
          <div className="donor-buttons">
            {tracking.status === 'ACCEPTED' && (
              <Action
                onClick={async () => {
                  await emergency.startJourney(tracking.id);
                  setTracking(await emergency.getDonorTracking(tracking.id));
                  await r.reload();
                }}
              >
                Yo‘lga chiqdim
              </Action>
            )}
            {tracking.status === 'EN_ROUTE' && (
              <>
                <Action
                  onClick={async () => {
                    setSharing(false);
                    await emergency.arriveAtHospital(tracking.id);
                    setTracking(await emergency.getDonorTracking(tracking.id));
                    await r.reload();
                  }}
                >
                  Yetib keldim
                </Action>
                <button
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setLocationError('Brauzer joylashuv xizmatini qo‘llamaydi.');
                      return;
                    }
                    setSharing(!sharing);
                  }}
                >
                  {sharing ? 'Joylashuv ulashishni to‘xtatish' : 'Roziman: joylashuvimni ulashish'}
                </button>
              </>
            )}
            {['ACCEPTED', 'EN_ROUTE'].includes(tracking.status) && (
              <Action
                danger
                confirm="Favqulodda chaqiriqqa javobni bekor qilasizmi?"
                onClick={async () => {
                  setSharing(false);
                  await emergency.cancelResponse(
                    tracking.id,
                    'Donor kabineti orqali bekor qilindi',
                  );
                  setTracking(undefined);
                  await r.reload();
                }}
              >
                Javobni bekor qilish
              </Action>
            )}
          </div>
          <p className="donor-muted">
            Joylashuv faqat roziligingiz bilan, ushbu sahifa ochiq bo‘lganda yuboriladi. Sahifadan
            chiqsangiz ulashish to‘xtaydi.
          </p>
          {sharing && <p role="status">Joylashuv ulashilmoqda.</p>}
        </Panel>
      )}
    </>
  );
}
const preferenceLabels = {
  emergencyRequests: 'Shoshilinch chaqiriqlar',
  appointments: 'Qabullar',
  donationReminders: 'Donatsiya eslatmalari',
  healthResults: 'Tahlil natijalari',
  gamification: 'Yutuqlar',
  system: 'Tizim xabarlari',
  security: 'Xavfsizlik xabarlari',
  quietHoursEnabled: 'Tinch vaqtni yoqish',
  emergencyOverride: 'Shoshilinch xabarlarni tinch vaqtda ham olish',
} as const;
export function Notifications() {
  const [cursor, setCursor] = useState<string>();
  const [filter, setFilter] = useState('');
  const load = useCallback(
    () =>
      notifications.getNotifications({
        cursor,
        limit: 20,
        isRead: filter === 'unread' ? false : undefined,
        status: filter === 'archived' ? 'ARCHIVED' : undefined,
      }),
    [cursor, filter],
  );
  const r = useResource(load);
  const prefs = useResource(notifications.getNotificationPreferences);
  return (
    <>
      <Panel
        title="Bildirishnomalar"
        actions={
          <div className="donor-buttons">
            <select
              aria-label="Bildirishnoma filtri"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCursor(undefined);
              }}
            >
              <option value="">Barchasi</option>
              <option value="unread">O‘qilmaganlar</option>
              <option value="archived">Arxivlanganlar</option>
            </select>
            <Action
              onClick={async () => {
                await notifications.markAllNotificationsAsRead();
                await r.reload();
              }}
            >
              Barchasini o‘qidim
            </Action>
          </div>
        }
      >
        <Resource {...r} retry={r.reload}>
          {r.data?.items.length ? (
            r.data.items.map((n) => (
              <article className="donor-notification" key={n.id}>
                <div>
                  <Badge>
                    {n.readAt ? 'O‘qilgan' : 'Yangi'} · {n.priority}
                  </Badge>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <small>{date(n.createdAt)}</small>
                  <p>
                    <Link href={notificationHref(n.type)}>Tegishli bo‘limni ochish →</Link>
                  </p>
                </div>
                <div className="donor-buttons">
                  <Action
                    onClick={async () => {
                      if (n.readAt) await notifications.markNotificationAsUnread(n.id);
                      else await notifications.markNotificationAsRead(n.id);
                      await r.reload();
                    }}
                  >
                    {n.readAt ? 'O‘qilmagan qilish' : 'O‘qidim'}
                  </Action>
                  <Action
                    onClick={async () => {
                      if (n.status === 'ARCHIVED') await notifications.unarchiveNotification(n.id);
                      else await notifications.archiveNotification(n.id);
                      await r.reload();
                    }}
                  >
                    {n.status === 'ARCHIVED' ? 'Arxivdan olish' : 'Arxivlash'}
                  </Action>
                  <Action
                    danger
                    confirm="Bildirishnoma o‘chirilsinmi?"
                    onClick={async () => {
                      await notifications.deleteNotification(n.id);
                      await r.reload();
                    }}
                  >
                    O‘chirish
                  </Action>
                </div>
              </article>
            ))
          ) : (
            <Empty />
          )}
          <div className="donor-pagination">
            <button disabled={!cursor} onClick={() => setCursor(undefined)}>
              Boshiga qaytish
            </button>
            <button
              disabled={!r.data?.nextCursor}
              onClick={() => setCursor(r.data?.nextCursor ?? undefined)}
            >
              Keyingi xabarlar →
            </button>
          </div>
        </Resource>
      </Panel>
      <Panel title="Bildirishnoma sozlamalari">
        <Resource {...prefs} retry={prefs.reload}>
          {prefs.data && (
            <PreferenceForm key={prefs.data.updatedAt} initial={prefs.data} reload={prefs.reload} />
          )}
        </Resource>
      </Panel>
    </>
  );
}
function PreferenceForm({
  initial,
  reload,
}: {
  initial: notifications.NotificationPreferences;
  reload: () => Promise<void>;
}) {
  const [value, setValue] = useState<notifications.UpdateNotificationPreferencesInput>(
    Object.fromEntries(
      Object.keys(preferenceLabels).map((k) => [
        k,
        initial[k as keyof notifications.NotificationPreferences],
      ]),
    ),
  );
  const [start, setStart] = useState(initial.quietHoursStart ?? '22:00');
  const [end, setEnd] = useState(initial.quietHoursEnd ?? '07:00');
  return (
    <>
      <div className="donor-preferences">
        {(Object.keys(preferenceLabels) as (keyof typeof preferenceLabels)[]).map((k) => (
          <label className="donor-check" key={k}>
            <input
              type="checkbox"
              checked={!!value[k]}
              onChange={(e) => setValue({ ...value, [k]: e.target.checked })}
            />
            {preferenceLabels[k]}
          </label>
        ))}
      </div>
      <div className="donor-form-grid">
        <Field label="Tinch vaqt boshlanishi">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Tugashi (Asia/Tashkent)">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      <Action
        onClick={async () => {
          await notifications.updateNotificationPreferences({
            ...value,
            quietHoursStart: start,
            quietHoursEnd: end,
            quietHoursTimezone: 'Asia/Tashkent',
          });
          await reload();
        }}
      >
        Sozlamalarni saqlash
      </Action>
    </>
  );
}
const aiLoad = async () => {
  const availability = await ai.getAiAvailability();
  const [history, conversations] = await Promise.all([
    ai.getInsightHistory({ limit: 20 }),
    ai.getConversations({ limit: 20 }),
  ]);
  if (!availability.enabled)
    return {
      availability,
      history,
      conversations,
      results: [] as lab.LaboratoryResult[],
      parameters: [] as trends.AvailableParameter[],
    };
  return {
    availability,
    history,
    conversations,
    results: await lab.getDonorResults(),
    parameters: await trends.getAvailableParameters(),
  };
};
export function Insights() {
  const r = useResource(aiLoad);
  const [insight, setInsight] = useState<ai.AiInsight>();
  const [question, setQuestion] = useState('');
  const [resultId, setResultId] = useState('');
  const [parameter, setParameter] = useState('');
  const [conversation, setConversation] = useState<string>();
  const [messages, setMessages] = useState<{ id: string; role: string; content: string }[]>([]);
  return (
    <Resource {...r} retry={r.reload}>
      {r.data && (
        <>
          <div className="donor-ai-note">
            AI yordamchi umumiy tushuntirish beradi, tashxis qo‘ymaydi va shifokor o‘rnini bosmaydi.
          </div>
          {!r.data.availability.enabled ? (
            <Panel title="AI yordamchi">
              <Empty>Ushbu tizimda AI xizmati hozir o‘chirilgan.</Empty>
            </Panel>
          ) : (
            <>
              <Panel title="Natijalarni tushuntirish">
                <div className="donor-form-grid">
                  <Field label="Tahlil natijasi">
                    <select value={resultId} onChange={(e) => setResultId(e.target.value)}>
                      <option value="">Natijani tanlang</option>
                      {r.data.results.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.testType.name} · {date(x.publishedAt)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Sog‘liq ko‘rsatkichi">
                    <select value={parameter} onChange={(e) => setParameter(e.target.value)}>
                      <option value="">Ko‘rsatkichni tanlang</option>
                      {r.data.parameters.map((x) => (
                        <option key={x.code} value={x.code}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="donor-buttons">
                  {resultId && (
                    <Action
                      onClick={async () => {
                        setInsight(await ai.explainResult({ resultId }));
                        await r.reload();
                      }}
                    >
                      Natijani tushuntirish
                    </Action>
                  )}
                  {parameter && (
                    <Action
                      onClick={async () => {
                        setInsight(await ai.analyzeTrend({ parameterCode: parameter }));
                        await r.reload();
                      }}
                    >
                      Dinamikani tushuntirish
                    </Action>
                  )}
                </div>
              </Panel>
              <Panel title="AI bilan suhbat">
                <div className="donor-messages">
                  {messages.map((m) => (
                    <div key={m.id} className={`donor-message ${m.role === 'user' ? 'mine' : ''}`}>
                      <strong>{m.role === 'user' ? 'Siz' : 'AI yordamchi'}</strong>
                      <p className="donor-content-text">{m.content}</p>
                    </div>
                  ))}
                </div>
                <Field label="Savolingiz">
                  <textarea
                    maxLength={2000}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Tahlil natijalarimni tushuntirib bering…"
                  />
                </Field>
                <div className="donor-buttons">
                  {question.trim() && (
                    <Action
                      onClick={async () => {
                        const text = question;
                        const answer = await ai.sendChatMessage({
                          conversationId: conversation,
                          message: text,
                        });
                        setConversation(answer.conversation.id);
                        setMessages([
                          ...messages,
                          { id: `q-${Date.now()}`, role: 'user', content: text },
                          answer.message,
                        ]);
                        setQuestion('');
                        if (answer.message.insight) setInsight(answer.message.insight);
                        await r.reload();
                      }}
                    >
                      Yuborish
                    </Action>
                  )}
                  <button
                    onClick={() => {
                      setConversation(undefined);
                      setMessages([]);
                    }}
                  >
                    Yangi suhbat
                  </button>
                </div>
              </Panel>
            </>
          )}
          {insight && (
            <Panel
              title={insight.title}
              actions={<button onClick={() => setInsight(undefined)}>Yopish</button>}
            >
              <Badge>{insight.safetyLevel}</Badge>
              <p className="donor-content-text">{insight.summary}</p>
              <ul>
                {insight.observations.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              {insight.caveats.map((x, i) => (
                <p className="donor-ai-note" key={i}>
                  {x}
                </p>
              ))}
              {insight.questionsForProfessional?.map((x, i) => (
                <p key={i}>{x}</p>
              ))}
              <div className="donor-buttons">
                <Action
                  onClick={() =>
                    ai.submitFeedback({ insightId: insight.id, type: ai.FeedbackType.HELPFUL })
                  }
                >
                  Foydali
                </Action>
                <Action
                  onClick={() =>
                    ai.submitFeedback({ insightId: insight.id, type: ai.FeedbackType.NOT_HELPFUL })
                  }
                >
                  Foydali emas
                </Action>
              </div>
            </Panel>
          )}
          <Panel title="Tushuntirishlar tarixi">
            {r.data.history.insights.map((x) => (
              <div className="donor-list-row" key={x.id}>
                <div>
                  <strong>{x.title}</strong>
                  <p>{date(x.generatedAt)}</p>
                </div>
                <div className="donor-buttons">
                  <button onClick={() => setInsight(x)}>Ochish</button>
                  <Action
                    danger
                    confirm="AI tushuntirishi o‘chirilsinmi?"
                    onClick={async () => {
                      await ai.deleteInsight(x.id);
                      if (insight?.id === x.id) setInsight(undefined);
                      await r.reload();
                    }}
                  >
                    O‘chirish
                  </Action>
                </div>
              </div>
            ))}
            {!r.data.history.insights.length && <Empty />}
          </Panel>
          <Panel title="Suhbatlar tarixi">
            {r.data.conversations.map((c) => (
              <div className="donor-list-row" key={c.id}>
                <div>
                  <strong>{c.title ?? 'Suhbat'}</strong>
                  <p>{date(c.lastMessageAt ?? c.createdAt)}</p>
                </div>
                <div className="donor-buttons">
                  <Action
                    onClick={async () => {
                      const d = await ai.getConversationDetail(c.id);
                      setConversation(c.id);
                      setMessages(d.messages);
                    }}
                  >
                    Davom ettirish
                  </Action>
                  <Action
                    danger
                    confirm="Ushbu suhbat o‘chirilsinmi?"
                    onClick={async () => {
                      await ai.deleteConversation(c.id);
                      if (conversation === c.id) {
                        setConversation(undefined);
                        setMessages([]);
                      }
                      await r.reload();
                    }}
                  >
                    O‘chirish
                  </Action>
                </div>
              </div>
            ))}
            {!r.data.conversations.length && <Empty />}
          </Panel>
        </>
      )}
    </Resource>
  );
}
