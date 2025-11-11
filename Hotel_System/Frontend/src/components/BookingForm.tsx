import React, { useState } from "react";
import RoomCard from "./Room/RoomCard";

type BookingFormProps = {
  horizontal?: boolean; // compact inline layout to save vertical space
  fullWidth?: boolean; // stretch across the full row with larger inputs (hero/room bar style)
  // onResults now accepts optional metadata as 3rd argument: { rooms }
  onResults?: (
    results: any[],
    message?: string,
    meta?: { rooms?: number }
  ) => void; // callback to pass results instead of showing modal
};

const BookingForm: React.FC<BookingFormProps> = ({
  horizontal = false,
  fullWidth = false,
  onResults,
}) => {
  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const [checkIn, setCheckIn] = useState<string>(toDateInput(today));
  const [checkOut, setCheckOut] = useState<string>(toDateInput(tomorrow));
  const [guests, setGuests] = useState<number>(2);
  const [rooms, setRooms] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const checkAvailability = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMessage(null);
    // Basic validation using the controlled date inputs (strings). If a parent
    // provided onResults we prefer to surface validation failures there so the
    // Room page can show inline messages instead of a modal.
    if (!checkIn || !checkOut) {
      const msg = "Vui lòng chọn cả ngày đến và ngày đi.";
      if (onResults) onResults([], msg);
      else setMessage(msg);
      return;
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      const msg = "Ngày đến phải trước ngày đi.";
      if (onResults) onResults([], msg);
      else setMessage(msg);
      return;
    }

    if (Number(guests) <= 0) {
      const msg = "Số người phải lớn hơn 0.";
      if (onResults) onResults([], msg);
      else setMessage(msg);
      return;
    }
    setLoading(true);
    try {
      const body = {
        CheckIn: new Date(checkIn).toISOString(),
        CheckOut: new Date(checkOut).toISOString(),
        NumberOfGuests: Number(guests),
      };

      const res = await fetch("/api/Phong/check-available-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const text = json && (json.message || JSON.stringify(json));
        throw new Error(text || `HTTP ${res.status}`);
      }

      if (!Array.isArray(json)) {
        if (json && json.message) {
          setResults([]);
          const msg = json.message;
          if (onResults) {
            onResults([], msg);
          } else {
            // If there is no onResults callback (likely used on the homepage),
            // navigate to the rooms page with the selected dates so the Room
            // page can handle the availability check and display inline.
            const params = new URLSearchParams({
              checkIn: new Date(checkIn).toISOString().slice(0, 10),
              checkOut: new Date(checkOut).toISOString().slice(0, 10),
              guests: String(guests ?? 1),
              rooms: String(rooms ?? 1),
            });
            // navigate to /rooms with query params
            window.location.href = `/rooms?${params.toString()}`;
          }
        } else {
          const msg = "Không có phòng phù hợp.";
          if (onResults) {
            onResults([], msg);
          } else {
            setMessage(msg);
            setModalOpen(true);
          }
        }
      } else {
        const resData = json as any[];

        // Normalize API response items into the frontend Room shape so
        // RoomCard and RoomPage show the expected fields (tenPhong, soPhong, giaCoBanMotDem, urlAnhPhong...).
        // Based on the sample API response: roomId, roomNumber, description, basePricePerNight, roomImageUrl, roomTypeName, maxOccupancy
        const normalize = (r: any) => {
          const roomTypeName = r.roomTypeName ?? r.RoomTypeName;
          const roomNumberOrId =
            r.roomNumber ?? r.RoomNumber ?? r.roomId ?? r.RoomId;
          const composedName =
            roomTypeName && roomNumberOrId
              ? `${roomTypeName} ${roomNumberOrId}`
              : roomTypeName ??
                (roomNumberOrId ? `Phòng ${roomNumberOrId}` : undefined);

          return {
            idphong:
              r.roomId ?? r.RoomId ?? r.idphong ?? String(roomNumberOrId ?? ""),
            idloaiPhong: r.idloaiPhong ?? null, // Not in sample, keep null
            tenPhong: composedName,
            tenLoaiPhong: roomTypeName,
            soPhong: r.roomNumber ?? r.RoomNumber ?? r.roomId ?? r.RoomId,
            moTa: r.description ?? r.Description,
            soNguoiToiDa: r.maxOccupancy ?? r.MaxOccupancy,
            giaCoBanMotDem: r.basePricePerNight ?? r.BasePricePerNight,
            xepHangSao: r.xepHangSao ?? null, // Not in sample
            trangThai: r.trangThai ?? "Trống", // Assume available
            urlAnhPhong: r.roomImageUrl ?? r.RoomImageUrl,
            // keep original raw object for debugging if needed
            __raw: r,
          };
        };

        const normalized = resData.map(normalize);

        // Always store results in sessionStorage for later use
        try {
          sessionStorage.setItem("bookingResults", JSON.stringify(normalized));
        } catch {}

        const params = new URLSearchParams({
          checkIn: new Date(checkIn).toISOString().slice(0, 10),
          checkOut: new Date(checkOut).toISOString().slice(0, 10),
          guests: String(guests ?? 1),
          rooms: String(rooms ?? 1),
        });

        // Always redirect to select-room page for any rooms count (>=1)
        // Save normalized results in sessionStorage first.
        window.location.href = `/select-room?${params.toString()}`;
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (onResults) {
        onResults([], msg);
      } else {
        setMessage(msg);
        setModalOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Horizontal layout: try to keep everything in one row on wide screens.
  // If the viewport is too narrow, allow horizontal scroll instead of wrapping.
  const formStyle: React.CSSProperties | undefined = horizontal
    ? {
        display: "flex",
        gap: fullWidth ? 20 : 12,
        alignItems: "center",
        flexWrap: "nowrap",
        overflowX: "auto",
        paddingBottom: 4,
        width: fullWidth ? "100%" : undefined,
        justifyContent: fullWidth ? "flex-start" : undefined,
      }
    : undefined;

  const fieldStyle: React.CSSProperties = horizontal
    ? {
        display: "flex",
        flexDirection: "column",
        minWidth: fullWidth ? 180 : 120,
        flex: "0 0 auto",
      }
    : { display: "block", marginBottom: 8 };

  // Input width: larger for fullWidth (bar-like) mode
  const inputStyle: React.CSSProperties = horizontal
    ? { width: fullWidth ? 240 : 130, boxSizing: "border-box" }
    : {};

  // Format date display like "13 THÁNG 11 TH 5"
  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const weekday = ["CN", "T 2", "T 3", "T 4", "T 5", "T 6", "T 7"][
      d.getDay()
    ];
    return { day, month, weekday };
  };

  const checkInDisplay = formatDateDisplay(checkIn);
  const checkOutDisplay = formatDateDisplay(checkOut);

  return (
    <div
      className={`booking-form ${
        horizontal ? "booking-form--horizontal" : ""
      } ${fullWidth ? "booking-form--full" : ""}`}
    >
      <form onSubmit={checkAvailability} style={formStyle}>
        {fullWidth ? (
          <>
            {/* Date display boxes (large format) */}
            <div
              className="date-box"
              style={{ position: "relative" }}
              tabIndex={0}
              onPointerDown={(ev) => {
                ev.preventDefault();
                const inp = document.getElementById(
                  "date-in"
                ) as HTMLInputElement | null;
                if (inp) {
                  // Prefer showPicker() when available (Chromium), fallback to click()
                  // @ts-ignore
                  if (typeof inp.showPicker === "function") inp.showPicker();
                  else inp.click();
                }
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  (
                    document.getElementById(
                      "date-in"
                    ) as HTMLInputElement | null
                  )?.click();
                }
              }}
            >
              <div className="date-large">{checkInDisplay.day}</div>
              <div className="date-meta">
                <span className="date-month">THÁNG {checkInDisplay.month}</span>
                <span className="date-weekday">
                  TH {checkInDisplay.weekday}
                </span>
              </div>
              <input
                type="date"
                id="date-in"
                value={checkIn}
                onChange={(ev) => setCheckIn(ev.target.value)}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  pointerEvents: "auto",
                  zIndex: 2,
                  border: 0,
                }}
              />
            </div>

            <div
              className="date-box"
              style={{ position: "relative" }}
              tabIndex={0}
              onPointerDown={(ev) => {
                ev.preventDefault();
                const inp = document.getElementById(
                  "date-out"
                ) as HTMLInputElement | null;
                if (inp) {
                  // Prefer showPicker() when available
                  // @ts-ignore
                  if (typeof inp.showPicker === "function") inp.showPicker();
                  else inp.click();
                }
              }}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  (
                    document.getElementById(
                      "date-out"
                    ) as HTMLInputElement | null
                  )?.click();
                }
              }}
            >
              <div className="date-large">{checkOutDisplay.day}</div>
              <div className="date-meta">
                <span className="date-month">
                  THÁNG {checkOutDisplay.month}
                </span>
                <span className="date-weekday">
                  TH {checkOutDisplay.weekday}
                </span>
              </div>
              <input
                type="date"
                id="date-out"
                value={checkOut}
                onChange={(ev) => setCheckOut(ev.target.value)}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  pointerEvents: "auto",
                  zIndex: 2,
                  border: 0,
                }}
              />
            </div>

            {/* Outlined button style for guests/rooms */}
            <button
              type="button"
              className="outlined-btn"
              onClick={() => document.getElementById("room")?.focus()}
            >
              {rooms} phòng
              <select
                id="room"
                value={rooms}
                onChange={(ev) => setRooms(Number(ev.target.value))}
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "auto",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <option value={1}>1 Room</option>
                <option value={2}>2 Rooms</option>
              </select>
            </button>

            <button
              type="button"
              className="outlined-btn"
              onClick={() => document.getElementById("guest")?.focus()}
            >
              {guests} người
              <select
                id="guest"
                value={guests}
                onChange={(ev) => setGuests(Number(ev.target.value))}
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "auto",
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <option value={1}>1 người</option>
                <option value={2}>2 người</option>
                <option value={3}>3 người</option>
                <option value={4}>4 người</option>
              </select>
            </button>

            <button type="submit" className="cta-btn">
              {loading ? "Đang kiểm tra..." : "Kiểm tra phòng & mức giá"}
            </button>
          </>
        ) : (
          <>
            {/* Original compact layout for non-fullWidth mode */}
            <div className="check-date" style={fieldStyle}>
              <label htmlFor="date-in-compact">Check In:</label>
              <input
                type="date"
                id="date-in-compact"
                value={checkIn}
                onChange={(ev) => setCheckIn(ev.target.value)}
                style={inputStyle}
              />
            </div>
            <div className="check-date" style={fieldStyle}>
              <label htmlFor="date-out-compact">Check Out:</label>
              <input
                type="date"
                id="date-out-compact"
                value={checkOut}
                onChange={(ev) => setCheckOut(ev.target.value)}
                style={inputStyle}
              />
            </div>
            <div className="select-option" style={fieldStyle}>
              <label htmlFor="guest-compact">Guests:</label>
              <select
                id="guest-compact"
                value={guests}
                onChange={(ev) => setGuests(Number(ev.target.value))}
                style={inputStyle}
              >
                <option value={1}>1 Adult</option>
                <option value={2}>2 Adults</option>
                <option value={3}>3 Adults</option>
                <option value={4}>4 Adults</option>
              </select>
            </div>
            <div className="select-option" style={fieldStyle}>
              <label htmlFor="room-compact">Room:</label>
              <select
                id="room-compact"
                value={rooms}
                onChange={(ev) => setRooms(Number(ev.target.value))}
                style={inputStyle}
              >
                <option value={1}>1 Room</option>
                <option value={2}>2 Rooms</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <button type="submit" style={{ padding: "6px 12px" }}>
                {loading ? "Đang kiểm tra..." : "Kiểm tra"}
              </button>
            </div>
          </>
        )}
      </form>

      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "90%",
              maxWidth: 1000,
              maxHeight: "90vh",
              overflow: "auto",
              background: "#fff",
              borderRadius: 8,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <h3 style={{ margin: 0 }}>Kết quả tìm phòng</h3>
              <div>
                <button
                  onClick={() => {
                    setModalOpen(false);
                    setMessage(null);
                    setResults([]);
                  }}
                  style={{ padding: "6px 12px" }}
                >
                  Đóng
                </button>
              </div>
            </div>

            {message && !results.length && (
              <div
                style={{ padding: 12, background: "#fff3cd", borderRadius: 4 }}
              >
                {message}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 16,
                marginTop: 12,
              }}
            >
              {results.map((r, idx) => {
                // Use normalized idphong as key, fallback to room number or index
                const id = r.idphong ?? r.soPhong ?? String(idx);
                const key =
                  id && String(id) !== "" ? String(id) : `result-${idx}`;
                return (
                  <RoomCard
                    key={key}
                    room={r}
                    onOpenDetail={() => {}}
                    onBook={() =>
                      alert(
                        "Tiến hành đặt phòng: " +
                          (r.tenPhong ?? r.soPhong ?? key)
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingForm;
