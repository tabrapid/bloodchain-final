'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  Droplet,
  Flag,
  FlaskConical,
  HeartPulse,
  Home,
  ShieldCheck,
  Siren,
  Sparkles,
  Target,
  UserRound,
  Users,
} from 'lucide-react';
import { DashboardShell } from '@bloodchain/ui/components';
import { me, logout } from '../lib/api/auth';
import { getUnreadCount } from '../lib/api/notifications';
import { sections } from '../lib/sections';
import { Resource, useResource } from './common';
import { Overview, Donations, Health, Profile, Security, Organizations } from './Personal';
import { Appointments, Laboratory } from './Bookings';
import { Campaigns, Challenges, Community, Education, Achievements } from './Community';
import { Emergencies, Notifications, Insights } from './Services';
const icons = {
  home: Home,
  calendar: CalendarDays,
  flask: FlaskConical,
  droplet: Droplet,
  heart: HeartPulse,
  sparkles: Sparkles,
  siren: Siren,
  book: BookOpen,
  flag: Flag,
  target: Target,
  users: Users,
  award: Award,
  bell: Bell,
  user: UserRound,
  shield: ShieldCheck,
};
const panels: Record<string, React.ComponentType> = {
  home: Overview,
  organizations: Organizations,
  appointments: Appointments,
  laboratory: Laboratory,
  donations: Donations,
  health: Health,
  profile: Profile,
  security: Security,
  campaigns: Campaigns,
  challenges: Challenges,
  community: Community,
  education: Education,
  achievements: Achievements,
  emergency: Emergencies,
  notifications: Notifications,
  insights: Insights,
};
export function DonorApp({ section }: { section: string }) {
  const router = useRouter();
  const session = useResource(me);
  useEffect(() => {
    const expired = () => router.replace('/auth');
    window.addEventListener('donor:session-expired', expired);
    return () => window.removeEventListener('donor:session-expired', expired);
  }, [router]);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!session.data?.roles.includes('DONOR')) return;
    let live = true;
    const refresh = () => {
      void getUnreadCount()
        .then((r) => {
          if (live) setUnread(r.count);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [session.data]);
  const user = session.data;
  const allowed = user?.roles.includes('DONOR');
  const View = panels[section] ?? Overview;
  return (
    <DashboardShell
      title={sections.find((s) => s.id === section)?.label ?? 'Donor kabineti'}
      subtitle="DONOR SHAXSIY KABINETI"
      userName={user ? `${user.firstName} ${user.lastName}` : undefined}
      organizationName="BloodChain · Donor"
      organizationType="Yagona donorlik tizimi"
      activeItem={section}
      linkComponent={Link}
      sidebarItems={sections.map((s) => ({
        id: s.id,
        label: s.label,
        href: s.id === 'home' ? '/' : `/${s.id}`,
        icon: icons[s.icon],
      }))}
      topbarActions={
        <Link
          href="/notifications"
          className="donor-top-notifications"
          aria-label="Bildirishnomalar"
        >
          <Bell size={18} />
          {unread > 0 && <span className="donor-unread">{unread}</span>}
        </Link>
      }
      onLogout={async () => {
        try {
          await logout();
        } finally {
          router.replace('/auth');
          router.refresh();
        }
      }}
    >
      <Resource loading={session.loading} error={session.error} retry={session.reload}>
        {user && !allowed ? (
          <div className="donor-error" role="alert">
            <ShieldCheck />
            Bu kabinet donorlar uchun. Ushbu akkauntda DONOR roli mavjud emas.
          </div>
        ) : allowed ? (
          <View key={section} />
        ) : (
          <Activity className="animate-spin" />
        )}
      </Resource>
    </DashboardShell>
  );
}
