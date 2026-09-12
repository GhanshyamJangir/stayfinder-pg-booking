import { redirect } from 'next/navigation';
import { readSession } from '../../lib/session';
import AdminControlCenter from '../ui/AdminControlCenter';

export default async function AdminPage(){
 const user=await readSession();
 if(!user) redirect('/');
 if(user.role!=='admin') redirect(user.role==='owner'?'/owner':'/customer');
 return <AdminControlCenter user={user}/>;
}
