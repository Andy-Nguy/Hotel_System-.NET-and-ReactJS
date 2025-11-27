import React, { useEffect, useMemo, useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Space,
  Tabs,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import DataTable from "../components/DataTable";

interface CustomerLoyalty {
  idKhachHang: string;
  tenKhachHang: string;
  email?: string;
  soDienThoai?: string;
  tichDiem: number;
  tier: string; // Silver, Gold, Platinum, Diamond
}

interface MembershipTier {
  name: string;
  minPoints: number;
  color: string;
  benefits: string;
  multiplier: number; // e.g. 1.0, 1.2, 1.5, 2.0
}

// Updated tiers: Silver -> Gold -> Platinum -> Diamond
const defaultTiers: MembershipTier[] = [
  {
    name: "Silver",
    minPoints: 0,
    color: "#c0c0c0",
    benefits: "",
    multiplier: 1.0,
  },
  {
    name: "Gold",
    minPoints: 100,
    color: "#ffd700",
    benefits: "",
    multiplier: 1.2,
  },
  {
    name: "Platinum",
    minPoints: 500,
    color: "#e5e4e2",
    benefits: "",
    multiplier: 1.5,
  },
  {
    name: "Diamond",
    minPoints: 1000,
    color: "#b9f2ff",
    benefits: "",
    multiplier: 2.0,
  },
];

// Resolve API base from Vite env when available (VITE_API_URL)
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, "")
  ? `${_VITE_API.replace(/\/$/, "")}/api`
  : "/api";

const fetchJson = async (url: string, init?: RequestInit) => {
  // Prepend API_BASE if url starts with /api
  const finalUrl = url.startsWith("/api") ? `${API_BASE}${url.slice(4)}` : url;
  const res = await fetch(finalUrl, init);
  const txt = await res.text().catch(() => "");
  const data = txt ? JSON.parse(txt) : null;
  if (!res.ok)
    throw new Error(
      (data && (data.message || data.error)) || `HTTP ${res.status}`
    );
  return data;
};

const getTier = (points: number, tiers: MembershipTier[]) => {
  const sorted = [...tiers].sort((a, b) => b.minPoints - a.minPoints);
  return sorted.find((t) => points >= t.minPoints) || tiers[0];
};

