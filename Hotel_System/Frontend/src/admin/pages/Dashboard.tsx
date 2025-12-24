import React, { useEffect, useMemo, useState } from "react";
import {
  LineChartComponent,
  BarChartComponent,
  AreaChartComponent,
  PieChartComponent,
} from "../components/Chart";
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  DatePicker,
  Button,
  Select,
  Space,
  Tabs,
  message,
  Spin,
} from "antd";
import { BarChartOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs, { Dayjs } from "dayjs";
import ReportDashboard from "./ReportDashboard";

// Use centralized API configuration
import { API_CONFIG } from "../../api/config";
const API_BASE = `${API_CONFIG.CURRENT}/api`;

const fetchJson = async (url: string, init?: RequestInit) => {
  // Prepend API_BASE if url starts with /api
  const finalUrl = url.startsWith("/api") ? `${API_BASE}${url.slice(4)}` : url;
  const res = await fetch(finalUrl, init);
  let text = "";
  try {
    text = await res.text();
  } catch {}
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || data.error)) || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data ?? { ok: true };
};

interface KPIData {
  currentMonthRevenue: number;
  todayRevenue: number;
  occupancyRateToday: number;
  roomsInUse: number;
  roomsAvailable: number;
  roomsMaintenance: number;
  checkInToday: number;
  checkOutToday: number;
  totalBookingsThisMonth: number;
  cancelledBookingsThisMonth: number;
}

interface RevenueChartData {
  date: string;
  revenue: number;
  roomRevenue: number;
  serviceRevenue: number;
}

interface OccupancyData {
  date: string;
  occupancyRate: number;
}

interface TopRoomData {
  roomId: string;
  roomName: string;
  roomNumber: string;
  bookingCount: number;
  totalRevenue: number;
}

interface TopServiceData {
  serviceId: string;
  serviceName: string;
  usageCount: number;
  totalRevenue: number;
}

interface CustomerOriginData {
  origin: string;
  count: number;
}

