import React, { useEffect, useRef, useState } from 'react';
import { Room } from '../api/roomsApi';
import { getAmenitiesForRoom } from '../api/amenticsApi';

// Helper: resolve room image path (handles filenames, arrays, JSON lists, relative paths, full URLs)
function resolveRoomImageUrl(u: any, fallback = '/img/room/default.webp') {
  if (u == null) return fallback;

  // If it's an array, take the first non-empty element
  if (Array.isArray(u)) {
    const first = u.find((x) => !!x);
    return resolveRoomImageUrl(first, fallback);
  }

  // If it's an object with 'u' or similar, try to extract
  if (typeof u === 'object') {
    const candidate = (u && (u.u || u.url || u.src)) || null;
    return resolveRoomImageUrl(candidate, fallback);
  }

  // String handling
  let s = String(u).trim();
  if (!s) return fallback;

  // If looks like JSON array (e.g. '["a.jpg","b.jpg"]'), parse and take first
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length > 0) return resolveRoomImageUrl(arr[0], fallback);
    } catch (e) {
      // fallthrough to other parsing
    }
  }

  // If contains commas/semicolons treat as list and pick first
  if (s.includes(',') || s.includes(';') || s.includes('|')) {
    const first = s.split(/[,|;]+/)[0].trim();
    return resolveRoomImageUrl(first, fallback);
  }

  // If already an absolute URL or protocol-relative, return as-is
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('//')) return s;

  // If it's already a path under /img or starts with slash, return as-is
  if (s.startsWith('/img') || s.startsWith('/')) return s;

  // Otherwise assume it's a filename and prefix with /img/room/
  return `/img/room/${s}`;
}

