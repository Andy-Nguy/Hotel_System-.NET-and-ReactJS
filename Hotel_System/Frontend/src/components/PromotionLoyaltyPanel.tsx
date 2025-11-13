import React, { useEffect, useState, useCallback } from "react";
import { Card, Typography, Input, Button, Space, Tag, message, List, Divider, Tooltip, Skeleton, Modal, Popconfirm } from "antd";
import { GiftOutlined, ThunderboltOutlined, PercentageOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  getAllPromotions,
  applyPromotion,
  autoApplyBestPromotion,
  getLoyaltyPoints,
  exchangePoints,
  type PromotionResponse,
  type ApplyPromotionResponse,
  type LoyaltyPointsResponse,
} from "../api/promotionApi";

const { Text } = Typography;

interface Props {
  invoiceId: number;
  roomIds: (string | number)[];
  baseAmount: number; // tổng tiền phòng gốc (chưa thuế) để tính %
  customerId?: number;
  onApplied: (res: ApplyPromotionResponse | null) => void;
}

// Component quản lý khuyến mãi & tích điểm trên trang thanh toán
const PromotionLoyaltyPanel: React.FC<Props> = ({ invoiceId, roomIds, baseAmount, customerId, onApplied }) => {
  const [loadingPromos, setLoadingPromos] = useState(false);
  const [promos, setPromos] = useState<PromotionResponse[]>([]);
  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [autoApplying, setAutoApplying] = useState(false);
  const [applied, setApplied] = useState<ApplyPromotionResponse | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyPointsResponse | null>(null);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [exchanging, setExchanging] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    setLoadingPromos(true);
    try {
      const data = await getAllPromotions(roomIds.map(String));
      setPromos(data);
    } catch (e: any) {
      message.error(e.message || "Lỗi tải khuyến mãi");
    } finally {
      setLoadingPromos(false);
    }
  }, [roomIds]);

  const loadLoyalty = useCallback(async () => {
    if (!customerId) return;
    setLoadingLoyalty(true);
    try {
      const data = await getLoyaltyPoints(customerId);
      if (data) setLoyalty(data);
    } catch (e) {
      // ignore
    } finally {
      setLoadingLoyalty(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  useEffect(() => {
    loadLoyalty();
  }, [loadLoyalty]);

  const handleApply = async () => {
    if (!code.trim()) return;
    setApplying(true);
    try {
      const res = await applyPromotion({ maKhuyenMai: code.trim(), idHoaDon: invoiceId, danhSachPhong: roomIds.map(String) });
      if (!res.success) throw new Error(res.message || "Áp dụng thất bại");
      setApplied(res);
      onApplied(res);
      message.success(`Đã áp dụng mã. Giảm ${res.soTienGiam.toLocaleString()}đ`);
    } catch (e: any) {
      message.error(e.message || "Không thể áp dụng mã");
    } finally {
      setApplying(false);
    }
  };

  const handleAutoApply = async () => {
    setAutoApplying(true);
    try {
      const res = await autoApplyBestPromotion(invoiceId, roomIds.map(String), baseAmount);
      if (res && res.success) {
        setApplied(res);
        onApplied(res);
        setCode(res.maKhuyenMaiApDung || "");
        message.success(`Tự động áp dụng: -${res.soTienGiam.toLocaleString()}đ`);
      } else {
        message.info("Không có khuyến mãi phù hợp");
      }
    } catch (e: any) {
      message.error(e.message || "Auto apply thất bại");
    } finally {
      setAutoApplying(false);
    }
  };

  const handleExchangeVoucher = async (voucherCode: string, requiredPoints: number) => {
    if (!customerId) return message.info("Cần đăng nhập");
    Modal.confirm({
      title: `Đổi ${requiredPoints} điểm lấy voucher?`,
      okText: "Đổi điểm",
      cancelText: "Hủy",
      onOk: async () => {
        setExchanging(voucherCode);
        try {
          const res = await exchangePoints({ idKhachHang: customerId, soDiemDoi: requiredPoints, loaiVoucher: voucherCode });
          if (res.success) {
            message.success(`Nhận voucher ${res.maVoucher}`);
            // thử áp dụng voucher ngay
            try {
              const appliedRes = await applyPromotion({ maKhuyenMai: res.maVoucher, idHoaDon: invoiceId, danhSachPhong: roomIds.map(String) });
              if (appliedRes.success) {
                setApplied(appliedRes);
                onApplied(appliedRes);
                setCode(appliedRes.maKhuyenMaiApDung || res.maVoucher);
              }
            } catch {/* ignore */}
            loadLoyalty();
          } else message.error(res.message || "Đổi điểm thất bại");
        } catch (e: any) {
          message.error(e.message || "Đổi điểm lỗi");
        } finally {
          setExchanging(null);
        }
      }
    });
  };

  return (
    <Card title={<Space><GiftOutlined /> <span>Khuyến mãi & Tích điểm</span></Space>} size="small" style={{ marginBottom: 24 }} extra={<Button type="link" size="small" onClick={loadPromos} icon={<ReloadOutlined />}>Làm mới</Button>}>
      {/* Apply code */}
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Input placeholder="Nhập mã khuyến mãi" value={code} onChange={e => setCode(e.target.value)} disabled={applying} onPressEnter={handleApply} />
        <Button type="primary" onClick={handleApply} loading={applying}>Áp dụng</Button>
      </Space.Compact>
      <Button block icon={<ThunderboltOutlined />} onClick={handleAutoApply} loading={autoApplying} style={{ marginBottom: 12 }}>Tự động chọn mã tốt nhất</Button>

      {applied && (
        <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffd591', marginBottom: 16 }}>
          <Text strong>Mã đã áp dụng: {applied.maKhuyenMaiApDung || code}</Text><br />
          <Text>Giảm: <span style={{ color: '#d48806' }}>-{applied.soTienGiam.toLocaleString()}đ</span></Text><br />
          <Text>Tổng sau giảm: <span style={{ color: '#cf1322', fontWeight: 600 }}>{applied.tongTienSauGiam.toLocaleString()}đ</span></Text>
        </Card>
      )}

      <Divider style={{ margin: '12px 0' }} />
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Khuyến mãi khả dụng</Text>
      <div style={{ maxHeight: 180, overflow: 'auto', marginBottom: 8 }}>
        {loadingPromos ? <Skeleton active paragraph={{ rows: 3 }} /> : (
          <List
            size="small"
            dataSource={promos}
            locale={{ emptyText: 'Không có khuyến mãi' }}
            renderItem={p => (
              <List.Item style={{ alignItems: 'flex-start' }}>
                <Space direction="vertical" style={{ width: '100%' }} size={2}>
                  <Space wrap>
                    <Tag color={p.loaiGiamGia === 'percent' ? 'volcano' : 'green'}>
                      {p.loaiGiamGia === 'percent' ? <><PercentageOutlined /> {p.giaTriGiam}%</> : `-${p.giaTriGiam.toLocaleString()}đ`}
                    </Tag>
                    {p.isApplicable ? <Tag color="blue">Áp dụng</Tag> : <Tag>Mặc định</Tag>}
                    <Tag>{p.idKhuyenMai}</Tag>
                  </Space>
                  <Text style={{ fontWeight: 500 }}>{p.tenKhuyenMai}</Text>
                  {p.moTa && <Text type="secondary" style={{ fontSize: 11 }}>{p.moTa}</Text>}
                  {p.isApplicable && (
                    <Button size="small" type="link" style={{ padding: 0 }} onClick={() => { setCode(p.idKhuyenMai); handleApply(); }}>Dùng mã này</Button>
                  )}
                </Space>
              </List.Item>
            )}
          />
        )}
      </div>

      {customerId && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Space style={{ marginBottom: 8 }} direction="vertical">
            <Text strong>Điểm của bạn</Text>
            {loadingLoyalty ? <Skeleton active title={false} paragraph={{ rows: 1 }} /> : (
              <Text>Hiện tại: <span style={{ color: '#1890ff', fontWeight: 600 }}>{loyalty?.diemHienTai ?? 0}</span> điểm</Text>
            )}
          </Space>
          <div style={{ maxHeight: 140, overflow: 'auto' }}>
            {loyalty?.voucherKhaDung?.map(v => (
              <Card key={v.tenVoucher} size="small" style={{ marginBottom: 8 }}>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="purple">{v.tenVoucher}</Tag>
                    <Tag>{v.loaiGiamGia === 'percent' ? `${v.giaTriVoucher}%` : `-${v.giaTriVoucher.toLocaleString()}đ`}</Tag>
                    <Tag color="gold">{v.diemCanThiet}điểm</Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 11 }}>{v.moTa}</Text>
                  <Button size="small" type="primary" disabled={(loyalty?.diemHienTai || 0) < v.diemCanThiet} loading={exchanging === v.tenVoucher} onClick={() => handleExchangeVoucher(v.tenVoucher, v.diemCanThiet)}>Đổi & Áp dụng</Button>
                </Space>
              </Card>
            )) || <Text type="secondary">Không có gói đổi điểm</Text>}
          </div>
        </>
      )}
    </Card>
  );
};

export default PromotionLoyaltyPanel;