interface DetailedReportData {
  roomId: string;
  roomName: string;
  roomNumber: string;
  status: string;
  occupancyDays: number;
  revenue: number;
  occupancyRate: number;
}

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [showReportDashboard, setShowReportDashboard] = useState(false);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData[]>(
    []
  );
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([]);
  const [topRooms, setTopRooms] = useState<TopRoomData[]>([]);
  const [topServices, setTopServices] = useState<TopServiceData[]>([]);
  const [customerOrigin, setCustomerOrigin] = useState<CustomerOriginData[]>(
    []
  );
  const [detailedReports, setDetailedReports] = useState<DetailedReportData[]>(
    []
  );

  const [filterFromDate, setFilterFromDate] = useState<Dayjs | null>(
    dayjs().startOf("month")
  );
  const [filterToDate, setFilterToDate] = useState<Dayjs | null>(dayjs());
  const [reportType, setReportType] = useState<"room" | "revenue" | "customer">(
    "room"
  );

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load KPI data
      const kpiRes = await fetchJson("/api/Dashboard/chi-so-kpi");
      setKpiData(kpiRes?.data || {});

      // Load revenue chart data (default: last 30 days)
      const revenueRes = await fetchJson(
        `/api/Dashboard/bieu-do-doanh-thu?days=30`
      );
      setRevenueChartData(
        Array.isArray(revenueRes?.data) ? revenueRes.data : []
      );

      // Load occupancy data
      const occupancyRes = await fetchJson(
        `/api/Dashboard/ty-le-lap-phong?days=30`
      );
      setOccupancyData(
        Array.isArray(occupancyRes?.data) ? occupancyRes.data : []
      );

      // Load top rooms
      const topRoomsRes = await fetchJson(
        `/api/Dashboard/phong-top?limit=5&month=${dayjs().format("YYYY-MM")}`
      );
      setTopRooms(Array.isArray(topRoomsRes?.data) ? topRoomsRes.data : []);

      // Load top services
      const topServicesRes = await fetchJson(
        `/api/Dashboard/dich-vu-top?limit=5&month=${dayjs().format("YYYY-MM")}`
      );
      setTopServices(
        Array.isArray(topServicesRes?.data) ? topServicesRes.data : []
      );

      // Load customer origin distribution
      const customerOriginRes = await fetchJson(
        `/api/Dashboard/nguon-khach-hang`
      );
      setCustomerOrigin(
        Array.isArray(customerOriginRes?.data) ? customerOriginRes.data : []
      );

      message.success("Đã tải dữ liệu Dashboard");
    } catch (e: any) {
      message.error(e.message || "Lỗi tải Dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadDetailedReport = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterFromDate)
        qs.set("fromDate", filterFromDate.format("YYYY-MM-DD"));
      if (filterToDate) qs.set("toDate", filterToDate.format("YYYY-MM-DD"));
      qs.set("reportType", reportType);

      const res = await fetchJson(
        `/api/Dashboard/bao-cao/chi-tiet?${qs.toString()}`
      );
      setDetailedReports(Array.isArray(res?.data) ? res.data : []);
    } catch (e: any) {
      message.error(e.message || "Lỗi tải báo cáo chi tiết");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const occupancyChartData = React.useMemo(() => {
    // Take first 15 days (or fewer) and map to day number + occupied count
    try {
      const sorted = [...occupancyData].sort((a, b) => {
        const da = dayjs(a.date);
        const db = dayjs(b.date);
        return da.isBefore(db) ? -1 : da.isAfter(db) ? 1 : 0;
      });
      return sorted.slice(0, 15).map((d) => {
        const parsed = dayjs(d.date);
        const dayNum = parsed.isValid() ? parsed.date() : d.date;
        return { day: dayNum, occupied: (d as any).occupancyRate ?? (d as any).occupied ?? 0 };
      });
    } catch (e) {
      return (occupancyData || []).slice(0, 15).map((d, i) => ({ day: i + 1, occupied: (d as any).occupancyRate ?? (d as any).occupied ?? 0 }));
    }
  }, [occupancyData]);

  // Column definitions for detailed reports
  const reportColumns: ColumnsType<DetailedReportData> = useMemo(() => {
    if (reportType === "room") {
      return [
        { title: "Phòng", dataIndex: "roomName", key: "roomName", width: 150 },
        {
          title: "Số phòng",
          dataIndex: "roomNumber",
          key: "roomNumber",
          width: 100,
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          key: "status",
          width: 120,
          render: (s: string) => {
            const statusMap: Record<string, string> = {
              empty: "Trống",
              booked: "Đã đặt",
              "in-use": "Đang sử dụng",
              maintenance: "Sửa chữa",
            };
            return statusMap[s] || s;
          },
        },
        {
          title: "Ngày lấp phòng",
          dataIndex: "occupancyDays",
          key: "occupancyDays",
          width: 120,
          render: (v) => `${v} ngày`,
        },
        {
          title: "Doanh thu",
          dataIndex: "revenue",
          key: "revenue",
          width: 150,
          align: "right",
          render: (v: number) => `${v.toLocaleString()}đ`,
        },
        {
          title: "Tỷ lệ lấp phòng",
          dataIndex: "occupancyRate",
          key: "occupancyRate",
          width: 100,
          align: "center",
          render: (v: number) => `${v.toFixed(1)}%`,
        },
      ];
    } else if (reportType === "revenue") {
      return [
        { title: "Mục", dataIndex: "roomName", key: "roomName", width: 200 },
        {
          title: "Doanh thu",
          dataIndex: "revenue",
          key: "revenue",
          width: 150,
          align: "right",
          render: (v: number) => `${v.toLocaleString()}đ`,
        },
        {
          title: "Tỷ lệ",
          dataIndex: "occupancyRate",
          key: "occupancyRate",
          width: 100,
          align: "center",
          render: (v: number) => `${v.toFixed(1)}%`,
        },
      ];
    } else {
      return [
        {
          title: "Loại khách",
          dataIndex: "roomName",
          key: "roomName",
          width: 200,
        },
        {
          title: "Số lượng",
          dataIndex: "occupancyDays",
          key: "occupancyDays",
          width: 100,
          align: "right",
        },
        {
          title: "Doanh thu",
          dataIndex: "revenue",
          key: "revenue",
          width: 150,
          align: "right",
          render: (v: number) => `${v.toLocaleString()}đ`,
        },
      ];
    }
  }, [reportType]);

  return (
    <>
      {showReportDashboard ? (
        <div>
          <Button onClick={() => setShowReportDashboard(false)} style={{ marginBottom: 16 }}>
            ← Quay lại Dashboard
          </Button>
          <ReportDashboard />
        </div>
      ) : (
        <Spin spinning={loading}>
        {/* Cấp 1: KPI Blocks */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginBottom: 16 }}>Tổng quan</h2>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div></div>
            <Button
              type="primary"
              icon={<BarChartOutlined />}
              onClick={() => setShowReportDashboard(true)}
            >
              📊 Báo cáo chi tiết
            </Button>
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Doanh thu tháng này"
                  value={kpiData?.currentMonthRevenue || 0}
                  precision={0}
                  suffix="đ"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Doanh thu hôm nay"
                  value={kpiData?.todayRevenue || 0}
                  precision={0}
                  suffix="đ"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Tỷ lệ lấp phòng"
                  value={kpiData?.occupancyRateToday || 0}
                  precision={1}
                  suffix="%"
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Phòng đang dùng"
                  value={kpiData?.roomsInUse || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Phòng trống"
                  value={kpiData?.roomsAvailable || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Phòng sửa chữa"
                  value={kpiData?.roomsMaintenance || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Check-in hôm nay"
                  value={kpiData?.checkInToday || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Check-out hôm nay"
                  value={kpiData?.checkOutToday || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Booking tháng này"
                  value={kpiData?.totalBookingsThisMonth || 0}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Booking hủy"
                  value={kpiData?.cancelledBookingsThisMonth || 0}
                />
              </Card>
            </Col>
          </Row>
        </div>

        {/* Charts: daily revenue, occupancy, customer origin */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(2,6,23,0.06)', marginBottom: 24 }}>
          <h2 style={{ marginBottom: 16 }}>Biểu đồ</h2>
          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card title="Doanh thu (30 ngày)" style={{ marginBottom: 12 }}>
                <LineChartComponent data={revenueChartData} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Tỷ lệ đặt phòng (1 → 15)" style={{ marginBottom: 12 }}>
                <AreaChartComponent data={occupancyChartData as any} dataKey="occupied" xKey="day" />
              </Card>
            </Col>
          </Row>
          {/* Pie moved to detailed report page */}
        </div>

        {/* Cấp 3: Detailed Reports */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginBottom: 16 }}>Báo cáo chi tiết</h2>
                <Space style={{ marginBottom: 16 }}>
            <DatePicker
              value={filterFromDate}
              onChange={setFilterFromDate}
              placeholder="Từ ngày"
            />
            <DatePicker
              value={filterToDate}
              onChange={setFilterToDate}
              placeholder="Đến ngày"
            />
            <Select
              value={reportType}
              onChange={setReportType}
              style={{ width: 180 }}
              options={[
                { value: "room", label: "Báo cáo công suất phòng" },
                { value: "revenue", label: "Báo cáo doanh thu" },
                { value: "customer", label: "Báo cáo khách hàng" },
              ]}
            />
            <Button type="primary" onClick={loadDetailedReport}>
              Tải báo cáo
            </Button>
            <Button
              onClick={() => {
                const csv = [
                  ["Phòng", "Doanh thu", "Tỷ lệ lấp phòng"].join(","),
                  ...detailedReports.map((r) =>
                    [
                      `${r.roomName} (#${r.roomNumber})`,
                      r.revenue,
                      `${r.occupancyRate.toFixed(1)}%`,
                    ].join(",")
                  ),
                ].join("\n");
                const blob = new Blob([csv], {
                  type: "text/csv;charset=utf-8;",
                });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `report-${dayjs().format("YYYY-MM-DD")}.csv`;
                link.click();
              }}
            >
              Export Excel
            </Button>
          </Space>
          <Table
            dataSource={detailedReports}
            columns={reportColumns}
            rowKey="roomId"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </div>
        </Spin>
      )}
    </>
  );
};

export default Dashboard;