// ImageGallery: inline main image with vertical thumbnails and centered counter (no fullscreen preview)
const ImageGallery: React.FC<{
  srcHint?: any;
  alt?: string;
  height?: number | string;
}> = ({ srcHint, alt, height = '100%' }) => {
  const defaultJpg = '/img/room/room-1.jpg';
  const makeCandidates = (u?: any) => {
    const out: string[] = [];
    if (u == null) return out;
    if (Array.isArray(u)) {
      for (const it of u) out.push(...makeCandidates(it));
      return out;
    }
    const s = String(u || '').trim();
    if (!s) return out;
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return makeCandidates(arr);
      } catch (e) {}
    }
    const parts = s.split(/[,|;]+/).map((x) => x.trim()).filter(Boolean);
    for (const p of parts) {
      if (p.startsWith('http') || p.startsWith('//') || p.startsWith('/img') || p.startsWith('/')) out.push(p);
      else out.push(`/img/room/${p}`);
    }
    return out;
  };

  const sources = (() => {
    const s = makeCandidates(srcHint);
    return s.length ? Array.from(new Set(s)) : [defaultJpg];
  })();

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 3s unless paused
  useEffect(() => {
    if (sources.length <= 1) return;
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % sources.length);
    }, 3000);
    return () => clearInterval(id);
  }, [sources.length, paused]);

  return (
    <div
      style={{ position: 'relative', width: '100%', height: typeof height === 'number' ? `${height}px` : height, overflow: 'hidden', borderRadius: 8, background: '#000' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Main image */}
      <img src={sources[index]} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

      {/* Vertical thumbnails - top right */}
      {sources.length > 1 && (
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 10 }}>
          {sources.map((s, idx) => (
            <div key={idx} onClick={(e) => { e.stopPropagation(); setIndex(idx); }} style={{ width: 84, height: 64, borderRadius: 8, overflow: 'hidden', border: idx === index ? '4px solid #f59e0b' : '2px solid rgba(255,255,255,0.12)', boxShadow: idx === index ? '0 6px 18px rgba(245,158,11,0.25)' : '0 2px 8px rgba(0,0,0,0.2)', cursor: 'pointer', background: '#fff' }}>
              <img src={s} alt={`thumb-${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
        </div>
      )}

      {/* Centered counter badge bottom */}
      {sources.length > 1 && (
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '10px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600, zIndex: 10 }}>
          {index + 1} / {sources.length}
        </div>
      )}
    </div>
  );
};

type RoomType = {
  idLoaiPhong: string;
  tenLoaiPhong?: string | null;
  moTa?: string | null;
  urlAnhLoaiPhong?: string | null;
};

type Props = {
  visible: boolean;
  roomType: RoomType | null;
  rooms: Room[];
  availableRooms: Room[];
  checkin: string;
  checkout: string;
  loadingAvailability: boolean;
  expandedRoom: string | null;
  hasCheckedAvailability: boolean;
  onClose: () => void;
  setCheckin: (v: string) => void;
  setCheckout: (v: string) => void;
  onCheckAvailability: (guests?: number, rooms?: number) => void;
  toggleExpand: (id: string) => void;
  onBook?: (room: Room) => void;
};

const RoomTypeModal: React.FC<Props> = ({
  visible,
  roomType,
  rooms,
  availableRooms,
  checkin,
  checkout,
  loadingAvailability,
  expandedRoom,
  hasCheckedAvailability,
  onClose,
  setCheckin,
  setCheckout,
  onCheckAvailability,
  toggleExpand,
  onBook,
}) => {
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [numberOfRooms, setNumberOfRooms] = useState(1);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const checkoutRef = useRef<HTMLInputElement | null>(null);

  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(() => {
    const src = availableRooms && availableRooms.length > 0 ? availableRooms : rooms;
    const initial: string[] = [];
    for (let i = 0; i < numberOfRooms && i < src.length; i++) initial.push(src[i].idphong);
    return initial;
  });

  useEffect(() => {
    const src = availableRooms && availableRooms.length > 0 ? availableRooms : rooms;
    setSelectedRoomIds((prev) => {
      const next = prev.slice(0, numberOfRooms);
      for (let i = next.length; i < numberOfRooms; i++) {
        const pick = src.find((r) => !next.includes(r.idphong));
        next.push(pick ? pick.idphong : '');
      }
      return next;
    });
  }, [numberOfRooms, availableRooms, rooms]);

  // Toast notification when availability check completes
  useEffect(() => {
    if (hasCheckedAvailability && !loadingAvailability && checkin && checkout) {
      const message = availableRooms.length > 0
        ? `✅ Có ${availableRooms.length} phòng trống`
        : '❌ Không có phòng trống';
      setToastMessage(message);
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hasCheckedAvailability, loadingAvailability, availableRooms.length, checkin, checkout]);

  const handleSelectRoom = (index: number, id: string) => {
    setSelectedRoomIds((prev) => {
      const next = [...prev];
      next[index] = id;
      return next;
    });
  };

  const selectedCount = selectedRoomIds.filter(Boolean).length;

  const isRoomSelected = (id: string) => selectedRoomIds.includes(id);

  // If user clicks a room in the list when choosing multiple rooms,
  // fill the first empty slot or remove it if already selected.
  const toggleSelectFromList = (id: string) => {
    setSelectedRoomIds((prev) => {
      const next = [...prev];
      const idx = next.indexOf(id);
      if (idx !== -1) {
        // remove from its slot
        next[idx] = '';
        return next;
      }
      // not selected: find first empty slot
      const empty = next.findIndex(x => !x);
      if (empty !== -1) {
        next[empty] = id;
        return next;
      }
      // no empty slot: if not full allow replace last selected? For now, ignore and keep unchanged
      return next;
    });
  };

  if (!visible || !roomType) return null;

  const list = availableRooms.length > 0 ? availableRooms : rooms;

  // Get minimum date (today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayString = today.toISOString().split('T')[0];

  // Format date for min attribute (YYYY-MM-DD)
  const getMinDate = () => {
    return todayString;
  };

  // Format ISO (YYYY-MM-DD) to display dd/MM/yyyy for helper text
  const formatToDisplay = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // When check-in changes, auto-set checkout to checkin + 1 day
  const handleCheckinChange = (value: string) => {
    setCheckin(value);
    if (value) {
      const checkInDate = new Date(value);
      checkInDate.setHours(0, 0, 0, 0);
      // Do not auto-set checkout; allow user to choose.
      // If an existing checkout is before the minimum (checkIn + 1), clear it so user must pick.
      const minCheckOut = new Date(checkInDate);
      minCheckOut.setDate(minCheckOut.getDate() + 1);
      const minCheckOutString = minCheckOut.toISOString().split('T')[0];
      if (checkout) {
        const curCheckoutDate = new Date(checkout);
        curCheckoutDate.setHours(0, 0, 0, 0);
        if (curCheckoutDate < minCheckOut) {
          setCheckout('');
        }
      }
      // focus the checkout input so the user can pick the checkout date next
      // use a micro task to ensure the input exists in the DOM
      setTimeout(() => checkoutRef.current?.focus(), 0);
    }
  };

  // Validation helpers
  const getValidationError = () => {
    if (!checkin || !checkout) return null;
    
    const checkInDate = new Date(checkin);
    checkInDate.setHours(0, 0, 0, 0);
    const checkOutDate = new Date(checkout);
    checkOutDate.setHours(0, 0, 0, 0);
    
    // Check-in phải là ngày hôm nay hoặc tương lai
    if (checkInDate < today) {
      return "Ngày nhận phòng không được là ngày trong quá khứ.";
    }
    
    // Check-out phải hơn check-in ít nhất 1 ngày
    const minCheckOut = new Date(checkInDate);
    minCheckOut.setDate(minCheckOut.getDate() + 1);
    
    if (checkOutDate < minCheckOut) {
      return "Ngày trả phòng phải hơn ngày nhận phòng ít nhất 1 ngày.";
    }
    
    return null;
  };

  const validationError = getValidationError();

  // Booking readiness (supports multi-room selection)
  const baseCanBook = !!checkin && !!checkout && !validationError;
  const multipleSelectedReady = numberOfRooms > 1
    ? (selectedRoomIds.length === numberOfRooms && selectedRoomIds.every(id => !!id) && new Set(selectedRoomIds).size === selectedRoomIds.length)
    : true;
  const canBook = baseCanBook && multipleSelectedReady;

  // When user clicks "Đặt ngay" — save booking info and go to checkout
  const handleBookNow = (room: Room) => {
    try {
      // call optional prop for upstream handlers
      if (onBook) onBook(room);
    } catch (e) {
      // ignore
    }

    const bookingInfo = {
      selectedRooms: [{ roomNumber: 1, room }],
      checkIn: checkin,
      checkOut: checkout,
      guests: numberOfGuests,
      totalRooms: numberOfRooms,
    };

    try {
      sessionStorage.setItem("bookingInfo", JSON.stringify(bookingInfo));
    } catch (e) {
      console.error("Failed to store bookingInfo", e);
    }
    // redirect to checkout page
    window.location.href = "/checkout";
  };

  // Booking flow for multiple selected rooms from the controls
  const handleBookNowMultiple = () => {
    const src = availableRooms && availableRooms.length > 0 ? availableRooms : rooms;
    const roomsSelected = selectedRoomIds.map((id, idx) => {
      const roomObj = src.find(r => r.idphong === id) || null;
      return { roomNumber: idx + 1, room: roomObj };
    });

    if (roomsSelected.some(r => r.room == null)) {
      console.error('Some selected rooms were not found.');
      return;
    }

    const bookingInfo = {
      selectedRooms: roomsSelected.map(r => ({ roomNumber: r.roomNumber, room: r.room })),
      checkIn: checkin,
      checkOut: checkout,
      guests: numberOfGuests,
      totalRooms: numberOfRooms,
    };

    try {
      sessionStorage.setItem("bookingInfo", JSON.stringify(bookingInfo));
    } catch (e) {
      console.error("Failed to store bookingInfo", e);
    }
    window.location.href = "/checkout";
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: 1000, maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 0 }}
      >
        {/* Toast Notification */}
        {showToast && (
          <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10011, background: '#fff', padding: '16px 20px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '15px', fontWeight: 500, animation: 'slideIn 0.3s ease-in-out', maxWidth: 300 }}>
            {toastMessage}
          </div>
        )}
        <style>{`
          @keyframes slideIn {
            from {
              transform: translateX(400px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: 600 }}>{roomType.tenLoaiPhong}</h2>
            {roomType.moTa && <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>{roomType.moTa}</p>}
          </div>
          <button onClick={onClose} aria-label="close" style={{ background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Image + Controls (side-by-side) */}
        <div style={{ padding: '24px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 420px', gap: 24 }}>
            {/* Left: Image */}
            <div style={{ width: '100%', minHeight: 320, overflow: 'hidden', borderRadius: 8 }}>
              <img src={resolveRoomImageUrl(roomType.urlAnhLoaiPhong, '/img/room/room-b1.jpg')} alt={roomType.tenLoaiPhong ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>

            {/* Right: Controls */}
            <div style={{ padding: '0', background: 'transparent' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {/* Check-in */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333' }}>📅 Ngày nhận phòng</label>
                  <input type="date" value={checkin} onChange={(e) => handleCheckinChange(e.target.value)} min={getMinDate()} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
                  <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>{checkin ? formatToDisplay(checkin) : 'dd/mm/yyyy'}</div>
                </div>

                {/* Check-out */}
                <div>
                  <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333' }}>📅 Ngày trả phòng</label>
                  <input ref={checkoutRef} type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} min={checkin ? new Date(new Date(checkin).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : getMinDate()} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd' }} />
                  <div style={{ marginTop: 6, color: '#888', fontSize: 12 }}>{checkout ? formatToDisplay(checkout) : 'dd/mm/yyyy'}</div>
                </div>

                {/* Guests & Rooms inline */}
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333' }}>👥 Số người</label>
                    <select value={numberOfGuests} onChange={(e) => setNumberOfGuests(parseInt(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd' }}>
                      {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} người</option>)}
                    </select>
                  </div>
                  <div style={{ width: 110 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#333' }}>🏠 Số phòng</label>
                    <select value={numberOfRooms} onChange={(e) => setNumberOfRooms(parseInt(e.target.value))} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #ddd' }}>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} phòng</option>)}
                    </select>
                  </div>
                </div>

                {validationError && (
                  <div style={{ padding: 10, background: '#fdecea', borderRadius: 6, color: '#c0392b', fontSize: 13 }}>{'⚠️ ' + validationError}</div>
                )}

                <button onClick={() => onCheckAvailability(numberOfGuests, numberOfRooms)} disabled={loadingAvailability || !checkin || !checkout || !!validationError} style={{ width: '100%', padding: '12px 14px', borderRadius: 6, border: 'none', background: loadingAvailability || validationError ? '#ccc' : 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)', color: '#fff', fontWeight: 600, cursor: validationError ? 'not-allowed' : 'pointer' }}>{loadingAvailability ? '⏳ Đang kiểm tra...' : '🔍 Kiểm tra phòng trống'}</button>

                {/* multi-room selectors moved below image to its own row */}
              </div>
            </div>
          </div>
        </div>

        {/* Per-slot selectors row (under image) */}
        {numberOfRooms > 1 && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #eee', background: '#fff' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Chọn phòng cho từng phòng</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ maxHeight: 160, overflowY: 'auto', paddingRight: 6 }}>
                {Array.from({ length: numberOfRooms }).map((_, i) => (
                  <select key={i} value={selectedRoomIds[i] ?? ''} onChange={(e) => handleSelectRoom(i, e.target.value)} style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box', background: '#fff', marginBottom: 6 }}>
                    <option value="">-- Chọn phòng #{i + 1} --</option>
                    {list.map(r => {
                      const disabled = selectedRoomIds.includes(r.idphong) && selectedRoomIds[i] !== r.idphong;
                      const label = `${r.tenPhong || ''}${r.soPhong ? ` - ${r.soPhong}` : ''}${r.giaCoBanMotDem ? ` - ${r.giaCoBanMotDem.toLocaleString()} ₫/đêm` : ''}`;
                      return <option key={r.idphong} value={r.idphong} disabled={disabled}>{label}</option>;
                    })}
                  </select>
                ))}
              </div>
              <div>
                <button onClick={handleBookNowMultiple} disabled={!canBook} style={{ marginTop: 0, width: '100%', padding: '12px 14px', borderRadius: 6, border: 'none', background: canBook ? 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)' : '#ccc', color: '#fff', fontWeight: 600, cursor: canBook ? 'pointer' : 'not-allowed' }}>{`💳 Đặt ngay (${numberOfRooms} phòng)`}</button>
              </div>
            </div>
          </div>
        )}

        {/* Room List Section */}
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Danh sách phòng</h3>
            {hasCheckedAvailability && availableRooms.length > 0 && (
              <span style={{ background: '#d4edda', color: '#155724', padding: '4px 12px', borderRadius: 20, fontSize: '13px', fontWeight: 600 }}>
                {availableRooms.length} phòng trống
              </span>
            )}
          </div>

          {hasCheckedAvailability && availableRooms.length === 0 && !loadingAvailability && checkin && checkout && (
            <div style={{ padding: 16, background: '#fdecea', borderRadius: 8, color: '#c0392b', textAlign: 'center', fontSize: '16px', fontWeight: 500 }}>
              ❌ Không có phòng trống cho khoảng thời gian đã chọn
            </div>
          )}

          <div style={{ display: 'grid', gap: 16 }}>
            {list.map((room) => (
              <div key={room.idphong} style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', background: '#fff', transition: 'all 0.3s ease', boxShadow: expandedRoom === room.idphong ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}>
                {/* Room Header as card with thumbnail + basic info */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: 16, background: '#fafafa' }}>
                  {/* Thumbnail */}
                  <div style={{ width: 180, height: 120, flex: '0 0 180px', overflow: 'hidden', borderRadius: 8, background: '#fff', border: '1px solid #f0f0f0' }}>
                    <img src={resolveRoomImageUrl(room.urlAnhPhong)} alt={room.tenPhong ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>

                  {/* Basic info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: '16px', color: '#333' }}>{room.tenPhong} {room.soPhong ? `- ${room.soPhong}` : ''}</div>
                      {/* assignment badge if this room is selected for a slot
                      {selectedRoomIds && selectedRoomIds.indexOf(room.idphong) !== -1 && (
                        <span style={{ background: '#2f855a', color: '#fff', padding: '4px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          Phòng {selectedRoomIds.indexOf(room.idphong) + 1}
                        </span>
                      )} */}
                    </div>
                    <div style={{ color: '#666', fontSize: '13px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{room.soNguoiToiDa ? `👥 Tối đa ${room.soNguoiToiDa} người` : '—'}</span>
                      <span>•</span>
                      <span>{room.giaCoBanMotDem ? `💰 ${room.giaCoBanMotDem.toLocaleString()} ₫/đêm` : 'Liên hệ'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {/* Select toggle for multi-room booking */}
                      {numberOfRooms > 1 && (
                        <button
                          onClick={() => toggleSelectFromList(room.idphong)}
                          disabled={!isRoomSelected(room.idphong) && selectedCount >= numberOfRooms}
                          style={{ padding: '8px 12px', borderRadius: 6, border: isRoomSelected(room.idphong) ? '1px solid #2f855a' : '1px solid #ddd', background: isRoomSelected(room.idphong) ? '#2f855a' : '#fff', color: isRoomSelected(room.idphong) ? '#fff' : '#333', cursor: (!isRoomSelected(room.idphong) && selectedCount >= numberOfRooms) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, opacity: (!isRoomSelected(room.idphong) && selectedCount >= numberOfRooms) ? 0.6 : 1 }}
                          aria-pressed={isRoomSelected(room.idphong)}
                          title={isRoomSelected(room.idphong) ? 'Bỏ chọn phòng này' : (selectedCount >= numberOfRooms ? 'Đã chọn đủ số phòng' : 'Chọn phòng này để thanh toán cùng')}
                        >
                          {isRoomSelected(room.idphong) ? '✓ Đã chọn' : 'Chọn'}
                        </button>
                      )}
                      <button 
                        onClick={() => toggleExpand(room.idphong)} 
                        style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'all 0.2s' }}
                      >
                        {expandedRoom === room.idphong ? '▼ Ẩn chi tiết' : '▶ Xem chi tiết'}
                      </button>
                      <button
                        onClick={() => handleBookNow(room)}
                        disabled={!canBook}
                        style={{ padding: '8px 14px', borderRadius: 6, background: canBook ? 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)' : '#ccc', color: '#fff', border: 'none', cursor: canBook ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 500, transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { if (canBook) (e.currentTarget.style.transform = 'scale(1.05)') }}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        Đặt ngay
                      </button>
                    </div>
                </div>

                {/* Room Details */}
                {expandedRoom === room.idphong && (
                  <div style={{ padding: 16, borderTop: '1px solid #e0e0e0', background: '#fff' }}>
                    {/* Image full-width on its own row */}
                    <div style={{ width: '100%', height: 360, overflow: 'hidden', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
                      <ImageGallery srcHint={room.urlAnhPhong} alt={room.tenPhong ?? ''} height={360} />
                    </div>

                    {/* Info below image */}
                    <div>
                      {room.moTa && <div style={{ marginBottom: 12, color: '#555', fontSize: '14px', lineHeight: 1.5 }}>{room.moTa}</div>}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        {/* Info Box 1 */}
                        <div style={{ padding: 12, background: '#f5f7fa', borderRadius: 8, border: '1px solid #e8eff7' }}>
                          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '13px', color: '#333' }}>📊 Thông tin</div>
                          <div style={{ color: '#666', fontSize: '13px', lineHeight: 1.8 }}>
                            <div>Sức chứa: <strong>{room.soNguoiToiDa ?? '—'} người</strong></div>
                            {room.soPhong && <div>Số phòng: <strong>{room.soPhong}</strong></div>}
                            <div>Giá: <strong>{room.giaCoBanMotDem != null ? room.giaCoBanMotDem.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ'}</strong></div>
                          </div>
                        </div>

                        {/* Info Box 2 */}
                        <div style={{ padding: 12, background: '#f5f7fa', borderRadius: 8, border: '1px solid #e8eff7' }}>
                          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '13px', color: '#333' }}>✨ Tiện ích</div>
                          <AmenitiesForRoom roomId={room.idphong} />
                        </div>
                      </div>

                      {/* Book Button in Details */}
                      <button
                        onClick={() => handleBookNow(room)}
                        disabled={!canBook}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 6, background: canBook ? 'linear-gradient(135deg,#dfa974 0%,#c8956d 100%)' : '#ccc', color: '#fff', border: 'none', cursor: canBook ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { if (canBook) (e.currentTarget.style.transform = 'translateY(-2px)') }}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        💳 Đặt phòng ngay
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function AmenitiesForRoom({ roomId }: { roomId?: string | null }) {
  const [items, setItems] = useState<{ idtienNghi: string; tenTienNghi: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!roomId) {
      setItems([]);
      return;
    }
    setLoading(true);
    getAmenitiesForRoom(roomId)
      .then((data: any) => {
        if (cancelled) return;
        const norm = (data || []).map((d: any) => ({ idtienNghi: d.idtienNghi || d.IdtienNghi || '', tenTienNghi: d.tenTienNghi || d.TenTienNghi || '' }));
        setItems(norm);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [roomId]);

  if (loading) return <div style={{ color: '#666' }}>Loading…</div>;
  if (!items || items.length === 0) return <div style={{ color: '#666' }}>—</div>;
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((it) => (
        <span key={it.idtienNghi || it.tenTienNghi} style={{ background: '#f1f5f9', color: '#111827', padding: '6px 10px', borderRadius: 999, fontSize: 13, border: '1px solid #e2e8f0' }}>{it.tenTienNghi || it.idtienNghi}</span>
      ))}
    </div>
  );
}

export default RoomTypeModal;