import React, { useEffect, useState } from "react";
import checkinApi, { UsingBooking } from "../../../api/checkinApi";

const CheckinSection_NEW: React.FC = () => {
  const [bookings, setBookings] = useState<UsingBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

    const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkinApi.getTodayBookings();
      setBookings(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
      void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = async (id: string) => {
    if (!confirm("Xác nhận nhận khách?")) return;
    try {
      await checkinApi.confirmCheckIn(id);
      await load();
    } catch (err: any) {
      alert(err?.message || "Xác nhận thất bại");
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Xác nhận huỷ / no-show?")) return;
    try {
      await checkinApi.cancelCheckIn(id);
      await load();
    } catch (err: any) {
      alert(err?.message || "Huỷ thất bại");
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>Check-in hôm nay</h3>
      {loading && <div>Đang tải...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}
      {!loading && bookings.length === 0 && <div>Không có check-in hôm nay.</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {bookings.map((b) => (
          <div
            key={b.iddatPhong}
            style={{
              padding: 12,
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{b.tenKhachHang ?? "Khách"}</div>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                Phòng: {b.soPhong ?? b.idphong ?? "-"} • {b.ngayNhanPhong ?? "-"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => handleConfirm(b.iddatPhong)}>
                Xác nhận
              </button>
              <button onClick={() => handleCancel(b.iddatPhong)}>Huỷ</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

  export default CheckinSection_NEW