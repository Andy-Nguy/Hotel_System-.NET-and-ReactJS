import React, { useEffect, useState } from "react";
import checkinApi from '../../../api/checkinApi';
import FormService from './FormService';
import checkoutApi from '../../../api/checkout.Api';
import * as serviceApi from '../../../api/serviceApi';
import { Button, Space, Tag, Segmented, Card, Form, message } from "antd";
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
  summaryMap?: Record<string, any>;
}

interface Props {
  data: BookingRow[];
  loading: boolean;
  onPay: (row: BookingRow) => void;
  onComplete: (row: BookingRow) => void;
  onOpenPaymentForm?: (row: BookingRow) => void;
  onAddService?: (row: BookingRow) => void;
  onViewInvoice?: (row: BookingRow) => void;
  viewInvoiceIds?: string[];
  viewMode?: "using" | "checkin";
  onViewChange?: (mode: "using" | "checkin") => void;
  summaryMap?: Record<string, any>;
}

const CheckinTable: React.FC<Props> = ({
  data,
  loading,
  onPay,
  onComplete,
  onOpenPaymentForm,
  onAddService,
  onViewInvoice,
  viewInvoiceIds,
  viewMode = "using",
  onViewChange,
  summaryMap = {},
}) => {
  const [detailsMap, setDetailsMap] = useState<Record<string, any[]>>({});

  // Fetch chi tiết đặt phòng cho các dòng chưa có
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const idsToFetch = (data || [])
          .filter((d) => {
            const hasDetails =
              Array.isArray((d as any)?.ChiTietDatPhongs) &&
              (d as any).ChiTietDatPhongs.length > 0;
            return !hasDetails && d?.IddatPhong && !detailsMap[d.IddatPhong];
          })
          .map((d) => d.IddatPhong);

        for (const id of idsToFetch) {
          try {
            const json = await checkinApi.getBookingById(id);
            if (!mounted) return;
            const detailLines = json?.ChiTietDatPhongs ?? json?.chiTietDatPhongs ?? json?.chiTietDatPhongs ?? null;
            if (Array.isArray(detailLines) && detailLines.length > 0) {
              setDetailsMap((prev) => ({ ...prev, [id]: detailLines }));
            }
          } catch (e) {
            console.warn("[CheckinTable] fetch detail failed", id, e);
          }
        }
      } catch (e) {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [data]);

  // Helper: rút trích thông tin phòng linh hoạt từ một item chi tiết
  const extractRoomInfo = (it: any) => {
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

    const so =
      it?.SoPhong ??
      it?.soPhong ??
      it?.Phong?.SoPhong ??
      it?.Phong?.soPhong ??
      it?.Phong?.SoPhongNumber ??
      it?.Phong?.roomNumber ??
      null;

    const idPhong =
      it?.IDPhong ??
      it?.IdPhong ??
      it?.idPhong ??
      it?.Phong?.Idphong ??
      it?.Phong?.IDPhong ??
      null;

    return { ten, so, idPhong };
  };

  // Helper: hợp nhất nguồn chi tiết (detailsMap -> row -> summaryMap)
  const getRoomLines = (row: BookingRow): any[] => {
    const id = row.IddatPhong;
    // 1) Đã fetch từ API
    const fromCache = detailsMap?.[id];
    if (Array.isArray(fromCache) && fromCache.length > 0) return fromCache;

    // 2) Có sẵn trong row
    const fromRow =
      (row as any)?.ChiTietDatPhongs ?? (row as any)?.chiTietDatPhongs ?? [];
    if (Array.isArray(fromRow) && fromRow.length > 0) return fromRow;

    // 3) Fallback thêm: từ summaryMap (nếu parent truyền)
    const sum = summaryMap?.[id];
    const sumItems = sum?.items ?? [];
    if (Array.isArray(sumItems) && sumItems.length > 0) return sumItems;

    return [];
  };

  const columns: ColumnsType<BookingRow> = [
    {
      title: "Mã đặt phòng",
      dataIndex: "IddatPhong",
      key: "IddatPhong",
      width: 160,
    },
    {
      title: "Khách hàng",
      key: "customer",
      render: (_: any, r: BookingRow) => (
        <div>
          {r.TenKhachHang}
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {r.EmailKhachHang}
          </div>
        </div>
      ),
    },
    {
      title: "Phòng",
      key: "rooms",
      render: (_: any, r: BookingRow) => {
        const details: any[] = getRoomLines(r);

        if (Array.isArray(details) && details.length > 0) {
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {details.map((it, idx) => {
                const { ten, so, idPhong } = extractRoomInfo(it);
                const primary =
                  ten ?? (so ? `Phòng ${so}` : idPhong ? String(idPhong) : "-");
                // Nếu có cả tên và số phòng thì thêm dòng phụ để rõ ràng
                const secondary = so
                  ? `Phòng ${so}`
                  : idPhong && (!ten || String(idPhong) !== String(ten))
                  ? String(idPhong)
                  : null;

                return (
                  <div key={idx}>
                    <div style={{ fontWeight: 600 }}>{primary}</div>
                    {secondary && (
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {secondary}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        // Fallback: single room fields
        const ten = (r as any)?.TenPhong ?? (r as any)?.tenPhong ?? null;
        const so = (r as any)?.SoPhong ?? (r as any)?.soPhong ?? null;
        return (
          <div>
            <div style={{ fontWeight: 600 }}>
              {ten ?? (so ? `Phòng ${so}` : "-")}
            </div>
            {so && (
              <div style={{ fontSize: 12, color: "#64748b" }}>{`Phòng ${so}`}</div>
            )}
          </div>
        );
      },
    },
    {
      title: "Nhận",
      dataIndex: "NgayNhanPhong",
      key: "NgayNhanPhong",
      width: 120,
    },
    {
      title: "Trả",
      dataIndex: "NgayTraPhong",
      key: "NgayTraPhong",
      width: 120,
    },
    {
      title: "Tổng tiền",
      dataIndex: "TongTien",
      key: "TongTien",
      align: "right",
      render: (v: any) => Number(v).toLocaleString() + " đ",
    },
    {
      title: "Trạng thái TT",
      dataIndex: "TrangThaiThanhToan",
      key: "tt",
      render: (s: any) => (
        <Tag color={s === 2 ? "green" : "orange"}>
          {s === 2 ? "Đã thanh toán" : "Chưa thanh toán"}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      fixed: "right",
      render: (_: any, r: BookingRow) => {
        const isPaid = (r.TrangThaiThanhToan ?? 0) === 2;
        const isCompleted = (r.TrangThai ?? 0) === 4;

        return (
          <Space>
            <Button onClick={() => onAddService?.(r)}>Thêm dịch vụ</Button>
            {/* Nếu cần mở form thanh toán trước checkin, bật lại nút dưới */}
            {/* {typeof onViewInvoice === "function" && (
              <Button type="default" onClick={() => onViewInvoice?.(r)}>
                Thanh toán
              </Button>
            )} */}
          </Space>
        );
      },
    },
  ];
  // Helper: format money
  const fmt = (n: any) => (n == null ? "-" : Number(n).toLocaleString() + " đ");

  // Service viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerServices, setViewerServices] = useState<any[]>([]);
  const [viewerBookingId, setViewerBookingId] = useState<string | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerForm] = Form.useForm();

  const openServiceViewer = async (row: BookingRow) => {
    try {
      setViewerLoading(true);
      // Do NOT call parent invoice/payment handler here.
      // Opening the service viewer should not open the payment/invoice form.

      const id = (row as any).IddatPhong ?? (row as any).IdDatPhong ?? row.IddatPhong;
      const summary = await checkoutApi.getSummary(id as any);
      const services = summary?.data?.services ?? summary?.services ?? summary?.DichVu ?? summary?.dichVu ?? [];

      const mapped = Array.isArray(services)
        ? services.map((s: any, idx: number) => {
            const qty = Number(s?.SoLuong ?? s?.SoLuongDichVu ?? s?.Qty ?? 1) || 1;
            // Prefer explicit unit price fields, otherwise derive from TienDichVu / qty
            const unitCandidate = s?.DonGia ?? s?.donGia ?? s?.DonGiaDichVu ?? s?.Gia ?? s?.gia;
            const unit = unitCandidate != null
              ? Number(unitCandidate)
              : (s?.TienDichVu != null ? Math.round(Number(s.TienDichVu) / qty) : 0);
            const amount = s?.TienDichVu ?? s?.thanhTien ?? (unit * qty);
            return {
              serviceId: s?.IddichVu ?? s?.iddichVu ?? s?.IdDichVu ?? s?.Id ?? null,
              serviceName: s?.TenDichVu ?? s?.serviceName ?? null,
              quantity: qty,
              price: Number(unit),
              amount: Number(amount),
              GhiChu: s?.GhiChu ?? s?.Note ?? ''
            };
          })
        : [];

      // If all amounts are zero (or no services), try a fallback: fetch booking with Cthddvs to get real TienDichVu
      let finalMapped = mapped;
      const totalAmount = mapped.reduce((a: number, b: any) => a + Number(b.amount || 0), 0);
      if (totalAmount === 0) {
        try {
          const booking = await checkinApi.getBookingById(id as any);
          const hoaDons = booking?.HoaDons ?? booking?.hoaDons ?? booking?.invoices ?? [];
          const lines: any[] = [];
          if (Array.isArray(hoaDons)) {
            hoaDons.forEach((h: any) => {
              const cth = h?.Cthddvs ?? h?.cthddvs ?? h?.Cthddv ?? h?.cthddv ?? [];
              if (Array.isArray(cth)) {
                cth.forEach((c: any) => {
                  lines.push({
                    serviceName: c?.IddichVuNavigation?.TenDichVu ?? c?.TenDichVu ?? c?.IddichVu ?? c?.TenCombo ?? 'Dịch vụ',
                    quantity: Number(c?.SoLuong ?? c?.SoLuongDichVu ?? 1),
                    price: Number(c?.TienDichVu ?? c?.donGia ?? 0),
                    amount: Number(c?.TienDichVu ?? c?.thanhTien ?? 0),
                    GhiChu: c?.GhiChu ?? ''
                  });
                });
              }
            });
          }

          if (lines.length > 0) finalMapped = lines.map((x, i) => ({ key: i, ...x }));
        } catch (e) {
          // ignore fallback error
        }
      }

      // Enrich service names by fetching service details for any serviceId present and missing name
      try {
        const idsToFetch = Array.from(new Set(mapped.filter(m => m.serviceId && !m.serviceName).map(m => String(m.serviceId))));
        if (idsToFetch.length > 0) {
          const fetches = await Promise.all(idsToFetch.map(id => serviceApi.getServiceById(id).catch(() => null)));
          const svcMap: Record<string, any> = {};
          idsToFetch.forEach((id, i) => { if (fetches[i]) svcMap[id] = fetches[i]; });
          finalMapped = finalMapped.map((m: any) => {
            if ((!m.serviceName || m.serviceName.toString().startsWith('Dịch vụ')) && m.serviceId && svcMap[String(m.serviceId)]) {
              return { ...m, serviceName: svcMap[String(m.serviceId)].tenDichVu ?? svcMap[String(m.serviceId)].tenDichVu ?? svcMap[String(m.serviceId)].tenDichVu };
            }
            return m;
          });
        }
      } catch (e) {
        // ignore enrichment errors
      }

      setViewerServices(mapped);
      setViewerServices(finalMapped);
      setViewerBookingId(String(id ?? ''));
      // set form fields for viewer
      viewerForm.setFieldsValue({ amount: finalMapped.reduce((a: any, b: any) => a + Number(b.amount || 0), 0), GhiChu: '' });
      setViewerVisible(true);
    } catch (e: any) {
      message.error(e?.message || 'Không thể tải chi tiết dịch vụ');
    } finally {
      setViewerLoading(false);
    }
  };

  // Render card UI for "using" view, keep table for other views
  if (viewMode === "using") {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Segmented
            value={viewMode}
            onChange={(v) => onViewChange?.(v as "using" | "checkin")}
            options={[{ label: "Đang sử dụng", value: "using" }]}
          />
        </div>

        {(data || []).map((row) => {
          const roomLines = getRoomLines(row);
          const totalRooms = Array.isArray(roomLines) && roomLines.length > 0 ? roomLines.length : 1;

          return (
            <div key={row.IddatPhong} style={{ border: "1px solid #e6e6e6", padding: 16, marginBottom: 18, borderRadius: 8, background: "#ffffff" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{(row as any).TenKhachHang ?? "Khách"}</div>
                  <div style={{ color: "#64748b", fontSize: 14 }}>
                    Check-in: {row.NgayNhanPhong ?? "-"} &nbsp;•&nbsp; Trả: {row.NgayTraPhong ?? "-"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ textAlign: "right", marginRight: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{totalRooms} phòng</div>
                    <div style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>Tổng: {fmt(row.TongTien)}</div>
                  </div>

                  <Space>
                    <Button type="primary" size="large" onClick={() => onPay?.(row)}>Thanh toán</Button>
                    <Button size="large" onClick={() => onAddService?.(row)}>Thêm phòng</Button>
                  </Space>
                </div>
              </div>

              {/* Cards per room */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {((roomLines && roomLines.length > 0) ? roomLines : [null]).map((it: any, idx: number) => {
                  const { ten, so } = extractRoomInfo(it || {});
                  const primary = ten ?? (so ? `Phòng ${so}` : `#${idx + 1}`);

                  // price extraction heuristic
                  const price = it?.DonGia ?? it?.Gia ?? it?.GiaPhong ?? it?.Price ?? null;

                  return (
                    <Card key={idx} hoverable style={{ width: 340, padding: 16, borderRadius: 8, boxShadow: "0 6px 18px rgba(15,23,42,0.06)" }}>
                      <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 4 }}>{primary}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>Check-in: {row.NgayNhanPhong ?? "-"}</div>

                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                        <div style={{ fontSize: 14 }}>
                          <div style={{ marginBottom: 6 }}>Giá: {price ? `${Number(price).toLocaleString()} đ/đêm` : "-"}</div>
                          <div>Trạng thái: <Tag color="green" style={{ fontSize: 12, padding: '2px 8px' }}>Đang ở</Tag></div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, color: "#64748b" }}>Số khách</div>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{it?.SoKhach ?? (it?.SoNguoi ?? "-")}</div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        <Button type="primary" onClick={() => onAddService?.(row)} style={{ minWidth: 140 }}>Thêm dịch vụ</Button>
                        <Button onClick={() => openServiceViewer(row)} style={{ minWidth: 140 }}>Xem chi tiết dịch vụ</Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Service viewer modal (read-only) */}
        <FormService
          visible={viewerVisible}
          selectedServices={viewerServices}
          servicesTotal={viewerServices.reduce((a, b) => a + Number(b.amount || 0), 0)}
          form={viewerForm}
          onCancel={() => setViewerVisible(false)}
          onSubmit={async () => setViewerVisible(false)}
          bookingId={viewerBookingId ?? undefined}
          readOnly={true}
        />
      </div>
    );
  }

  // Fallback: original table view (e.g., checkin view)
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={viewMode}
          onChange={(v) => onViewChange?.(v as "using" | "checkin")}
          options={[{ label: "Đang sử dụng", value: "using" }]}
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

export default CheckinTable;