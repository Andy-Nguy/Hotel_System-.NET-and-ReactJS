import React, { useEffect, useState } from "react";
import checkinApi from '../../../api/checkinApi';
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