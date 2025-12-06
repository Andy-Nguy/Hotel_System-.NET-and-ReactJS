import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Cell } from 'recharts';
import { Card, Row, Col, Spin, Statistic, Segmented } from 'antd';
import { DollarOutlined, LineChartOutlined } from '@ant-design/icons';
import { getDailyRevenueSnapshot, getMonthlyRevenueSnapshot, getAdrSnapshot, syncSnapshot, getSnapshotDetails, getCustomerOrigin } from '../../api/reportApi';
import { PieChartComponent } from '../components/Chart';
import type { DailyRevenueData, MonthlyRevenueData, AdrData } from '../../api/reportApi';
import type { SnapshotDetailRow } from '../../api/reportApi';
import { Table } from 'antd';

const ReportDashboard: React.FC = () => {
  const [dailyData, setDailyData] = useState<DailyRevenueData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenueData[]>([]);
  const [adrData, setAdrData] = useState<AdrData[]>([]);
  const [customerOrigin, setCustomerOrigin] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState<30 | 60 | 90>(30);
  // Monthly chart will always show 12 months (Tháng 1 → Tháng 12)
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<SnapshotDetailRow[]>([]);

  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Ensure persistent snapshot table is up-to-date before reading it
      try {
        await syncSnapshot();
      } catch (syncErr: any) {
        console.warn('Snapshot sync failed:', syncErr);
        setError('Không thể đồng bộ dữ liệu thống kê. Vui lòng thử lại hoặc kiểm tra server.');
        setLoading(false);
        return;
      }
      const [daily, monthly, adr] = await Promise.all([
        getDailyRevenueSnapshot(days),
        // force 12 months for consistent Jan→Dec X axis
        getMonthlyRevenueSnapshot(12),
        getAdrSnapshot(days),
      ]);
      setDailyData(daily || []);
      setMonthlyData(monthly || []);
      setAdrData(adr || []);
      try {
        const co = await getCustomerOrigin();
        setCustomerOrigin(co || []);
      } catch (e) {
        console.warn('Failed to load customer origin', e);
      }
      // If all empty, surface a friendly message
      if ((daily?.length || 0) === 0 && (monthly?.length || 0) === 0 && (adr?.length || 0) === 0) {
        setError('Không có dữ liệu báo cáo cho khoảng thời gian này. Hãy kiểm tra dữ liệu hóa đơn hoặc refresh materialized view.');
      }
    } catch (err: any) {
      console.error('Error loading report data:', err);
      setError(err?.message || 'Lỗi khi tải dữ liệu báo cáo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
    // Also load details after report loads
    const loadDetails = async () => {
      try {
        const det = await getSnapshotDetails();
        setDetails(det || []);
      } catch (e) {
        console.warn('Failed to load snapshot details', e);
      }
    };
    loadDetails();
  }, [days]);

  const formatVND = (value: number): string => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  const pieColors = React.useMemo(() => {
    const fallback = ["#ff4d4f", "#ff7a7a", "#ffa39e", "#ffccc7"];
    const isNew = (s: any) => {
      if (!s) return false;
      const t = String(s).toLowerCase();
      return t.includes('khách mới') || t.includes('mới') || t.includes('moi') || t.includes('new');
    };
    return (customerOrigin || []).map((c: any, i: number) => (isNew(c?.origin) ? '#3b82f6' : fallback[i % fallback.length]));
  }, [customerOrigin]);

  // Calculate total and average from daily data
  const totalRevenue = dailyData.reduce((sum, item) => sum + (item.revenue || 0), 0);
  const avgDailyRevenue = dailyData.length > 0 ? totalRevenue / dailyData.length : 0;
  const avgAdr = adrData.length > 0 ? adrData.reduce((sum, item) => sum + (item.adr || 0), 0) / adrData.length : 0;

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', fontWeight: 'bold' }}>📊 Báo cáo doanh thu</h1>

      {/* Key Statistics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng doanh thu"
              value={totalRevenue}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => formatVND(value as number)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="TB doanh thu/ngày"
              value={avgDailyRevenue}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => formatVND(value as number)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="TB giá phòng/đêm (ADR)"
              value={avgAdr}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#fa8c16' }}
              formatter={(value) => formatVND(value as number)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Số ngày dữ liệu"
              value={dailyData.length}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Spin spinning={loading}>
        {error && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ padding: 12, background: '#fff3f0', border: '1px solid #ffd7d0', borderRadius: 6, color: '#ad1f1f' }}>
              {error}
            </div>
          </div>
        )}
        <Row gutter={16} style={{ marginBottom: '24px' }} align="stretch">
          <Col xs={24} lg={12}>
            <Card
              title="Doanh thu hàng ngày"
              extra={
                <Segmented<30 | 60 | 90>
                  value={days}
                  onChange={setDays}
                  options={[
                    { label: '30 ngày', value: 30 },
                    { label: '60 ngày', value: 60 },
                    { label: '90 ngày', value: 90 },
                  ]}
                />
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  {/* rainbow gradient for daily line */}
                  <defs>
                    <linearGradient id="dailyGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff4d4f" />
                      <stop offset="15%" stopColor="#ffa940" />
                      <stop offset="35%" stopColor="#ffd666" />
                      <stop offset="55%" stopColor="#73d13d" />
                      <stop offset="75%" stopColor="#40a9ff" />
                      <stop offset="90%" stopColor="#9254de" />
                      <stop offset="100%" stopColor="#f759ab" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f6ff" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatVND(value as number)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="url(#dailyGradient)"
                    strokeWidth={3}
                    dot={false}
                    name="Doanh thu"
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="Doanh thu hàng tháng"
              extra={null}
            >
                {/* Build a 12-month dataset (Tháng 1..12). If API returns month identifiers,
                    we try to map revenues into the corresponding month; otherwise fall back to order. */}
                {(() => {
                  const parseMonth = (val: any) => {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string') {
                      // try YYYY-MM or YYYY-MM-DD
                      const m = val.match(/^(\d{4})-(\d{1,2})(?:-|$)/);
                      if (m) return Number(m[2]);
                      // try month name / full date
                      const parsed = Date.parse(val);
                      if (!isNaN(parsed)) return new Date(parsed).getMonth() + 1;
                      const num = Number(val);
                      if (!isNaN(num) && num >= 1 && num <= 12) return num;
                    }
                    return null;
                  };

                  const monthMap = new Map<number, number>();
                  (monthlyData || []).forEach((md: any) => {
                    const m = parseMonth(md.month ?? md.label ?? md.name ?? md[Object.keys(md)[0]]);
                    const rev = Number(md.revenue ?? md.revenueAmount ?? md.value ?? 0) || 0;
                    if (m && m >= 1 && m <= 12) {
                      monthMap.set(m, (monthMap.get(m) || 0) + rev);
                    }
                  });

                  const monthlyChartData = Array.from({ length: 12 }, (_, i) => {
                    const monthNumber = i + 1;
                    return {
                      month: monthNumber,
                      monthLabel: `Tháng ${monthNumber}`,
                      revenue: monthMap.get(monthNumber) || 0
                    };
                  });

                  return (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={monthlyChartData} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                        {/* Gradient definition for a soft blue look */}
                            <defs>
                              <linearGradient id="monthlyGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ff4d4f" stopOpacity={0.98} />
                                <stop offset="16%" stopColor="#ffa940" stopOpacity={0.98} />
                                <stop offset="32%" stopColor="#ffd666" stopOpacity={0.95} />
                                <stop offset="48%" stopColor="#73d13d" stopOpacity={0.95} />
                                <stop offset="64%" stopColor="#40a9ff" stopOpacity={0.95} />
                                <stop offset="80%" stopColor="#9254de" stopOpacity={0.95} />
                                <stop offset="100%" stopColor="#f759ab" stopOpacity={0.95} />
                              </linearGradient>
                            </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef6ff" />
                        <XAxis
                          dataKey="monthLabel"
                          tickLine={false}
                          axisLine={{ stroke: '#e6f4ea' }}
                        />
                        <YAxis
                          tickFormatter={(v) => {
                            if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
                            if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + 'k';
                            return v;
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip formatter={(value: any) => formatVND(Number(value || 0))} />
                        <Legend />
                              <Bar
                                dataKey="revenue"
                                name="Doanh thu"
                                radius={[6, 6, 6, 6]}
                                animationDuration={800}
                                animationEasing="ease-out"
                                isAnimationActive={true}
                              >
                                {monthlyChartData.map((d) => (
                                  <Cell key={`cell-${d.month}`} fill={d.month === 3 ? '#3b82f6' : 'url(#monthlyGradient)'} />
                                ))}
                                <LabelList
                                  dataKey="revenue"
                                  position="top"
                                  formatter={(val: any) => {
                                    try {
                                      return formatVND(Number(val || 0));
                                    } catch (_) {
                                      return val;
                                    }
                                  }}
                                  offset={6}
                                />
                              </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                })()}
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} lg={18}>
            <Card title="Giá phòng trung bình hàng ngày (ADR)" bodyStyle={{ height: 320 }}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={adrData}>
                  <defs>
                    <linearGradient id="adrGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ffd666" />
                      <stop offset="50%" stopColor="#fa8c16" />
                      <stop offset="100%" stopColor="#ff4d4f" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f7f2ff" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatVND(value as number)} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="adr"
                    stroke="url(#adrGradient)"
                    strokeWidth={3}
                    dot={false}
                    name="ADR"
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} lg={6}>
            <Card title="Nguồn khách" bodyStyle={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PieChartComponent data={customerOrigin as any} colors={pieColors} height={300} />
            </Card>
          </Col>
        </Row>

        {/* Details table */}
        <Row style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card title="Chi tiết thống kê (ThongKeDoanhThuKhachSan)">
              <Table
                dataSource={details}
                rowKey={(r) => r.id}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id' },
                  { title: 'IDHoaDon', dataIndex: 'idHoaDon', key: 'idHoaDon' },
                  { title: 'IDDatPhong', dataIndex: 'idDatPhong', key: 'idDatPhong' },
                  { title: 'Ngày', dataIndex: 'ngay', key: 'ngay', render: (v: any) => v ? new Date(v).toISOString().slice(0,10) : '' },
                  { title: 'Phòng', dataIndex: 'tongPhong', key: 'tongPhong' },
                  { title: 'Số đêm', dataIndex: 'soDem', key: 'soDem' },
                  { title: 'Tiền phòng', dataIndex: 'tienPhong', key: 'tienPhong', render: (v: any) => formatVND(v || 0) },
                  { title: 'Tiền DV', dataIndex: 'tienDichVu', key: 'tienDichVu', render: (v: any) => formatVND(v || 0) },
                  { title: 'Giảm giá', dataIndex: 'tienGiamGia', key: 'tienGiamGia', render: (v: any) => formatVND(v || 0) },
                  { title: 'Doanh thu', dataIndex: 'doanhThu', key: 'doanhThu', render: (v: any) => formatVND(v || 0) }
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default ReportDashboard;
