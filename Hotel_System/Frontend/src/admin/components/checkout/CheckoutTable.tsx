import React, { useEffect, useState } from "react";
import { Button, Space, Tag, Segmented } from "antd";
import type { ColumnsType } from "antd/es/table";
import DataTable from "../DataTable";

export interface BookingRow {
  IddatPhong: string;
  TenKhachHang?: string;
  EmailKhachHang?: string;
  NgayNhanPhong?: string;
  NgayTraPhong?: string;
  TongTien: number;
  TrangThai: number;
  TrangThaiThanhToan: number;
}

interface Props {
  data: BookingRow[];
  loading: boolean;
  onPay: (row: BookingRow) => void;
  onComplete: (row: BookingRow) => void;
  onPayOverdue?: (row: BookingRow) => void;
  // When in checkout view, parent can request the payment form to open (same as 'using' view)
  onOpenPaymentForm?: (row: BookingRow) => void;
  onAddService?: (row: BookingRow) => void;
  onViewInvoice?: (row: BookingRow) => void;
  onExtend?: (row: BookingRow) => void; // Gia hạn phòng quá hạn
  viewInvoiceIds?: string[];
  viewMode?: "using" | "checkout" | "overdue";
  onViewChange?: (mode: "using" | "checkout" | "overdue") => void;
}

