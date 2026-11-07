'use client';
import { useCallback, useState } from 'react';
import { DataTable } from '@bloodchain/ui/components';
import * as campaigns from '../lib/api/campaigns';
import * as challenges from '../lib/api/challenges';
import * as community from '../lib/api/community';
import * as education from '../lib/api/education';
import * as games from '../lib/api/gamification';
import { Action, Badge, Empty, Panel, Resource, date, useResource, Field } from './common';
export function Campaigns() {
  const [page, setPage] = useState(1);
  const load = useCallback(
    async () => ({
      all: await campaigns.getCampaigns({ page, limit: 12 }),
      mine: await campaigns.getMyCampaigns({ limit: 100 }),
    }),
    [page],
  );
  const r = useResource(load);
  return (
    <Panel title="Donorlik aksiyalari">
      <Resource {...r} retry={r.reload}>
        {r.data && (
          <>
            <div className="donor-card-grid">
              {r.data.all.items.map((c) => {
                const joined = r.data!.mine.items.some(
                  (m) =>
                    m.id === c.id && !['LEFT', 'CANCELLED'].includes(m.participantStatus ?? ''),
                );
                return (
                  <article key={c.id} className="donor-content-card">
                    <Badge>{c.status}</Badge>
                    <h3>{c.title}</h3>
                    <p>{c.description}</p>
                    <p>{c.location ?? c.organization?.name}</p>
                    <p>
                      {date(c.startDate)} — {date(c.endDate)}
                    </p>
                    <p>
                      {c.participantCount ?? 0} ishtirokchi · {c.bloodGroupsNeeded.join(', ')}
                    </p>
                    {joined ? (
                      <Action
                        confirm="Aksiyadan chiqasizmi?"
                        onClick={async () => {
                          await campaigns.leaveCampaign(c.id);
                          await r.reload();
                        }}
                      >
                        Ishtirokni bekor qilish
                      </Action>
                    ) : (
                      ['ACTIVE', 'PUBLISHED'].includes(c.status) && (
                        <Action
                          onClick={async () => {
                            await campaigns.joinCampaign(c.id);
                            await r.reload();
                          }}
                        >
                          Ishtirok etish
                        </Action>
                      )
                    )}
                  </article>
                );
              })}
            </div>
            {!r.data.all.items.length && <Empty />}
            <Pagination page={page} total={r.data.all.total} setPage={setPage} />
          </>
        )}
      </Resource>
    </Panel>
  );
}
function Pagination({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (p: number) => void;
}) {
  return (
    <div className="donor-pagination">
      <button disabled={page === 1} onClick={() => setPage(page - 1)}>
        ← Oldingi
      </button>
      <span>{page}</span>
      <button disabled={page * 12 >= total} onClick={() => setPage(page + 1)}>
        Keyingi →
      </button>
    </div>
  );
}
const challengesLoad = async () => ({
  all: await challenges.getActiveChallenges(),
  mine: await challenges.getMyChallenges({ limit: 100 }),
});
export function Challenges() {
  const r = useResource(challengesLoad);
  return (
    <Panel title="Donorlik chaqiriqlari">
      <Resource {...r} retry={r.reload}>
        {r.data?.all.length ? (
          <div className="donor-card-grid">
            {r.data.all.map((c) => {
              const mine = r.data!.mine.items.find((m) => m.id === c.id);
              return (
                <article className="donor-content-card" key={c.id}>
                  <Badge>{c.xpReward} XP</Badge>
                  <h3>{c.title}</h3>
                  <p>{c.description}</p>
                  <p>{date(c.endDate)} gacha</p>
                  <progress value={mine?.userProgress ?? 0} max={c.goal || 1} />
                  <p>
                    {mine?.userProgress ?? 0} / {c.goal}
                  </p>
                  <Action
                    onClick={async () => {
                      if (mine) await challenges.recalculateChallengeProgress(c.id);
                      else await challenges.joinChallenge(c.id);
                      await r.reload();
                    }}
                  >
                    {mine ? 'Natijani yangilash' : 'Qo‘shilish'}
                  </Action>
                </article>
              );
            })}
          </div>
        ) : (
          <Empty />
        )}
      </Resource>
    </Panel>
  );
}
export function Community() {
  const [page, setPage] = useState(1);
  const load = useCallback(() => community.getFeed({ page, limit: 12 }), [page]);
  const r = useResource(load);
  return (
    <Panel title="Hamjamiyat yangiliklari">
      <Resource {...r} retry={r.reload}>
        {r.data && (
          <>
            {r.data.items.map((p) => (
              <article className="donor-post" key={p.id}>
                <Badge>{p.type}</Badge>
                <h3>{p.title}</h3>
                <p className="donor-content-text">{p.body}</p>
                <p className="donor-muted">
                  {p.author?.displayName ?? p.organization?.name ?? 'BloodChain'} ·{' '}
                  {date(p.publishedAt)}
                </p>
                <Action
                  confirm="Ushbu materialni moderatorga tekshirish uchun yuborasizmi?"
                  onClick={() =>
                    community.reportContent(
                      p.id,
                      'OTHER',
                      'Donor web kabinetidan tekshirish so‘raldi',
                    )
                  }
                >
                  Shikoyat qilish
                </Action>
              </article>
            ))}
            {!r.data.items.length && <Empty />}
            <Pagination page={page} total={r.data.total} setPage={setPage} />
          </>
        )}
      </Resource>
    </Panel>
  );
}
export function Education() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [selected, setSelected] = useState<education.EducationalContent>();
  const [progress, setProgress] = useState<education.EducationProgress>();
  const load = useCallback(
    async () => ({
      catalog: await education.getEducationalContent({ page, limit: 12, type: type || undefined }),
      stats: await education.getMyEducationStats(),
      progress: await education.getMyEducationProgress({ limit: 100 }),
    }),
    [page, type],
  );
  const r = useResource(load);
  return (
    <>
      <Panel
        title="Bilim markazi"
        actions={
          <select
            aria-label="Material turi"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Barcha materiallar</option>
            <option value="ARTICLE">Maqolalar</option>
            <option value="VIDEO">Videolar</option>
            <option value="QUIZ">Testlar</option>
          </select>
        }
      >
        <Resource {...r} retry={r.reload}>
          {r.data && (
            <>
              <p>
                {r.data.stats.totalCompleted} yakunlangan · {r.data.stats.totalXpEarned} XP
              </p>
              <div className="donor-card-grid">
                {r.data.catalog.items.map((c) => (
                  <article className="donor-content-card" key={c.id}>
                    <Badge>
                      {c.type} · {c.xpReward} XP
                    </Badge>
                    <h3>{c.title}</h3>
                    <p>{c.description}</p>
                    <p>{c.estimatedMinutes ?? '—'} daqiqa</p>
                    <Action
                      onClick={async () => {
                        setSelected(await education.getEducationalContentById(c.id));
                        setProgress(r.data!.progress.items.find((p) => p.contentId === c.id));
                      }}
                    >
                      Ochish
                    </Action>
                  </article>
                ))}
              </div>
              {!r.data.catalog.items.length && <Empty />}
              <Pagination page={page} total={r.data.catalog.total} setPage={setPage} />
            </>
          )}
        </Resource>
      </Panel>
      {selected && (
        <Panel
          title={selected.title}
          actions={<button onClick={() => setSelected(undefined)}>Yopish</button>}
        >
          <div className="donor-content-text">{selected.body}</div>
          <Badge>{progress?.status ?? 'Boshlanmagan'}</Badge>
          <div className="donor-buttons">
            {!progress && (
              <Action onClick={async () => setProgress(await education.startContent(selected.id))}>
                Boshlash
              </Action>
            )}
            {progress?.status === 'STARTED' && (
              <Action
                onClick={async () => {
                  setProgress(await education.completeContent(selected.id));
                  await r.reload();
                }}
              >
                O‘qib tugatdim
              </Action>
            )}
          </div>
        </Panel>
      )}
    </>
  );
}
const gamesLoad = async () => ({
  profile: await games.getGamificationProfile(),
  level: await games.getLevelProgress(),
  achievements: await games.getAchievements(),
  badges: await games.getBadges(),
  xp: await games.getXpHistory(),
});
export function Achievements() {
  const r = useResource(gamesLoad);
  const [range, setRange] = useState<'ALL_TIME' | 'THIS_YEAR' | 'THIS_MONTH'>('ALL_TIME');
  const [page, setPage] = useState(1);
  const load = useCallback(() => games.getLeaderboard(range, page, 12), [range, page]);
  const board = useResource(load);
  return (
    <>
      <Resource {...r} retry={r.reload}>
        {r.data && (
          <>
            <Panel title="Yutuqlar va rivojlanish">
              <div className="donor-level">
                <strong>{r.data.level.currentLevelName}</strong>
                <span>{r.data.profile.totalXp} XP</span>
              </div>
              <progress max={100} value={r.data.level.progress} />
              <p>
                Keyingi daraja: {r.data.level.nextLevelName} · {r.data.level.xpToNextLevel} XP qoldi
              </p>
              <Action
                onClick={async () => {
                  await games.updateLeaderboardVisibility(!r.data!.profile.leaderboardVisibility);
                  await r.reload();
                }}
              >
                {r.data.profile.leaderboardVisibility
                  ? 'Reytingda ismimni yashirish'
                  : 'Reytingda ko‘rinish'}
              </Action>
              <div className="donor-card-grid">
                {[
                  ...r.data.achievements.unlocked,
                  ...r.data.achievements.inProgress,
                  ...r.data.achievements.locked,
                ].map((a) => (
                  <article className="donor-content-card" key={a.id}>
                    <Badge>
                      {a.status} · {a.rarity}
                    </Badge>
                    <h3>{a.name}</h3>
                    <p>{a.description}</p>
                    <progress max={a.target || 1} value={a.progress} />
                    <p>
                      {a.progress} / {a.target} · {a.xpReward} XP
                    </p>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="Nishonlar">
              <div className="donor-card-grid">
                {r.data.badges.map((b) => (
                  <article className="donor-content-card" key={b.id}>
                    <Badge>{b.rarity}</Badge>
                    <h3>{b.name}</h3>
                    <p>{b.description}</p>
                    <p>{date(b.earnedAt)}</p>
                  </article>
                ))}
              </div>
              {!r.data.badges.length && <Empty />}
            </Panel>
            <Panel title="XP tarixi">
              <DataTable
                rows={r.data.xp.transactions}
                keyExtractor={(x) => x.id}
                columns={[
                  { key: 'createdAt', header: 'Sana', render: (x) => date(x.createdAt) },
                  { key: 'description', header: 'Faoliyat' },
                  { key: 'amount', header: 'XP' },
                ]}
              />
            </Panel>
          </>
        )}
      </Resource>
      <Panel
        title="Donorlar reytingi"
        actions={
          <Field label="Davr">
            <select
              value={range}
              onChange={(e) => {
                setRange(e.target.value as typeof range);
                setPage(1);
              }}
            >
              <option value="ALL_TIME">Barcha vaqt</option>
              <option value="THIS_YEAR">Shu yil</option>
              <option value="THIS_MONTH">Shu oy</option>
            </select>
          </Field>
        }
      >
        <Resource {...board} retry={board.reload}>
          {board.data && (
            <>
              <DataTable
                rows={board.data.entries}
                keyExtractor={(x) => x.userId}
                columns={[
                  { key: 'rank', header: 'O‘rin' },
                  { key: 'displayName', header: 'Donor' },
                  { key: 'level', header: 'Daraja' },
                  { key: 'xp', header: 'XP' },
                  { key: 'donationCount', header: 'Donatsiyalar' },
                ]}
              />
              <Pagination page={page} total={board.data.total} setPage={setPage} />
            </>
          )}
        </Resource>
      </Panel>
    </>
  );
}
