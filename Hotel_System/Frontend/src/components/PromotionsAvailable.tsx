import React, { useEffect, useState } from 'react';
import { Card, List, Empty, Spin } from 'antd';
import { getAllPromotions, Promotion } from '../api/promotionApi';

interface Props {
  roomIds?: string[];
  title?: string;
  compact?: boolean;
  checkIn?: string | null;
  checkOut?: string | null;
}

const PromotionsAvailable: React.FC<Props> = ({ roomIds = [], title = 'Khuyến mãi', compact = false, checkIn, checkOut }) => {
  const [loading, setLoading] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const all = await getAllPromotions('active');
        const now = new Date();
        const bookingStart = checkIn ? new Date(checkIn) : null;
        const bookingEnd = checkOut ? new Date(checkOut) : null;
        let newPromos: Promotion[] = [];
        if (roomIds.length > 0) {
          // filter promotions that apply to at least one of the roomIds and are within date range
          newPromos = all.filter(p => {
            try {
              const starts = p.ngayBatDau ? new Date(p.ngayBatDau) : null;
              const ends = p.ngayKetThuc ? new Date(p.ngayKetThuc) : null;
              // If booking dates provided, require overlap between promo period and booking period
              if (bookingStart && bookingEnd) {
                if (starts && bookingEnd && starts > bookingEnd) return false; // promo starts after booking ends
                if (ends && bookingStart && ends < bookingStart) return false; // promo ends before booking starts
              } else {
                // fallback to current-time validity
                const validDate = (!starts || starts <= now) && (!ends || ends >= now);
                if (!validDate) return false;
              }
              const appliesRoom = (p.khuyenMaiPhongs || []).some(kp => roomIds.includes(kp.idphong));
              return appliesRoom;
            } catch (e) {
              return false;
            }
          });
        } else {
          // if no room filter, return only promotions that are valid by date
          newPromos = all.filter(p => {
            try {
              const starts = p.ngayBatDau ? new Date(p.ngayBatDau) : null;
              const ends = p.ngayKetThuc ? new Date(p.ngayKetThuc) : null;
              if (bookingStart && bookingEnd) {
                if (starts && bookingEnd && starts > bookingEnd) return false;
                if (ends && bookingStart && ends < bookingStart) return false;
                return true;
              }
              return (!starts || starts <= now) && (!ends || ends >= now);
            } catch (e) {
              return false;
            }
          });
        }

        // Only update state if the result actually changed to avoid triggering re-renders
        const same = JSON.stringify(newPromos) === JSON.stringify(promotions);
        if (!same) setPromotions(newPromos);
      } catch (e) {
        if (promotions.length !== 0) setPromotions([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  // include promotions in deps because we compare against it before setting state
  }, [roomIds, promotions, checkIn, checkOut]);

  if (loading) return <Spin />;
  if (!promotions || promotions.length === 0) return <Empty description="Không có khuyến mãi" />;

  return (
    <Card size={compact ? 'small' : 'default'} title={title} bordered={false}>
      <List
        dataSource={promotions}
        renderItem={(p) => (
          <List.Item>
            <List.Item.Meta
              title={<span style={{ fontWeight: 600 }}>{p.tenKhuyenMai}</span>}
              description={<span style={{ fontSize: 12 }}>{p.moTa ?? p.loaiGiamGia + ' ' + (p.giaTriGiam ?? '')}</span>}
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

export default PromotionsAvailable;
