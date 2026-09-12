import { listCustomerBookings } from './bookings';
import { listCustomerPayments } from './payments';
import { findUserById } from './users';
const clean=v=>String(v??'').trim();
export async function getConfirmedStayContact(customerId,bookingId){
 const booking=(await listCustomerBookings(customerId)).find(b=>clean(b.id)===clean(bookingId)); if(!booking) throw new Error('Booking not found.');
 const payment=(await listCustomerPayments(customerId)).find(p=>clean(p.bookingId)===clean(booking.id)&&p.status==='Verified');
 if(!payment||booking.status!=='Confirmed') throw new Error('Owner contact payment verify hone ke baad unlock hoga.');
 const owner=booking.pg?.ownerId?await findUserById(booking.pg.ownerId):null; if(!owner) throw new Error('Owner contact unavailable.');
 const phone=clean(owner.phone),digits=phone.replace(/\D/g,''),wa=digits?`https://wa.me/${digits.length===10?'91'+digits:digits}`:'';
 const mapLink=booking.pg?.mapLink||`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${booking.pg?.address||''}, ${booking.pg?.city||''}`)}`;
 return {bookingId:booking.id,ownerName:owner.name||owner.username,phone,whatsapp:wa,mapLink,address:booking.pg?.address||'',pgName:booking.pg?.name||'',exactLocation:!!booking.pg?.hasExactLocation};
}
