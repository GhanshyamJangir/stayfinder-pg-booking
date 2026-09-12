import { redirect } from 'next/navigation';
import { readSession } from '../../lib/session';
import DashboardShell from '../ui/DashboardShell';

export default async function OwnerPage() {
  const user = await readSession();
  if (!user) redirect('/');
  if (user.role !== 'owner') redirect(user.role === 'customer' ? '/customer' : '/');

  return <DashboardShell user={user} role="owner" />;
}
