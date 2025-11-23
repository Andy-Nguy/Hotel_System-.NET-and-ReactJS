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
}

interface Props {
  data: BookingRow[];
  loading: boolean;
  onPay: (row: BookingRow) => void;
  onComplete: (row: BookingRow) => void;
  // When in checkout view, parent can request the payment form to open (same as 'using' view)
  onOpenPaymentForm?: (row: BookingRow) => void;
  onAddService?: (row: BookingRow) => void;
  onViewInvoice?: (row: BookingRow) => void;
  viewInvoiceIds?: string[];
  viewMode?: "using" | "checkout";
  onViewChange?: (mode: "using" | "checkout") => void;
}

const CheckoutTable: React.FC<Props> = ({
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
      render: (_, r) => (
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
      render: (v) => Number(v).toLocaleString() + " đ",
    },
    {
      title: "Trạng thái TT",
      dataIndex: "TrangThaiThanhToan",
      key: "tt",
      render: (s) => (
        <Tag color={s === 2 ? "green" : "orange"}>
          {s === 2 ? "Đã thanh toán" : "Chưa/Chờ"}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      fixed: "right",
      render: (_, r) => {
        const isPaid = (r.TrangThaiThanhToan ?? 0) === 2;
        const isCompleted = (r.TrangThai ?? 0) === 4;

        // Chế độ trả phòng hôm nay: chỉ cho "Xác nhận trả phòng"
        if (viewMode === "checkout") {
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
                      onClick={() =>
                        onViewInvoice ? onViewInvoice(r) : onComplete(r)
                      }
                    >
                      Xác nhận trả phòng
                    </Button>
                  )}

                  {/* Show 'Xác nhận thanh toán' only when booking is NOT paid */}
                  {!isPaid && (
                    <Button
                      type="primary"
                      danger={false}
                      onClick={() =>
                        typeof (
                          /* istanbul ignore next */ onOpenPaymentForm
                        ) === "function"
                          ? onOpenPaymentForm!(r)
                          : onPay?.(r)
                      }
                    >
                      Xác nhận thanh toán
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
          onChange={(v) => onViewChange?.(v as "using" | "checkout")}
          options={[{ label: "Trả phòng hôm nay", value: "checkout" }]}
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
