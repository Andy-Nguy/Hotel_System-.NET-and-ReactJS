import React from "react";
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
            {typeof onViewInvoice === "function" && (
              <Button type="default" onClick={() => onViewInvoice?.(r)}>
                Xem chi tiết
              </Button>
            )}
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
