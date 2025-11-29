import React, { useEffect, useState } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import {
  Button,
  Card,
  Input,
  Table,
  message,
  Space,
  Modal,
  Rate,
  Tag,
  Spin,
  Badge,
} from "antd";

// Resolve API base from Vite env
const _VITE_API = (import.meta as any).env?.VITE_API_URL || "";
const API_BASE = _VITE_API.replace(/\/$/, "")
  ? `${_VITE_API.replace(/\/$/, "")}/api`
  : "/api";
import {
  CheckOutlined,
  DeleteOutlined,
  EyeOutlined,
  MailOutlined,
} from "@ant-design/icons";
import reviewApi from "../../api/review.Api";

interface Review {
  id?: number;
  bookingId?: string;
  roomId?: string;
  roomName?: string;
  roomType?: string;
  customerId?: number;
  customerName?: string;
  rating?: number;
  title?: string;
  content?: string;
  isAnonym?: boolean;
  isApproved?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const ReviewManager: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadReviews();
    loadStats();
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/Review?page=1&pageSize=50&status=${keyword ? '' : 'pending'}&keyword=${keyword || ''}`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (e: any) {
      message.error(e?.message || "Không thể tải danh sách đánh giá");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await reviewApi.getRatingStats();
      setStats(stats);
    } catch (e: any) {
      console.warn("Failed to load stats:", e);
    }
  };

  const columns = [
    {
      title: "Mã ĐP",
      dataIndex: "bookingId",
      key: "bookingId",
      width: 100,
    },
    {
      title: "Phòng",
      dataIndex: "roomName",
      key: "roomName",
      width: 120,
      render: (roomName: string, record: Review) => (
        <div>
          <div>{roomName}</div>
          <small style={{ color: '#666' }}>{record.roomType}</small>
        </div>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      key: "customerName",
      width: 150,
    },
    {
      title: "Đánh giá",
      dataIndex: "rating",
      key: "rating",
      width: 120,
      render: (rating: number) => <Rate disabled value={rating} />,
    },
    {
      title: "Tiêu đề",
      dataIndex: "title",
      key: "title",
      width: 200,
    },
    {
      title: "Nội dung",
      dataIndex: "content",
      key: "content",
      render: (text: string) => (
        <span title={text} style={{ maxWidth: 200 }}>
          {text?.substring(0, 50)}...
        </span>
      ),
    },
    {
      title: "Ẩn danh",
      dataIndex: "isAnonym",
      key: "isAnonym",
      render: (isAnonym: boolean) =>
        isAnonym ? <Tag color="blue">Ẩn danh</Tag> : <Tag>Công khai</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isApproved",
      key: "isApproved",
      render: (isApproved: boolean) =>
        isApproved ? (
          <Tag color="green">Đã duyệt</Tag>
        ) : (
          <Tag color="orange">Chờ duyệt</Tag>
        ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleDateString("vi-VN"),
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: "right" as const,
      width: 150,
      render: (_: any, record: Review) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedReview(record);
              setDetailModalVisible(true);
            }}
          >
            Xem
          </Button>
          {!record.isApproved && (
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => approveReview(record.id)}
            >
              Duyệt
            </Button>
          )}
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteReview(record.id)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  const approveReview = async (id?: number) => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE}/Review/${id}/approve`, { method: "PUT" });
      if (!response.ok) throw new Error('Failed to approve review');
      message.success("Đánh giá được duyệt thành công");
      await loadReviews();
    } catch (e) {
      message.error("Duyệt đánh giá thất bại");
    }
  };

  const deleteReview = (id?: number) => {
    if (!id) return;
    Modal.confirm({
      title: "Xóa đánh giá",
      content: "Bạn có chắc chắn muốn xóa đánh giá này?",
      onOk: async () => {
        try {
          const response = await fetch(`${API_BASE}/Review/${id}`, { method: "DELETE" });
          if (!response.ok) throw new Error('Failed to delete review');
          message.success("Đánh giá được xóa thành công");
          await loadReviews();
        } catch (e) {
          message.error("Xóa đánh giá thất bại");
        }
      },
    });
  };

  const getApprovalStats = () => {
    if (!reviews) return { approved: 0, pending: 0 };
    const approved = reviews.filter((r) => r.isApproved === true).length;
    const pending = reviews.filter((r) => r.isApproved === false).length;
    return { approved, pending };
  };

  const { approved, pending } = getApprovalStats();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: "0px 60px" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              boxShadow: "0 8px 24px rgba(2,6,23,0.06)",
            }}
          >
            <h2 style={{ marginBottom: 16 }}>Quản lý đánh giá khách hàng</h2>

            {/* Stats Cards */}
            {stats && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <Card>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 600,
                        color: "#667eea",
                      }}
                    >
                      {stats.totalReviews || 0}
                    </div>
                    <div style={{ color: "#666", marginTop: 4 }}>
                      Tổng đánh giá
                    </div>
                  </div>
                </Card>
                <Card>
                  <div style={{ textAlign: "center" }}>
                    <Rate
                      disabled
                      value={stats.averageRating || 0}
                      style={{ fontSize: 24 }}
                    />
                    <div style={{ color: "#666", marginTop: 4 }}>
                      Điểm trung bình: {stats.averageRating?.toFixed(1)}
                    </div>
                  </div>
                </Card>
                <Card>
                  <div style={{ textAlign: "center" }}>
                    <Badge
                      count={pending}
                      style={{ backgroundColor: "#faad14" }}
                      offset={[-5, 5]}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 600,
                          color: "#faad14",
                        }}
                      >
                        {pending}
                      </div>
                    </Badge>
                    <div style={{ color: "#666", marginTop: 4 }}>Chờ duyệt</div>
                  </div>
                </Card>
                <Card>
                  <div style={{ textAlign: "center" }}>
                    <Badge
                      count={approved}
                      style={{ backgroundColor: "#52c41a" }}
                      offset={[-5, 5]}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 600,
                          color: "#52c41a",
                        }}
                      >
                        {approved}
                      </div>
                    </Badge>
                    <div style={{ color: "#666", marginTop: 4 }}>Đã duyệt</div>
                  </div>
                </Card>
              </div>
            )}

            {/* Filter */}
            <Card style={{ marginBottom: 12 }}>
              <Space wrap>
                <Input.Search
                  placeholder="Tìm kiếm mã đặt phòng..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  style={{ width: 200 }}
                />
                <Button onClick={loadReviews}>Tải lại</Button>
              </Space>
            </Card>

            {/* Table */}
            <Card>
              <Spin spinning={loading}>
                <Table
                  dataSource={reviews}
                  columns={columns}
                  rowKey="IDDanhGia"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 1200 }}
                />
              </Spin>
            </Card>

            {/* Detail Modal */}
            <Modal
              title="Chi tiết đánh giá"
              open={detailModalVisible}
              onCancel={() => setDetailModalVisible(false)}
              footer={[
                <Button
                  key="close"
                  onClick={() => setDetailModalVisible(false)}
                >
                  Đóng
                </Button>,
              ]}
            >
              {selectedReview && (
                <div style={{ lineHeight: 1.8 }}>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Mã đặt phòng:</strong> {selectedReview.bookingId}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Phòng:</strong> {selectedReview.roomName} ({selectedReview.roomType})
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Khách hàng:</strong> {selectedReview.customerName}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Đánh giá:</strong>{" "}
                    <Rate disabled value={selectedReview.rating} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Tiêu đề:</strong> {selectedReview.title}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Nội dung:</strong>
                    <div
                      style={{
                        background: "#f5f5f5",
                        padding: 12,
                        borderRadius: 4,
                        marginTop: 4,
                      }}
                    >
                      {selectedReview.content}
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Ẩn danh:</strong>{" "}
                    {selectedReview.isAnonym ? "Có" : "Không"}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <strong>Trạng thái:</strong>{" "}
                    {selectedReview.isApproved ? (
                      <Tag color="green">Đã duyệt</Tag>
                    ) : (
                      <Tag color="orange">Chờ duyệt</Tag>
                    )}
                  </div>
                  <div>
                    <strong>Ngày tạo:</strong>{" "}
                    {new Date(selectedReview.createdAt || "").toLocaleString(
                      "vi-VN"
                    )}
                  </div>
                </div>
              )}
            </Modal>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReviewManager;