const CheckoutTable: React.FC<Props> = ({
  data,
  loading,
  onPay,
  onComplete,
  onPayOverdue,
  onOpenPaymentForm,
  onAddService,
  onViewInvoice,
  onExtend,
  viewInvoiceIds,
  viewMode = "using",
  onViewChange,
}) => {
  // track disabled state per booking id to prevent repeated clicks
  const [disabledMap, setDisabledMap] = React.useState<Record<string, boolean>>({});
  // track when overdue fee has been paid for a booking (local UX state)
  const [overduePaidMap, setOverduePaidMap] = React.useState<Record<string, boolean>>({});
  const [detailsMap, setDetailsMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const idsToFetch = (data || [])
        .filter(d => {
          const hasDetails = Array.isArray((d as any)?.ChiTietDatPhongs) && (d as any).ChiTietDatPhongs.length > 0;
          return !hasDetails && d?.IddatPhong && !detailsMap[d.IddatPhong];
        })
        .map(d => d.IddatPhong);

      for (const id of idsToFetch) {
        try {
          const res = await fetch(`/api/DatPhong/${id}`);
          if (!mounted) return;
          if (!res.ok) continue;
          const json = await res.json();
          const detailLines = json?.ChiTietDatPhongs ?? json?.chiTietDatPhongs ?? null;
          if (Array.isArray(detailLines) && detailLines.length > 0) {
            setDetailsMap(prev => ({ ...prev, [id]: detailLines }));
          }
        } catch (e) {
          console.warn('[CheckoutTable] fetch detail failed', id, e);
        }
      }
    })();
    return () => { mounted = false; };
  }, [data, detailsMap]);

  const columns: ColumnsType<BookingRow> = [
    { title: 'Mã đặt phòng', dataIndex: 'IddatPhong', key: 'IddatPhong', width: 160 },
    { title: 'Khách hàng', key: 'customer', render: (_, r) => (<div>{r.TenKhachHang}<div style={{fontSize:12,color:'#64748b'}}>{r.EmailKhachHang}</div></div>) },
    {
      title: 'Phòng',
      key: 'rooms',
      render: (_: any, r: BookingRow) => {
        // Ưu tiên lấy từ detailsMap (đã fetch chi tiết), fallback dữ liệu có sẵn trong row
        const details: any[] =
          (detailsMap && (detailsMap as any)[r.IddatPhong]) ??
          (r as any)?.ChiTietDatPhongs ??
          (r as any)?.chiTietDatPhongs ??
          [];

        // Hàm trợ giúp: lấy TenPhong/SoPhong/IDPhong từ nhiều shape khác nhau
        const extractRoomInfo = (it: any) => {
          // Try several possible fields for a human-friendly room name / room-type name
          const ten =
            it?.TenPhong ??
            it?.tenPhong ??
            it?.Phong?.TenPhong ??
            it?.Phong?.tenPhong ??
            it?.TenLoaiPhong ??
            it?.tenLoaiPhong ??
            it?.LoaiPhong?.TenLoaiPhong ??
            it?.LoaiPhong?.tenLoaiPhong ??
            it?.LoaiPhong?.TenLoai ??
            it?.LoaiPhong?.tenLoai ??
            it?.Phong?.LoaiPhong?.TenLoaiPhong ??
            it?.Phong?.LoaiPhong?.TenLoai ??
            null;

          // ID phòng fallback nếu thiếu SoPhong
          const idPhong =
            it?.IDPhong ??
            it?.IdPhong ??
            it?.idPhong ??
            it?.Phong?.Idphong ??
            it?.Phong?.IDPhong ??
            null;

          const so =
            it?.SoPhong ??
            it?.soPhong ??
            it?.Phong?.SoPhong ??
            it?.Phong?.soPhong ??
            it?.Phong?.SoPhongNumber ??
            it?.Phong?.roomNumber ??
            null;

          return { ten, so, idPhong };
        };

        if (Array.isArray(details) && details.length > 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {details.map((it, idx) => {
                const { ten, so, idPhong } = extractRoomInfo(it);
                const primary = ten ?? (so ? `Phòng ${so}` : (idPhong ? String(idPhong) : '-'));
                const secondary = so
                  ? `Phòng ${so}`
                  : (idPhong && (!ten || String(idPhong) !== String(ten)) ? String(idPhong) : null);

                return (
                  <div key={idx}>
                    <div style={{ fontWeight: 600 }}>{primary}</div>
                    {secondary && <div style={{ fontSize: 12, color: '#64748b' }}>{secondary}</div>}
                  </div>
                );
              })}
            </div>
          );
        }

        // Fallback: hiển thị tên/phòng từ cột tổng hợp nếu chưa có chi tiết
        const ten = (r as any)?.TenPhong ?? (r as any)?.tenPhong ?? null;
        const so = (r as any)?.SoPhong ?? (r as any)?.soPhong ?? null;
        if (ten || so) {
          return (
            <div>
              <div style={{ fontWeight: 600 }}>{ten ?? (so ? `Phòng ${so}` : '-')}</div>
              {so && <div style={{ fontSize: 12, color: '#64748b' }}>{`Phòng ${so}`}</div>}
            </div>
          );
        }

        // Nếu chưa có dữ liệu chi tiết và cũng không có tổng hợp → chờ fetch
        return <div style={{ color: '#94a3b8' }}>Đang tải...</div>;
      }
    },
    { title: 'Nhận', dataIndex: 'NgayNhanPhong', key: 'NgayNhanPhong', width: 120 },
    { title: 'Trả', dataIndex: 'NgayTraPhong', key: 'NgayTraPhong', width: 120 },
    { title: 'Tổng tiền', dataIndex: 'TongTien', key: 'TongTien', align: 'right', render: (v) => Number(v).toLocaleString() + ' đ' },
    { title: 'Trạng thái TT', dataIndex: 'TrangThaiThanhToan', key: 'tt', render: (s) => <Tag color={s===2?'green':'orange'}>{s===2? 'Đã thanh toán' : 'Chưa thanh toán'}</Tag> },
    {
      title: 'Tình trạng',
      key: 'status',
      render: (_, r) => {
        const st = r.TrangThai ?? 0;
        if (st === 5) return <Tag color="red">Quá hạn</Tag>;
        if (st === 3) return <Tag color="blue">Đang sử dụng</Tag>;
        if (st === 4) return <Tag color="default">Đã hoàn tất</Tag>;
        return <Tag>{String(st)}</Tag>;
      }
    },
    {
      title: "Hành động",
      key: "actions",
      fixed: "right",
      render: (_, r) => {
        const isPaid = (r.TrangThaiThanhToan ?? 0) === 2;
        const isCompleted = (r.TrangThai ?? 0) === 4;

        // For checkout view show normal actions. For overdue view show ONLY the
        // 'Thanh toán phí quá hạn' button per product owner request.
        if (viewMode === 'overdue') {
          return (
            <Space>
              <Button
                type="default"
                style={{ background: '#fb923c', borderColor: '#fb923c', color: '#fff' }}
                disabled={!!disabledMap[r.IddatPhong]}
                onClick={async () => {
                  setDisabledMap(prev => ({ ...prev, [r.IddatPhong]: true }));
                  try {
                    const opener = typeof onOpenPaymentForm === 'function' ? onOpenPaymentForm :
                                   (typeof onPayOverdue === 'function' ? onPayOverdue : (typeof onPay === 'function' ? onPay : undefined));
                    if (!opener) return;
                    const res: any = opener(r);
                    if (res && typeof res.then === 'function') {
                      const ok = await res;
                      if (ok) setOverduePaidMap(prev => ({ ...prev, [r.IddatPhong]: true }));
                    }
                  } finally {
                    setTimeout(() => setDisabledMap(prev => ({ ...prev, [r.IddatPhong]: false })), 5000);
                  }
                }}
              >
                Thanh toán phí quá hạn
              </Button>
            </Space>
          );
        }

        if (viewMode === 'checkout') {
          return (
            <Space>
              {isCompleted ? (
                <Button disabled>Đã hoàn tất</Button>
              ) : (
                <>
                  {/* Show 'Xác nhận trả phòng' only when booking is already paid */}
                  {isPaid && (
                    <Button
                      type="primary"
                      style={{ background: '#22c55e', borderColor: '#22c55e' }}
                      disabled={!!disabledMap[r.IddatPhong]}
                      onClick={() => {
                        setDisabledMap(prev => ({ ...prev, [r.IddatPhong]: true }));
                        setTimeout(() => setDisabledMap(prev => ({ ...prev, [r.IddatPhong]: false })), 5000);
                        (onViewInvoice ? onViewInvoice(r) : onComplete(r));
                      }}
                    >
                      Xác nhận trả phòng
                    </Button>
                  )}

                  {/* Show 'Xác nhận thanh toán' only when booking is NOT paid */}
                  {!isPaid && (
                    <Button
                      type="primary"
                      danger={false}
                      disabled={!!disabledMap[r.IddatPhong]}
                      onClick={() => {
                        setDisabledMap(prev => ({ ...prev, [r.IddatPhong]: true }));
                        setTimeout(() => setDisabledMap(prev => ({ ...prev, [r.IddatPhong]: false })), 5000);
                        (typeof (onOpenPaymentForm) === 'function' ? onOpenPaymentForm!(r) : onPay?.(r));
                      }}
                    >
                      Xác nhận thanh toán
                    </Button>
                  )}

                  {/* Nút Gia hạn - cho phép khách ở thêm */}
                  {onExtend && (
                    <Button
                      type="default"
                      style={{ background: '#3b82f6', borderColor: '#3b82f6', color: '#fff' }}
                      onClick={() => onExtend(r)}
                    >
                      Gia hạn
                    </Button>
                  )}
                </>
              )}
            </Space>
          );
        }
      },
    },
  ];

  return (
    <div>
      {/* Khung chọn chế độ hiển thị riêng trong bảng */}
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={viewMode}
          onChange={(v) => onViewChange?.(v as "using" | "checkout" | "overdue")}
          options={[
            { label: "Trả phòng hôm nay", value: "checkout" },
            { label: "Quá hạn", value: "overdue" }
          ]}
        />
      </div>

      <DataTable
        rowKey="IddatPhong"
        dataSource={data}
        columns={columns}
        loading={loading}
      />
    </div>
  );
};

export default CheckoutTable;