import { redirect } from 'next/navigation';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect('/auth?mode=reset&token=' + encodeURIComponent(token ?? ''));
}
