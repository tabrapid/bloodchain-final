import { notFound } from 'next/navigation';
import { DonorApp } from '../../components/DonorApp';
import { sections } from '../../lib/sections';
export function generateStaticParams() {
  return sections.filter((s) => s.id !== 'home').map((s) => ({ section: s.id }));
}
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.some((s) => s.id === section)) notFound();
  return <DonorApp section={section} />;
}