const LoyaltyManager: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerLoyalty[]>([]);
  const [keyword, setKeyword] = useState("");
  const [tiers, setTiers] = useState<MembershipTier[]>(defaultTiers);

  // Modal cho điều chỉnh điểm
  const [adjustModal, setAdjustModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerLoyalty | null>(null);
  const [form] = Form.useForm();

  // Modal cho chỉnh sửa tier
  const [tierModal, setTierModal] = useState(false);
  const [editingTier, setEditingTier] = useState<MembershipTier | null>(null);
  const [tierForm] = Form.useForm();

  const loadCustomers = async () => {
    setLoading(true);
    try {
      // Giả sử backend có endpoint GET /api/KhachHang trả về danh sách khách hàng
      const data = await fetchJson(`/api/KhachHang`);
      const list: CustomerLoyalty[] = (
        Array.isArray(data) ? data : data.data || []
      ).map((c: any) => ({
        idKhachHang: c.idKhachHang || c.IdKhachHang,
        tenKhachHang:
          c.tenKhachHang || c.TenKhachHang || c.hoTen || c.HoTen || "—",
        email: c.email || c.Email,
        soDienThoai: c.soDienThoai || c.SoDienThoai,
        tichDiem: Number(c.tichDiem || c.TichDiem || 0),
        tier: getTier(Number(c.tichDiem || c.TichDiem || 0), tiers).name,
      }));
      setCustomers(list);
    } catch (e: any) {
      message.error(e.message || "Không thể tải danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line
  }, []);

  const filtered = useMemo(() => {
    if (!keyword) return customers;
    const k = keyword.toLowerCase();
    return customers.filter(
      (c) =>
        c.idKhachHang.toLowerCase().includes(k) ||
        c.tenKhachHang.toLowerCase().includes(k) ||
        (c.email && c.email.toLowerCase().includes(k)) ||
        (c.soDienThoai && c.soDienThoai.includes(k))
    );
  }, [customers, keyword]);

  const openAdjustPoints = (customer: CustomerLoyalty) => {
    setSelectedCustomer(customer);
    form.resetFields();
    form.setFieldsValue({ points: 0, reason: "" });
    setAdjustModal(true);
  };

  const submitAdjustPoints = async () => {
    if (!selectedCustomer) return;
    try {
      const v = await form.validateFields();
      const pointsToAdd = Number(v.points);
      if (pointsToAdd === 0) {
        message.warning("Nhập số điểm cần cộng/trừ");
        return;
      }
      // PUT /api/KhachHang/{id}/points
      await fetchJson(`/api/KhachHang/${selectedCustomer.idKhachHang}/points`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Points: pointsToAdd,
          Reason: v.reason || "Điều chỉnh thủ công",
        }),
      });
      message.success(
        `Đã ${pointsToAdd > 0 ? "cộng" : "trừ"} ${Math.abs(
          pointsToAdd
        )} điểm cho ${selectedCustomer.tenKhachHang}`
      );
      setAdjustModal(false);
      loadCustomers();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e.message || "Cập nhật điểm thất bại");
    }
  };

  const openEditTier = (tier: MembershipTier) => {
    setEditingTier(tier);
    tierForm.setFieldsValue({
      name: tier.name,
      minPoints: tier.minPoints,
      color: tier.color,
      benefits: tier.benefits,
      multiplier: tier.multiplier,
    });
    setTierModal(true);
  };

  const submitTier = async () => {
    try {
      const v = await tierForm.validateFields();
      const updated = tiers.map((t) =>
        t.name === editingTier?.name ? { ...t, ...v } : t
      );
      setTiers(updated);
      message.success("Đã cập nhật cấp bậc");
      setTierModal(false);
      // Reload customers để tính lại tier
      loadCustomers();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error("Cập nhật thất bại");
    }
  };

  const customerColumns: ColumnsType<CustomerLoyalty> = [
    { title: "Mã KH", dataIndex: "idKhachHang", key: "id", width: 120 },
    { title: "Tên khách hàng", dataIndex: "tenKhachHang", key: "name" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "SĐT", dataIndex: "soDienThoai", key: "phone", width: 130 },
    {
      title: "Điểm tích lũy",
      dataIndex: "tichDiem",
      key: "points",
      width: 130,
      sorter: (a, b) => a.tichDiem - b.tichDiem,
      render: (p) => <strong>{p}</strong>,
    },
    {
      title: "Cấp bậc",
      dataIndex: "tier",
      key: "tier",
      width: 120,
      render: (tier) => {
        const t = tiers.find((x) => x.name === tier);
        return <Tag color={t?.color || "default"}>{tier}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, c) => (
        <Button size="small" onClick={() => openAdjustPoints(c)}>
          Cộng/Trừ điểm
        </Button>
      ),
    },
  ];

  const tierColumns: ColumnsType<MembershipTier> = [
    {
      title: "Cấp bậc",
      dataIndex: "name",
      key: "name",
      width: 120,
      render: (n, t) => <Tag color={t.color}>{n}</Tag>,
    },
    {
      title: "Điểm tối thiểu",
      dataIndex: "minPoints",
      key: "minPoints",
      width: 150,
    },
    {
      title: "Hệ số tích lũy",
      dataIndex: "multiplier",
      key: "multiplier",
      width: 140,
      render: (m: number) => <strong>{m}x</strong>,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: (_, t) => (
        <Button size="small" onClick={() => openEditTier(t)}>
          Sửa
        </Button>
      ),
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: "24px 36px" }}>
          <Tabs
            defaultActiveKey="customers"
            items={[
              {
                key: "customers",
                label: "Danh sách khách hàng",
                children: (
                  <>
                    <Card style={{ marginBottom: 16 }}>
                      <Space wrap>
                        <Input.Search
                          placeholder="Tìm khách hàng (tên, email, SĐT, mã)"
                          style={{ width: 350 }}
                          value={keyword}
                          onChange={(e) => setKeyword(e.target.value)}
                        />
                        <Button onClick={loadCustomers}>Làm mới</Button>
                      </Space>
                    </Card>
                    <Card>
                      <DataTable
                        rowKey="idKhachHang"
                        columns={customerColumns}
                        dataSource={filtered}
                        loading={loading}
                      />
                    </Card>
                  </>
                ),
              },
              {
                key: "tiers",
                label: "Cấp bậc thành viên",
                children: (
                  <Card>
                    <Descriptions
                      title="Quy đổi & Đổi điểm"
                      bordered
                      style={{ marginBottom: 16 }}
                    >
                      <Descriptions.Item label="Tỉ lệ tích lũy">
                        <div>
                          Mỗi 10.000 VND chi tiêu = 1 điểm (Silver baseline)
                        </div>
                        {tiers.map((t) => (
                          <div key={t.name}>
                            - {t.name}: {t.multiplier}x
                          </div>
                        ))}
                      </Descriptions.Item>
                      <Descriptions.Item label="Quy đổi (đổi thưởng)">
                        <div>- Voucher 100.000₫ — 10 điểm</div>
                        <div>- Voucher 200.000₫ — 20 điểm</div>
                        <div>- Miễn phí 1 bữa sáng — 15 điểm</div>
                        <div>- Giảm 1 đêm phòng 20% — 40 điểm</div>
                        <div>- Miễn phí 1 đêm Standard — 100 điểm</div>
                        <div>- Giảm 1 đêm VIP 50% — 150 điểm</div>
                      </Descriptions.Item>
                    </Descriptions>
                    <DataTable
                      rowKey="name"
                      columns={tierColumns}
                      dataSource={tiers}
                      pagination={false}
                    />
                  </Card>
                ),
              },
            ]}
          />
        </main>
      </div>

      {/* Modal điều chỉnh điểm */}
      <Modal
        open={adjustModal}
        onCancel={() => setAdjustModal(false)}
        onOk={submitAdjustPoints}
        title={`Điều chỉnh điểm: ${selectedCustomer?.tenKhachHang}`}
      >
        <p>
          Điểm hiện tại: <strong>{selectedCustomer?.tichDiem || 0}</strong>
        </p>
        <Form form={form} layout="vertical">
          <Form.Item
            label="Số điểm cộng/trừ"
            name="points"
            rules={[{ required: true, message: "Nhập số điểm" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              placeholder="VD: 50 (cộng) hoặc -20 (trừ)"
            />
          </Form.Item>
          <Form.Item label="Lý do" name="reason">
            <Input.TextArea
              rows={2}
              placeholder="VD: Thưởng sinh nhật, điều chỉnh sai sót..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal chỉnh sửa tier */}
      <Modal
        open={tierModal}
        onCancel={() => setTierModal(false)}
        onOk={submitTier}
        title={`Chỉnh sửa: ${editingTier?.name}`}
      >
        <Form form={tierForm} layout="vertical">
          <Form.Item
            label="Tên cấp bậc"
            name="name"
            rules={[{ required: true }]}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            label="Điểm tối thiểu"
            name="minPoints"
            rules={[{ required: true }]}
          >
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
          <Form.Item
            label="Hệ số tích lũy"
            name="multiplier"
            rules={[{ required: true, message: "Nhập hệ số tích lũy" }]}
          >
            <InputNumber style={{ width: "100%" }} min={0.1} step={0.1} />
          </Form.Item>
          <Form.Item label="Màu sắc (hex)" name="color">
            <Input placeholder="#ffd700" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LoyaltyManager;
