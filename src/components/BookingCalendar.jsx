import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calendar, Clock, User, Phone, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { db, isFirebaseConfigured, mockDb } from '../firebaseClient';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';

export default function BookingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today, but skip to Monday if today is Sunday
    const today = new Date();
    if (today.getDay() === 0) {
      const monday = new Date(today);
      monday.setDate(today.getDate() + 1);
      return monday;
    }
    return today;
  });
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [bookingDetails, setBookingDetails] = useState(null);

  // Doctor consultation slots: 15-minute intervals from 3:00 PM to 4:45 PM (Mon–Sat only)
  const timeSlots = useMemo(() => [
    '03:00 PM', '03:15 PM', '03:30 PM', '03:45 PM',
    '04:00 PM', '04:15 PM', '04:30 PM', '04:45 PM'
  ], []);

  // Format date to YYYY-MM-DD
  const formatDateString = (date) => {
    const d = new Date(date);
    const month = '' + (d.getMonth() + 1);
    const day = '' + d.getDate();
    const year = d.getFullYear();
    return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
  };

  const selectedDateStr = useMemo(() => formatDateString(selectedDate), [selectedDate]);

  // Fetch booked slots for the selected date
  useEffect(() => {
    let active = true;
    async function fetchBookings() {
      setLoadingSlots(true);
      try {
        if (isFirebaseConfigured) {
          const appointmentsRef = collection(db, 'clinic_appointments');
          const q = query(
            appointmentsRef,
            where('appointment_date', '==', selectedDateStr)
          );
          const querySnapshot = await getDocs(q);
          const booked = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status === 'Pending' || data.status === 'Confirmed') {
              booked.push(data.time_slot);
            }
          });
          if (active) setBlockedSlots(booked);
        } else {
          const mockBookings = await mockDb.getAppointments(selectedDateStr);
          const booked = mockBookings
            .filter((apt) => apt.status === 'Pending' || apt.status === 'Confirmed')
            .map((apt) => apt.time_slot);
          if (active) setBlockedSlots(booked);
        }
      } catch (err) {
        console.error('Error fetching bookings:', err);
      } finally {
        if (active) setLoadingSlots(false);
      }
    }
    fetchBookings();
    return () => {
      active = false;
    };
  }, [selectedDateStr]);

  // Calendar logic helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    const today = new Date();
    if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth())) {
      setCurrentDate(new Date(year, month - 1, 1));
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const selectDay = useCallback((day) => {
    const date = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Disable past days and Sundays
    if (date >= today && date.getDay() !== 0) {
      setSelectedDate(date);
      setSelectedTimeSlot(null);
      setError('');
    }
  }, [year, month]);

  // Submit appointment handler
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter a valid phone number.');
      return;
    }
    if (!selectedTimeSlot) {
      setError('Please select a consultation time slot.');
      return;
    }

    setSubmitting(true);

    const payload = {
      patient_name: name.trim(),
      patient_phone: phone.trim(),
      appointment_date: selectedDateStr,
      time_slot: selectedTimeSlot,
      status: 'Pending'
    };

    try {
      if (isFirebaseConfigured) {
        await addDoc(collection(db, 'clinic_appointments'), {
          ...payload,
          created_at: new Date().toISOString()
        });
      } else {
        await mockDb.addAppointment(payload);
      }

      // Sync with Google Sheets via Vercel Serverless Function
      try {
        await fetch('/api/updateSheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'appointment', data: payload })
        });
      } catch (sheetErr) {
        console.error('Google Sheets sync failed:', sheetErr);
      }

      // Trigger 100% Free Automated WhatsApp Web Bridge
      const bridgeUrl = import.meta.env.VITE_WHATSAPP_BRIDGE_URL;
      const bridgeApiKey = import.meta.env.VITE_WHATSAPP_BRIDGE_API_KEY;

      if (bridgeUrl && bridgeApiKey) {
        try {
          const dateObj = new Date(payload.appointment_date);
          const formattedDate = dateObj.toLocaleDateString(undefined, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          const waMsg = `Hello ${payload.patient_name},\n\nYour appointment request at *Kanchan Homoeo Hall* has been successfully received!\n\n📅 *Date:* ${formattedDate}\n🕒 *Time:* ${payload.time_slot}\n🟢 *Status:* Confirmed (Automatic Alert)\n\n📍 *Address:* Near Mahabir Chowk, PyadaToli, Upper Bazar, Ranchi.\n\nThank you for choosing us for holistic, natural remedies! We look forward to seeing you.`;

          fetch(`${bridgeUrl}/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: payload.patient_phone,
              message: waMsg,
              apiKey: bridgeApiKey
            })
          }).then(res => {
            if (!res.ok) console.warn('WhatsApp bridge responded with error status:', res.status);
            else console.log('✅ Automated WhatsApp bridge message sent successfully.');
          }).catch(err => {
            console.error('⚠️ WhatsApp bridge network query failed:', err);
          });
        } catch (bridgeErr) {
          console.error('⚠️ Automated WhatsApp bridge delivery failed:', bridgeErr);
        }
      }

      // Feature A: Append new appointment payload to localStorage cache user_local_bookings
      try {
        const localCache = JSON.parse(localStorage.getItem('user_local_bookings') || '[]');
        localCache.unshift({
          id: 'local_apt_' + Math.random().toString(36).substring(2, 11),
          patient_name: payload.patient_name,
          patient_phone: payload.patient_phone,
          appointment_date: payload.appointment_date,
          time_slot: payload.time_slot,
          status: 'Pending',
          created_at: new Date().toISOString()
        });
        localStorage.setItem('user_local_bookings', JSON.stringify(localCache));
      } catch (cacheErr) {
        console.error('Failed to sync to local device cache:', cacheErr);
      }

      setBookingDetails({
        patient_name: payload.patient_name,
        patient_phone: payload.patient_phone,
        appointment_date: payload.appointment_date,
        time_slot: payload.time_slot
      });
      setSuccess(true);
      
      // Trigger Premium Native Browser Push Notification
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('Booking Requested! 📅', {
              body: `Thank you ${payload.patient_name}, your slot for ${payload.appointment_date} at ${payload.time_slot} has been successfully received.`,
              icon: '/logo.png'
            });
          } catch (e) {
            console.warn('Native notification failed:', e);
          }
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              try {
                new Notification('Booking Requested! 📅', {
                  body: `Thank you ${payload.patient_name}, your slot for ${payload.appointment_date} at ${payload.time_slot} has been successfully received.`,
                  icon: '/logo.png'
                });
              } catch (e) {
                console.warn('Native notification failed:', e);
              }
            }
          });
        }
      }

      setName('');
      setPhone('');
      setSelectedTimeSlot(null);
      setBlockedSlots((prev) => [...prev, selectedTimeSlot]);
    } catch (err) {
      console.error('Booking submission error:', err);
      setError('Failed to book appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Generate calendar day cells — Sundays are blocked
  const daysGrid = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="w-full aspect-square max-w-[40px]"></div>);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= daysInMonth; d++) {
      const thisDate = new Date(year, month, d);
      const isPast = thisDate < today;
      const isSunday = thisDate.getDay() === 0;
      const isBlocked = isPast || isSunday;
      const isSelected = selectedDate.getDate() === d &&
                         selectedDate.getMonth() === month &&
                         selectedDate.getFullYear() === year;
      
      let dayBtnStyles = "w-full aspect-square max-w-[40px] rounded-lg flex items-center justify-center font-medium text-sm transition-all duration-200 ";
      if (isBlocked) {
        if (isSunday && !isPast) {
          // Sundays: distinctive "closed" styling — rose tint, strikethrough
          dayBtnStyles += "text-rose-400/50 cursor-not-allowed bg-rose-50/30 line-through opacity-50";
        } else {
          dayBtnStyles += "text-slate-300 cursor-not-allowed bg-slate-50 line-through opacity-40";
        }
      } else if (isSelected) {
        dayBtnStyles += "bg-emerald-600 text-white shadow-md hover:bg-emerald-700 ring-2 ring-emerald-300";
      } else {
        dayBtnStyles += "text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer border border-slate-100 hover:border-emerald-200";
      }

      cells.push(
        <button
          key={`day-${d}`}
          type="button"
          disabled={isBlocked}
          onClick={() => selectDay(d)}
          title={isSunday ? 'Closed on Sundays' : undefined}
          className={dayBtnStyles}
        >
          {d}
        </button>
      );
    }
    return cells;
  }, [year, month, selectedDate, firstDayIndex, daysInMonth, selectDay]);

  return (
    <div className="glassmorphism-light rounded-2xl p-4 sm:p-6 md:p-8 max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
      {/* Visual neon light bar on card top */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-neon"></div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-slate-900 mt-2">
        {/* Left Side: Calendar */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  Select Date
                </h3>
                <p className="text-2xs text-slate-500 mt-0.5">Clinic open Monday – Saturday only</p>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={year === new Date().getFullYear() && month === new Date().getMonth()}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-sm text-slate-800 min-w-[100px] text-center">
                  {monthNames[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-slate-100 rounded-xl p-3 bg-white">
              <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-slate-400 mb-2 py-1 uppercase tracking-wider">
                <div className="text-rose-400">Su</div>
                <div>Mo</div>
                <div>Tu</div>
                <div>We</div>
                <div>Th</div>
                <div>Fr</div>
                <div>Sa</div>
              </div>
              <div className="grid grid-cols-7 gap-1 md:gap-1.5 justify-items-center w-full">
                {daysGrid}
              </div>
            </div>

            {/* Sunday closed legend */}
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="w-3 h-3 rounded bg-rose-100 border border-rose-200 inline-block"></span>
              <span>Sundays are closed — no appointments available</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 flex items-start gap-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
            <p className="text-xs text-emerald-800 leading-relaxed font-medium">
              Selected: <span className="font-bold underline text-emerald-950">{selectedDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>. Consultation slots refresh in real-time.
            </p>
          </div>
        </div>

        {/* Right Side: Available Slots & Form OR Booking Success Receipt */}
        <div className="lg:col-span-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-200/70 pt-6 lg:pt-0 lg:pl-8 min-h-[380px]">
          {success && bookingDetails ? (
            <div className="flex flex-col h-full justify-between animate-fade-in space-y-5">
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600 shadow-sm animate-bounce mt-2">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-slate-800 tracking-tight">Booking Requested!</h3>
                  <p className="text-2xs text-slate-500 mt-0.5">Your consultation request has been submitted successfully.</p>
                </div>
              </div>

              {/* Receipt Summary Card */}
              <div className="bg-[#FDFBF7] border border-[#EAE5DC] rounded-xl p-4 space-y-3 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>
                
                <h4 className="text-[10px] font-bold text-[#115E59] uppercase tracking-widest border-b border-[#EAE5DC] pb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Appointment Slip
                </h4>

                <div className="space-y-2 text-2xs text-slate-700">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Patient:</span>
                    <span className="font-bold text-slate-900">{bookingDetails.patient_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Phone:</span>
                    <span className="font-semibold text-slate-800">{bookingDetails.patient_phone}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Date:</span>
                    <span className="font-bold text-slate-900">
                      {new Date(bookingDetails.appointment_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-500">Selected Slot:</span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-100 font-extrabold">{bookingDetails.time_slot}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-[#EAE5DC]/60">
                    <span className="font-semibold text-[#0F766E]">Status:</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border border-amber-200 bg-amber-50 text-amber-700 uppercase">
                      <span className="w-1 h-1 rounded-full bg-amber-500 animate-ping"></span>
                      Pending Review
                    </span>
                  </div>
                </div>
              </div>

              {/* Web Notification & Free WhatsApp Action Alert */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-100/80 rounded-xl flex items-start gap-2 text-[10px] text-emerald-800 leading-relaxed font-medium">
                <span className="flex h-1.5 w-1.5 relative mt-1 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <div>
                  <strong className="text-emerald-950 font-bold block mb-0.5">Free Web Booking Saved</strong>
                  Your appointment slip has been saved. Please click the button below to send your confirmation request to us on WhatsApp for <strong>100% free instant confirmation</strong>.
                </div>
              </div>

              {/* Direct WhatsApp Confirmation Button */}
              <div className="space-y-2">
                <a
                  href={`https://wa.me/919431360455?text=${encodeURIComponent(
                    `Hello Kanchan Homoeo Hall,\n\nI have successfully requested an appointment via your website!\n\n👤 *Patient*: ${bookingDetails.patient_name}\n📱 *Phone*: ${bookingDetails.patient_phone}\n📅 *Date*: ${new Date(bookingDetails.appointment_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n🕒 *Time*: ${bookingDetails.time_slot}\n\nPlease confirm my slot. Thank you!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#1EBE57] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 group ring-4 ring-emerald-50"
                >
                  <svg className="w-4 h-4 fill-current shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.46h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Confirm on WhatsApp
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setBookingDetails(null);
                  }}
                  className="w-full text-center py-2 text-[#115E59] hover:text-[#0D4F4A] hover:underline cursor-pointer font-bold text-2xs uppercase tracking-wider"
                >
                  Book Another Appointment
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2 mb-1">
                  <Clock className="w-5 h-5 text-cyan-600" />
                  Consultation Slots
                </h3>
                <p className="text-xs text-slate-500 mb-4">Doctor available 3:00 PM – 5:00 PM (15-min slots)</p>

                {loadingSlots ? (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <span className="text-xs font-medium">Refreshing active slots...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => {
                      const isBooked = blockedSlots.includes(slot);
                      const isSelected = selectedTimeSlot === slot;

                      let slotStyles = "py-2 px-3 text-center rounded-lg text-xs font-semibold tracking-wide border transition-all duration-200 whitespace-nowrap ";
                      if (isBooked) {
                        slotStyles += "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through";
                      } else if (isSelected) {
                        slotStyles += "bg-cyan-600 text-white border-cyan-700 shadow-md ring-2 ring-cyan-200";
                      } else {
                        slotStyles += "bg-white text-slate-700 border-slate-200 hover:border-cyan-400 hover:text-cyan-700 cursor-pointer";
                      }

                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isBooked}
                          onClick={() => {
                            setSelectedTimeSlot(slot);
                            setError('');
                          }}
                          className={slotStyles}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <form onSubmit={handleBookingSubmit} className="space-y-4 mt-6">
                <div>
                  <label htmlFor="patient-name" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      id="patient-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="e.g. Ramesh Kumar"
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="patient-phone" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      id="patient-phone"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="e.g. 94313 60455"
                      className="block w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Notifications */}
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-medium rounded-xl flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Securing slot...
                    </>
                  ) : (
                    'Confirm Appointment'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
