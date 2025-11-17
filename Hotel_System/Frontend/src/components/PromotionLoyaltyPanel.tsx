import React, { useEffect, useState } from "react";
import { Card, Button, Space, Typography, Alert } from "antd";
import {
  getAllPromotions,
  Promotion,
  ApplyPromotionResponse,
} from "../api/promotionApi";

const { Text } = Typography;

interface Props {
  invoiceId?: number | null;
  roomIds: string[];
  baseAmount: number; // base total before tax and discount
  // full selectedRooms info so component can compute per-room eligible totals
  selectedRooms?: any[];
  nights?: number;
  customerId?: number | null;
  onApplied: (res: ApplyPromotionResponse | null) => void;
  // booking range to validate promotions against (prefer booking dates over current date)
  checkIn?: string | null;
  checkOut?: string | null;
  // If true, don't auto-calculate best promotion from available list.
  disableAutoApply?: boolean;
  // External applied result to display when auto apply is disabled.
  externalApplied?: ApplyPromotionResponse | null;
}

const PromotionLoyaltyPanel: React.FC<Props> = ({
  invoiceId,
  roomIds,
  baseAmount,
  selectedRooms = [],
  nights = 1,
  customerId,
  onApplied,
  disableAutoApply,
  externalApplied,
  checkIn,
  checkOut,
}) => {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<Promotion[]>([]);
  const [applied, setApplied] = useState<ApplyPromotionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const promos = await getAllPromotions("active");
        setAvailable(promos || []);
      } catch (e: any) {
        setError(e?.message || "Không thể tải khuyến mãi");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (disableAutoApply) {
      // when externalApplied changes, reflect it
      setApplied(externalApplied || null);
      onApplied(externalApplied || null);
      return;
    }

    // auto-apply best promotion for the given roomIds and baseAmount
    if (!available || available.length === 0) {
      onApplied(null);
      return;
    }

    let best: ApplyPromotionResponse | null = null;

    for (const p of available) {
      // skip promotions that do not overlap the booking range (or are inactive)
      try {
        const starts = p.ngayBatDau ? new Date(p.ngayBatDau) : null;
        const ends = p.ngayKetThuc ? new Date(p.ngayKetThuc) : null;
        const bookingStart = checkIn ? new Date(checkIn) : null;
        const bookingEnd = checkOut ? new Date(checkOut) : null;
        // If booking dates provided, require overlap between promo period and booking period.
        if (bookingStart && bookingEnd) {
          // promo range [starts, ends] overlaps booking range [bookingStart, bookingEnd]
          if (starts && bookingEnd && starts > bookingEnd) continue; // promo starts after booking ends
          if (ends && bookingStart && ends < bookingStart) continue; // promo ends before booking starts
        } else {
          // fallback to current-time validity when booking dates are not provided
          const now = new Date();
          if ((starts && starts > now) || (ends && ends < now)) continue;
        }
        if (p.trangThai && p.trangThai !== "active") continue;
      } catch (e) {
        // if parsing dates fails, skip this promotion
        continue;
      }
      // check if promo applies to any of the rooms
      const rooms = p.khuyenMaiPhongs?.map((r) => r.idphong) || [];
      const intersects = roomIds.some((rid) => rooms.includes(rid));
      if (!intersects) continue;

      // compute eligible total only for rooms covered by this promotion
      const promoRoomIds = (p.khuyenMaiPhongs || []).map((r: any) => r.idphong);
      const eligibleTotal = (selectedRooms || []).reduce(
        (sum: number, sr: any) => {
          const rid =
            sr.room?.idphong || sr.room?.idPhong || sr.room?.id || sr.roomId;
          if (!rid) return sum;
          if (promoRoomIds.includes(rid)) {
            const price = sr.room?.giaCoBanMotDem || sr.room?.gia || 0;
            return sum + price * (nights || 1);
          }
          return sum;
        },
        0
      );

      let discount = 0;
      if (p.loaiGiamGia === "percent") {
        discount = ((p.giaTriGiam || 0) / 100) * eligibleTotal;
      } else {
        // fixed amount: don't exceed eligibleTotal
        discount = Math.min(p.giaTriGiam || 0, eligibleTotal);
      }

      const totalAfter = Math.max(0, baseAmount - discount);
      // estimate points (rule: Diem += TongTien / 100000)
      const points = Math.floor(totalAfter / 100000);

      if (!best || discount > best.discountAmount) {
        best = {
          tongTienSauGiam: Math.round(totalAfter),
          discountAmount: Math.round(discount),
          appliedPromotionId: p.idkhuyenMai,
          appliedPromotionName: p.tenKhuyenMai,
          pointsEstimated: points,
        };
      }
    }

    // Only update state / notify parent when the best result actually changed
    const same = JSON.stringify(best) === JSON.stringify(applied);
    if (!same) {
      setApplied(best);
      onApplied(best);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    available,
    roomIds,
    baseAmount,
    selectedRooms,
    nights,
    disableAutoApply,
    externalApplied,
    applied,
    onApplied,
    checkIn,
    checkOut,
  ]);

  return (
    <Card
      title="Khuyến mãi & Tích điểm"
      size="small"
      style={{ marginBottom: 12 }}
    >
      {error && <Alert type="error" message={error} />}

      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">Tổng trước giảm:</Text>
        <div style={{ fontWeight: 700 }}>{baseAmount.toLocaleString()} đ</div>
      </div>

      {applied ? (
        <div style={{ marginBottom: 12 }}>
          <div>
            <Text type="secondary">Khuyến mãi áp dụng:</Text>
            <div style={{ fontWeight: 700 }}>
              {applied.appliedPromotionName} - Giảm{" "}
              {(
                applied.discountAmount ??
                applied.soTienGiam ??
                0
              ).toLocaleString()}{" "}
              đ
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">Tổng sau giảm (chưa thuế):</Text>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {(applied.tongTienSauGiam ?? 0).toLocaleString()} đ
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">Dự kiến tích điểm:</Text>
            <div>{applied.pointsEstimated} điểm</div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">
            Không tìm thấy khuyến mãi áp dụng cho các phòng đã chọn
          </Text>
        </div>
      )}

      {/* Buttons to apply/skip promotions removed per request */}
    </Card>
  );
};

export default PromotionLoyaltyPanel;
