import { redirect } from 'next/navigation';
import { readSession } from '../../lib/session';
import DashboardShell from '../ui/DashboardShell';

export default async function CustomerPage() {
  const user = await readSession();
  if (!user) redirect('/');
  if (user.role !== 'customer') redirect(user.role === 'owner' ? '/owner' : '/');

  return <DashboardShell user={user} role="customer" />;
}
