import { redirect } from 'next/navigation';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  redirect('/auth?mode=verify-email&token=' + encodeURIComponent(token ?? ''));
}
