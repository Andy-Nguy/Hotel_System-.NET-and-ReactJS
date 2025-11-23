import React from "react";
import { Tag, Button, Space, Popconfirm, Tooltip } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { Booking } from "../../api/bookingApi";
import DataTable from "./DataTable";
import {
  getStatusColor,
  getStatusLabel,
  getPaymentStatusColor,
  getPaymentStatusLabel,
} from "../utils/bookingUtils";
import dayjs from "dayjs";

interface BookingTableProps {
  bookings: Booking[];
  loading: boolean;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onViewDetail: (booking: Booking) => void;
  showActions?: boolean;
}

const BookingTable: React.FC<BookingTableProps> = ({
  bookings,
  loading,
  onConfirm,
  onCancel,
  onViewDetail,
  showActions = true,
}) => {
  const columns: ColumnsType<Booking> = [
    {
      title: "Mã đặt phòng",
      dataIndex: "iddatPhong",
      key: "iddatPhong",
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ fontSize: 13 }}>
            {text && text.length > 8 ? text.substring(0, 8) + "..." : text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Khách hàng",
      key: "khachHang",
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {record.tenKhachHang || "N/A"}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {record.emailKhachHang}
          </div>
        </div>
      ),
    },
    {
      title: "Phòng",
      key: "phong",
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>
            {record.tenPhong || record.idphong}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Phòng {record.soPhong || "—"}
          </div>
        </div>
      ),
    },
    {
      title: "Ngày nhận - trả",
      key: "ngay",
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>
            {dayjs(record.ngayNhanPhong).format("DD/MM/YYYY")}
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {dayjs(record.ngayTraPhong).format("DD/MM/YYYY")}
          </div>
        </div>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "tongTien",
      key: "tongTien",
      align: "right",
      render: (value) => (
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          {value?.toLocaleString()} đ
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "trangThai",
      key: "trangThai",
      align: "center",
      fixed: "right",
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: "Thanh toán",
      dataIndex: "trangThaiThanhToan",
      key: "trangThaiThanhToan",
      align: "center",
      render: (status) => (
        <Tag color={getPaymentStatusColor(status)}>
          {getPaymentStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      align: "right",
      render: (_, record) => (
        <Space
          direction="vertical"
          size="small"
          onClick={(e) => e.stopPropagation()}
        >
          {showActions && record.trangThai === 1 && (
            <Tooltip title="Xác nhận">
              <Popconfirm
                title="Xác nhận đặt phòng?"
                description="Gửi mail xác nhận cho khách?"
                onConfirm={() => onConfirm(record.iddatPhong)}
                okText="Có"
                cancelText="Không"
              >
                <Button
                  size="small"
                  type="text"
                  icon={
                    <CheckOutlined
                      style={{ color: "#10b981", fontSize: "14px" }}
                    />
                  }
                />
              </Popconfirm>
            </Tooltip>
          )}
          {showActions &&
            record.trangThai !== 0 &&
            record.trangThai !== 3 &&
            record.trangThai !== 4 && (
              <Tooltip title="Hủy">
                <Popconfirm
                  title="Hủy đặt phòng?"
                  description="Bạn có chắc muốn hủy?"
                  onConfirm={() => onCancel(record.iddatPhong)}
                  okText="Có"
                  cancelText="Không"
                >
                  <Button
                    size="small"
                    type="text"
                    icon={
                      <CloseOutlined
                        style={{ color: "#ef4444", fontSize: "14px" }}
                      />
                    }
                  />
                </Popconfirm>
              </Tooltip>
            )}
        </Space>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      dataSource={bookings}
      rowKey="iddatPhong"
      loading={loading}
      onRow={(record) => ({
        onClick: () => onViewDetail(record),
        style: { cursor: "pointer" },
      })}
    />
  );
};

export default BookingTable;
