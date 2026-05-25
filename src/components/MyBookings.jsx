import { useState } from 'react';
import { Search, Calendar, Clock, User, Phone, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { db, isFirebaseConfigured, mockDb } from '../firebaseClient';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function MyBookings({ onBackToHome }) {
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [localBookings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user_local_bookings') || '[]');
    } catch (e) {
      console.error('Failed to load local device bookings:', e);
      return [];
    }
  });
  const [searchResults, setSearchResults] = useState(null);
  const [searchError, setSearchError] = useState('');

  // Feature B: Search database by phone number
  const handlePhoneSearch = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResults(null);

    const formattedSearch = searchPhone.trim();
    if (!formattedSearch) {
      setSearchError('Please enter a phone number to search.');
      return;
    }

    setSearching(true);

    try {
      if (isFirebaseConfigured) {
        // Query Firestore collection clinic_appointments by patient_phone
        const appointmentsRef = collection(db, 'clinic_appointments');
        const q = query(appointmentsRef, where('patient_phone', '==', formattedSearch));
        const querySnapshot = await getDocs(q);
        
        const results = [];
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });

        // Sort by date descending
        results.sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));
        setSearchResults(results);
      } else {
        // Query Local Mock Database by phone number
        const results = await mockDb.getAppointmentsByPhone(formattedSearch);
        results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setSearchResults(results);
      }
    } catch (err) {
      console.error('Search query failure:', err);
      setSearchError('Failed to retrieve bookings. Please verify your connection.');
    } finally {
      setSearching(false);
    }
  };

  const renderBookingCard = (booking) => {
    const isConfirmed = booking.status === 'Confirmed';
    
    return (
      <div 
        key={booking.id || `${booking.appointment_date}-${booking.time_slot}`}
        className="bg-white border border-[#EAE5DC] rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden transition-all duration-200 hover:shadow-md"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
        
        <div className="flex items-center justify-between border-b border-[#EAE5DC]/60 pb-3">
          <div className="flex items-center gap-2 text-emerald-700">
            <Calendar className="w-4.5 h-4.5" />
            <span className="font-bold text-xs uppercase tracking-wider">Appointment Pass</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
            isConfirmed 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {!isConfirmed && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>}
            {booking.status || 'Pending'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-600">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-400">Patient Name</span>
                <span className="font-bold text-slate-900">{booking.patient_name}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 text-slate-600">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-400">Registered Phone</span>
                <span className="font-semibold text-slate-800">{booking.patient_phone}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-400">Consultation Date</span>
                <span className="font-bold text-slate-900">
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
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[9px] uppercase tracking-wider font-bold text-slate-400">Reserved Slot</span>
                <span className="font-extrabold text-[#0F766E] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">{booking.time_slot}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-[10px] text-slate-500 leading-relaxed font-medium">
          💡 <strong>Official Proof:</strong> Present this slip card at the clinic counter near Mahabir Chowk, Ranchi, on your appointment day. No email login or printed copy is required.
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12 text-slate-800">
      
      {/* Return button */}
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
          Verify and show proof of your booked slots instantly. Look up past booking receipts securely by entering your phone number—no password or email login needed.
        </p>
      </div>

      {/* Main Grid: Device Caching (Left) & Search (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Phone Lookup Portal (Feature B) */}
        <div className="lg:col-span-5 bg-white border border-[#EAE5DC] rounded-2xl p-6 shadow-sm space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#115E59]"></div>
          
          <div className="space-y-2">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
              <Search className="w-4 h-4 text-[#115E59]" />
              Phone Number Lookup
            </h3>
            <p className="text-2xs text-slate-400">Lookup receipts submitted from any browser or phone.</p>
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
                  placeholder="e.g. 94313 60455"
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
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching Records...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Fetch Appointment Proofs
                </>
              )}
            </button>
          </form>

          {/* Render Search Results */}
          {searchResults !== null && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-2xs font-bold text-slate-400 uppercase tracking-widest">
                Search Results ({searchResults.length})
              </h4>

              {searchResults.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center space-y-1">
                  <p className="text-xs font-bold text-slate-700">No Appointments Found</p>
                  <p className="text-3xs text-slate-400">Verify the phone number or try booking a new slot.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                  {searchResults.map(renderBookingCard)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Local Device Caching Registry (Feature A) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="flex items-center justify-between border-b border-[#EAE5DC] pb-3">
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
              Booked from This Browser
            </h3>
            <span className="text-3xs font-extrabold text-slate-400 uppercase tracking-wider">Local Device Storage</span>
          </div>

          {localBookings.length === 0 ? (
            <div className="bg-white border border-[#EAE5DC] rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mx-auto border border-slate-100">
                🔍
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-slate-700">No Local Booking Slips</h4>
                <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                  You haven't requested any appointments from this browser session yet. If you booked from another device, use the **Phone Lookup** tool.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {localBookings.map(renderBookingCard)}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
