import { useState } from 'react';
import { Search, Calendar, Clock, User, Phone, CheckCircle2, AlertCircle, Loader2, ArrowLeft, XCircle, Trash2, HardHat } from 'lucide-react';
import { db, isFirebaseConfigured, mockDb } from '../firebaseClient';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function MyBookings({ onBackToHome }) {
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState('');

  // Cancel confirmation state
  const [cancellingId, setCancellingId] = useState(null);   // ID being cancelled
  const [confirmId, setConfirmId] = useState(null);         // ID waiting for confirm dialog
  const [cancelError, setCancelError] = useState('');

  // Feature B: Search by client phone number
  const handlePhoneSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResults(null);
    setCancelError('');

    const formattedSearch = searchPhone.trim();
    if (!formattedSearch) {
      setSearchError('Please enter a phone number to search.');
      return;
    }

    setSearching(true);
    try {
      if (isFirebaseConfigured) {
        // Target specific construction LLP collection
        const appointmentsRef = collection(db, 'panchratna_site_visits');
        const q = query(appointmentsRef, where('client_phone', '==', formattedSearch));
        const querySnapshot = await getDocs(q);

        const results = [];
        querySnapshot.forEach((docSnap) => {
          results.push({ id: docSnap.id, ...docSnap.data() });
        });
        results.sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));
        setSearchResults(results);
      } else {
        const results = await mockDb.getAppointmentsByPhone(formattedSearch);
        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Search query failure:', err);
      setSearchError('Failed to retrieve records. Please verify your connection.');
    } finally {
      setSearching(false);
    }
  };

  // Cancel Visit — marks CANCELLED in UI + Firestore + Sheets + localStorage
  const handleCancel = async (bookingId) => {
    setCancellingId(bookingId);
    setCancelError('');
    const booking = searchResults?.find((b) => b.id === bookingId);
    try {
      if (isFirebaseConfigured) {
        await updateDoc(doc(db, 'panchratna_site_visits', bookingId), {
          status: 'CANCELLED',
          cancelled: true
        });
      }
      
      // Sync with External Sheets (fire-and-forget)
      if (booking) {
        fetch('/api/updateSheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'cancel_visit',
            data: {
              client_phone: booking.client_phone,
              visit_date: booking.appointment_date,
              time_slot: booking.time_slot,
            }
          })
        }).catch((err) => console.warn('Sheets cancel sync failed:', err));
      }

      // Update both localStorage caches for persistent state sync
      try {
        // 1. Global site visits cache
        const globalAppointments = JSON.parse(localStorage.getItem('panchratna_site_visits') || '[]');
        const updatedGlobal = globalAppointments.map((apt) => {
          if (apt.id === bookingId || (booking && apt.appointment_date === booking.appointment_date && apt.time_slot === booking.time_slot)) {
            return { ...apt, status: 'CANCELLED', cancelled: true };
          }
          return apt;
        });
        localStorage.setItem('panchratna_site_visits', JSON.stringify(updatedGlobal));

        // 2. User device-local visits cache
        const localCache = JSON.parse(localStorage.getItem('user_local_bookings') || '[]');
        const updatedLocal = localCache.map((apt) => {
          if (apt.id === bookingId || (booking && apt.appointment_date === booking.appointment_date && apt.time_slot === booking.time_slot)) {
            return { ...apt, status: 'CANCELLED', cancelled: true };
          }
          return apt;
        });
        localStorage.setItem('user_local_bookings', JSON.stringify(updatedLocal));
      } catch (cacheErr) {
        console.error('Failed to update cancellation state in localStorage:', cacheErr);
      }

      setSearchResults((prev) =>
        prev ? prev.map((b) => b.id === bookingId ? { ...b, cancelled: true, status: 'CANCELLED' } : b) : prev
      );
      setConfirmId(null);
    } catch (err) {
      console.error('Cancel failed:', err);
      setCancelError('Failed to cancel site visit. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const renderBookingCard = (booking) => {
    const isCancelled = booking.cancelled === true || booking.status === 'CANCELLED' || booking.status === 'Cancelled';
    const isCancelling = cancellingId === booking.id;
    const isAwaitingConfirm = confirmId === booking.id;
    const bookingId = booking.id;

    return (
      <div
        key={bookingId || `${booking.appointment_date}-${booking.time_slot}`}
        className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden transition-all duration-200 hover:shadow-md ${
          isCancelled ? 'border-slate-200 opacity-60 bg-slate-50/50' : 'border-[#EAE5DC]'
        }`}
      >
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          isCancelled ? 'bg-slate-300' : 'bg-[#115E59]'
        }`}></div>

        <div className="flex items-center justify-between border-b border-[#EAE5DC]/60 pb-3">
          <div className={`flex items-center gap-2 ${isCancelled ? 'text-slate-400' : 'text-[#115E59]'}`}>
            <HardHat className={`w-4 h-4 shrink-0 ${isCancelled ? 'text-slate-300' : 'text-[#115E59]'}`} />
            <span className={`font-bold text-xs uppercase tracking-wider ${isCancelled ? 'line-through text-slate-400/80' : ''}`}>Site Visit Pass</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
            isCancelled
              ? 'bg-slate-100 border-slate-200 text-slate-400 line-through'
              : 'bg-emerald-50 border-emerald-200 text-[#115E59]'
          }`}>
            {booking.status === 'Confirmed' ? 'Confirmed' : 'Scheduled'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-600">
              <User className={`w-4 h-4 shrink-0 ${isCancelled ? 'text-slate-300' : 'text-slate-400'}`} />
              <div>
                <span className={`block text-[9px] uppercase tracking-wider font-bold ${isCancelled ? 'line-through text-slate-400/70' : 'text-slate-400'}`}>Client Name</span>
                <span className={`font-bold ${isCancelled ? 'line-through text-slate-400/80' : 'text-slate-900'}`}>{booking.client_name || booking.patient_name}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-600">
              <Phone className={`w-4 h-4 shrink-0 ${isCancelled ? 'text-slate-300' : 'text-slate-400'}`} />
              <div>
                <span className={`block text-[9px] uppercase tracking-wider font-bold ${isCancelled ? 'line-through text-slate-400/70' : 'text-slate-400'}`}>Registered Phone</span>
                <span className={`font-semibold ${isCancelled ? 'line-through text-slate-400/80' : 'text-slate-800'}`}>{booking.client_phone || booking.patient_phone}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Calendar className={`w-4 h-4 shrink-0 ${isCancelled ? 'text-slate-300' : 'text-slate-400'}`} />
              <div>
                <span className={`block text-[9px] uppercase tracking-wider font-bold ${isCancelled ? 'line-through text-slate-400/70' : 'text-slate-400'}`}>Scheduled Visit Date</span>
                <span className={`font-bold ${isCancelled ? 'line-through text-slate-400/80' : 'text-slate-900'}`}>
                  {new Date(booking.appointment_date).toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-600">
              <Clock className={`w-4 h-4 shrink-0 ${isCancelled ? 'text-slate-300' : 'text-slate-400'}`} />
              <div>
                <span className={`block text-[9px] uppercase tracking-wider font-bold ${isCancelled ? 'line-through text-slate-400/70' : 'text-slate-400'}`}>Reserved Slot</span>
                <span className={`font-extrabold px-2 py-0.5 rounded border ${
                  isCancelled
                    ? 'line-through text-slate-400/80 bg-slate-100 border-slate-200'
                    : 'text-[#0F766E] bg-teal-50 border-teal-100'
                }`}>{booking.time_slot}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={`bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] leading-relaxed font-medium ${
          isCancelled ? 'text-slate-400 line-through' : 'text-slate-500'
        }`}>
          🏗️ <strong className={isCancelled ? 'line-through text-slate-400/80' : 'text-slate-600'}>Official Proof:</strong> Present this digital pass at the **Panchratna Galleria office, Sarjana Chowk, Ranchi**, or at the project site on your scheduled day.
        </div>

        {/* Cancel Section */}
        {bookingId && !isCancelled && (
          <div className="pt-1">
            {cancelError && confirmId === bookingId && (
              <p className="text-[10px] text-rose-600 font-semibold mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {cancelError}
              </p>
            )}

            {isAwaitingConfirm ? (
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Cancel this visit?
                </p>
                <p className="text-[10px] text-rose-500">This will free up the engineering consultant's time for others.</p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => handleCancel(bookingId)}
                    className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isCancelling ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Cancelling...</>
                    ) : (
                      <><Trash2 className="w-3 h-3" /> Yes, Cancel</>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => { setConfirmId(null); setCancelError(''); }}
                    className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    Keep It
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setConfirmId(bookingId); setCancelError(''); }}
                className="w-full py-2 px-3 border border-rose-200 hover:border-rose-400 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel Site Visit
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12 text-slate-800">

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-[#115E59] hover:text-[#0D4F4A] hover:underline font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Main Portal
        </button>
        <span className="text-2xs font-extrabold uppercase tracking-widest text-[#5A6561] bg-[#F9F6F0] border border-[#EAE5DC] px-3 py-1 rounded-full">
          Official Site Visit Verification
        </span>
      </div>

      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">My Scheduled Visits</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Verify your project site visits or manage your engineering consultations using your registered phone number.
        </p>
      </div>

      {/* Phone Lookup */}
      <div className="max-w-xl mx-auto bg-white border border-[#EAE5DC] rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#115E59]"></div>

        <div className="space-y-1">
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4 text-[#115E59]" />
            Phone Number Lookup
          </h3>
          <p className="text-2xs text-slate-400">Enter your registered phone number to find your Panchratna site visit passes.</p>
        </div>

        <form onSubmit={handlePhoneSearch} className="space-y-4">
          <div>
            <label htmlFor="lookup-phone" className="block text-3xs font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
              Registered Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="tel"
                id="lookup-phone"
                value={searchPhone}
                onChange={(e) => {
                  setSearchPhone(e.target.value);
                  if (searchError) setSearchError('');
                }}
                placeholder="e.g. 9263002626"
                className="block w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#115E59]/40 focus:border-[#115E59] transition-all shadow-sm"
              />
            </div>
          </div>

          {searchError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-2xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={searching}
            className="w-full btn-neon-emerald py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Fetching Records...</>
            ) : (
              <><Search className="w-4 h-4" />Find My Records</>
            )}
          </button>
        </form>

        {/* Search Results */}
        {searchResults !== null && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-2xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {searchResults.length === 0 ? 'No records found' : `${searchResults.length} record${searchResults.length > 1 ? 's' : ''} found`}
            </h4>

            {searchResults.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">No Records Found</p>
                <p className="text-3xs text-slate-400">Verify your number or schedule a new site visit from the portal.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {searchResults.map(renderBookingCard)}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
nic counter near Mahabir Chowk, Ranchi, on your appointment day. No email login or printed copy is required.
        </div>

        {/* Cancel Section — hidden if already cancelled */}
        {bookingId && !isCancelled && (
          <div className="pt-1">
            {cancelError && confirmId === bookingId && (
              <p className="text-[10px] text-rose-600 font-semibold mb-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {cancelError}
              </p>
            )}

            {isAwaitingConfirm ? (
              // Confirmation prompt
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" />
                  Cancel this appointment?
                </p>
                <p className="text-[10px] text-rose-500">This will free up the slot for others. This cannot be undone.</p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => handleCancel(bookingId)}
                    className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isCancelling ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Cancelling...</>
                    ) : (
                      <><Trash2 className="w-3 h-3" /> Yes, Cancel</>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => { setConfirmId(null); setCancelError(''); }}
                    className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                  >
                    Keep It
                  </button>
                </div>
              </div>
            ) : (
              // Cancel trigger button
              <button
                type="button"
                onClick={() => { setConfirmId(bookingId); setCancelError(''); }}
                className="w-full py-2 px-3 border border-rose-200 hover:border-rose-400 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel Appointment
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12 text-slate-800">

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-[#115E59] hover:text-[#0D4F4A] hover:underline font-bold text-xs uppercase tracking-wider cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clinic Portal
        </button>
        <span className="text-2xs font-extrabold uppercase tracking-widest text-[#5A6561] bg-[#F9F6F0] border border-[#EAE5DC] px-3 py-1 rounded-full">
          Secure Proof Verification
        </span>
      </div>

      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">My Active Appointments</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Look up your bookings by phone number to view proof or cancel your appointment.
        </p>
      </div>

      {/* Phone Lookup — full width, centred */}
      <div className="max-w-xl mx-auto bg-white border border-[#EAE5DC] rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#115E59]"></div>

        <div className="space-y-1">
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
            <Search className="w-4 h-4 text-[#115E59]" />
            Phone Number Lookup
          </h3>
          <p className="text-2xs text-slate-400">Enter your registered phone number to find and manage your appointments.</p>
        </div>

        <form onSubmit={handlePhoneSearch} className="space-y-4">
          <div>
            <label htmlFor="lookup-phone" className="block text-3xs font-extrabold text-slate-500 uppercase tracking-widest mb-1.5">
              Registered Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </span>
              <input
                type="tel"
                id="lookup-phone"
                value={searchPhone}
                onChange={(e) => {
                  setSearchPhone(e.target.value);
                  if (searchError) setSearchError('');
                }}
                placeholder="e.g. 9431360455"
                className="block w-full pl-10 pr-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#115E59]/40 focus:border-[#115E59] transition-all shadow-sm"
              />
            </div>
          </div>

          {searchError && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-2xs font-semibold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={searching}
            className="w-full btn-neon-emerald py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {searching ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Searching Records...</>
            ) : (
              <><Search className="w-4 h-4" />Find My Appointments</>
            )}
          </button>
        </form>

        {/* Search Results */}
        {searchResults !== null && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <h4 className="text-2xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {searchResults.length === 0 ? 'No appointments found' : `${searchResults.length} appointment${searchResults.length > 1 ? 's' : ''} found`}
            </h4>

            {searchResults.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                <p className="text-xs font-bold text-slate-700">No Appointments Found</p>
                <p className="text-3xs text-slate-400">Verify the phone number or try booking a new slot.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                {searchResults.map(renderBookingCard)}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
