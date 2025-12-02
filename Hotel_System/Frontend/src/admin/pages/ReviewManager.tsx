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
  Select,
  Tooltip,
  Popconfirm,
  Form,
} from "antd";

import {
  CheckOutlined,
  DeleteOutlined,
  MessageOutlined,
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
  isResponded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const ReviewManager: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(""); // "" = all, "pending" = chờ duyệt, "approved" = đã duyệt
  const [responseFilter, setResponseFilter] = useState<string>(""); // "" = all, "not_responded" = chưa phản hồi, "responded" = đã phản hồi
  const [stats, setStats] = useState<any>(null);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // State cho form phản hồi/xin lỗi
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [responseReview, setResponseReview] = useState<Review | null>(null);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseForm] = Form.useForm();

  useEffect(() => {
    loadReviews();
    loadStats();
  }, []);

  useEffect(() => {
    loadReviews();
  }, [statusFilter, responseFilter]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const data = await reviewApi.getAllReviews({
        page: 1,
        pageSize: 50,
        status: statusFilter,
        keyword: keyword || "",
      });
      let filteredReviews = data.reviews || [];

      // Filter by response status (client-side for now)
      if (responseFilter === "not_responded") {
        filteredReviews = filteredReviews.filter(
          (r: Review) => (r.rating ?? 0) < 4 && !r.isResponded
        );
      } else if (responseFilter === "responded") {
        filteredReviews = filteredReviews.filter((r: Review) => r.isResponded);
      }

      setReviews(filteredReviews);
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
      ellipsis: true,
      render: (bookingId: string) => (
        <span title={bookingId} style={{ fontSize: 12 }}>
          {bookingId || <span style={{ color: "#999" }}>-</span>}
        </span>
      ),
    },
    {
      title: "Phòng",
      dataIndex: "roomName",
      key: "roomName",
      width: 130,
      ellipsis: true,
      render: (roomName: string, record: Review) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{roomName}</div>
          <small style={{ color: "#888", fontSize: 11 }}>
            {record.roomType}
          </small>
        </div>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      key: "customerName",
      width: 120,
      ellipsis: true,
    },
    {
      title: "Đánh giá",
      dataIndex: "rating",
      key: "rating",
      width: 110,
      render: (rating: number) => (
        <Rate disabled value={rating} style={{ fontSize: 12 }} />
      ),
    },
    {
      title: "Tiêu đề",
      dataIndex: "title",
      key: "title",
      width: 140,
      ellipsis: true,
    },
    {
      title: "Nội dung",
      dataIndex: "content",
      key: "content",
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <span title={text} style={{ fontSize: 13 }}>
          {text?.length > 30 ? `${text.substring(0, 30)}...` : text}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "isApproved",
      key: "isApproved",
      width: 100,
      align: "center" as const,
      render: (_: boolean, record: Review) => (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            alignItems: "center",
          }}
        >
          {record.isApproved ? (
            <Tag color="green" style={{ fontSize: 11, margin: 0 }}>
              Đã duyệt
            </Tag>
          ) : (
            <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>
              Chờ duyệt
            </Tag>
          )}
          {(record.rating ?? 0) < 4 &&
            (record.isResponded ? (
              <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>
                ✓ Đã phản hồi
              </Tag>
            ) : (
              <Tag color="red" style={{ fontSize: 10, margin: 0 }}>
                ⚠️ Cần phản hồi
              </Tag>
            ))}
        </div>
      ),
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 90,
      render: (date: string) => (
        <span style={{ whiteSpace: "nowrap", fontSize: 12 }}>
          {new Date(date).toLocaleDateString("vi-VN")}
        </span>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: "right" as const,
      width: 100,
      align: "center" as const,
      render: (_: any, record: Review) => (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: "flex", gap: 4, justifyContent: "center" }}
        >
          {!record.isApproved && (
            <Tooltip title="Duyệt đánh giá">
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => approveReview(record.id)}
              />
            </Tooltip>
          )}
          {(record.rating ?? 0) < 4 && !record.isResponded && (
            <Tooltip title="Gửi email phản hồi">
              <Button
                size="small"
                icon={<MessageOutlined />}
                style={{ borderColor: "#faad14", color: "#faad14" }}
                onClick={() => openResponseModal(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="Xóa đánh giá">
            <Popconfirm
              title="Xóa đánh giá?"
              description="Bạn có chắc chắn muốn xóa đánh giá này?"
              onConfirm={() => handleDeleteConfirm(record.id)}
              okText="Xóa"
              cancelText="Hủy"
              okType="danger"
            >
              <Button
                size="small"
                danger
                type="primary"
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
  ];

  const approveReview = async (id?: number) => {
    if (!id) return;
    try {
      console.log(`[approveReview] Calling API: /Review/${id}/approve`);
      const responseData = await reviewApi.approveReview(id);
      console.log(`[approveReview] Response data:`, responseData);

      message.success("Đánh giá được duyệt thành công");
      await loadReviews();
      await loadStats(); // Reload stats sau khi duyệt
    } catch (e: any) {
      console.error("[approveReview] Error:", e);
      message.error(e?.message || "Duyệt đánh giá thất bại");
    }
  };

  const handleDeleteConfirm = async (id?: number) => {
    if (!id) return;
    try {
      await reviewApi.deleteReview(id);
      message.success("Đánh giá được xóa thành công");
      await loadReviews();
      await loadStats();
    } catch (e) {
      console.error("[handleDeleteConfirm] Error:", e);
      message.error("Xóa đánh giá thất bại");
    }
  };

  // Mở modal phản hồi
  const openResponseModal = (review: Review) => {
    setResponseReview(review);
    responseForm.setFieldsValue({
      issueDescription: "",
      actionTaken: "",
      compensation: "",
      senderName: "Quản lý Chăm sóc Khách hàng",
    });
    setResponseModalVisible(true);
  };

  // Gửi email phản hồi
  const handleSendResponse = async (values: any) => {
    if (!responseReview || !responseReview.id) return;
    setResponseLoading(true);
    try {
      await reviewApi.respondToReview(responseReview.id, {
        issueDescription: values.issueDescription,
        actionTaken: values.actionTaken,
        compensation: values.compensation,
        senderName: values.senderName,
      });

      message.success("Đã gửi email phản hồi thành công");
      setResponseModalVisible(false);
      responseForm.resetFields();
      await loadReviews(); // Reload để cập nhật trạng thái isResponded
    } catch (e: any) {
      console.error("[handleSendResponse] Error:", e);
      message.error(e?.message || "Gửi phản hồi thất bại");
    } finally {
      setResponseLoading(false);
    }
  };

  const getApprovalStats = () => {
    if (!reviews) return { approved: 0, pending: 0, needResponse: 0 };
    const approved = reviews.filter((r) => r.isApproved === true).length;
    const pending = reviews.filter((r) => r.isApproved === false).length;
    const needResponse = reviews.filter(
      (r) => (r.rating ?? 0) < 4 && !r.isResponded
    ).length;
    return { approved, pending, needResponse };
  };

  const { approved, pending, needResponse } = getApprovalStats();

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
                <Card>
                  <div style={{ textAlign: "center" }}>
                    <Badge
                      count={needResponse}
                      style={{ backgroundColor: "#ff4d4f" }}
                      offset={[-5, 5]}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 600,
                          color: "#ff4d4f",
                        }}
                      >
                        {needResponse}
                      </div>
                    </Badge>
                    <div style={{ color: "#666", marginTop: 4 }}>
                      Cần phản hồi
                    </div>
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
                <Select
                  placeholder="Trạng thái duyệt"
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value)}
                  style={{ width: 150 }}
                  options={[
                    { label: "Tất cả", value: "" },
                    { label: "Chờ duyệt", value: "pending" },
                    { label: "Đã duyệt", value: "approved" },
                  ]}
                />
                <Select
                  placeholder="Trạng thái phản hồi"
                  value={responseFilter}
                  onChange={(value) => setResponseFilter(value)}
                  style={{ width: 160 }}
                  options={[
                    { label: "Tất cả", value: "" },
                    { label: "⚠️ Chưa phản hồi", value: "not_responded" },
                    { label: "✓ Đã phản hồi", value: "responded" },
                  ]}
                />
                <Button onClick={loadReviews}>Tải lại</Button>
              </Space>
            </Card>

            {/* Table */}
            <Card bodyStyle={{ padding: 0 }}>
              <Spin spinning={loading}>
                <Table
                  dataSource={reviews}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: "max-content" }}
                  size="small"
                  onRow={(record) => ({
                    onClick: () => {
                      setSelectedReview(record);
                      setDetailModalVisible(true);
                    },
                    style: { cursor: "pointer" },
                  })}
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
                    <strong>Phòng:</strong> {selectedReview.roomName} (
                    {selectedReview.roomType})
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
                    <strong>Trạng thái duyệt:</strong>{" "}
                    {selectedReview.isApproved ? (
                      <Tag color="green">Đã duyệt</Tag>
                    ) : (
                      <Tag color="orange">Chờ duyệt</Tag>
                    )}
                  </div>
                  {(selectedReview.rating ?? 0) < 4 && (
                    <div style={{ marginBottom: 12 }}>
                      <strong>Trạng thái phản hồi:</strong>{" "}
                      {selectedReview.isResponded ? (
                        <Tag color="blue">✓ Đã phản hồi qua email</Tag>
                      ) : (
                        <Tag color="red">⚠️ Cần phản hồi</Tag>
                      )}
                    </div>
                  )}
                  <div>
                    <strong>Ngày tạo:</strong>{" "}
                    {new Date(selectedReview.createdAt || "").toLocaleString(
                      "vi-VN"
                    )}
                  </div>
                </div>
              )}
            </Modal>

            {/* Response/Apology Modal */}
            <Modal
              title="📧 Phản hồi đánh giá khách hàng"
              open={responseModalVisible}
              onCancel={() => {
                setResponseModalVisible(false);
                responseForm.resetFields();
              }}
              footer={null}
              width={700}
            >
              {responseReview && (
                <div>
                  {/* Thông tin đánh giá */}
                  <div
                    style={{
                      background: "#f5f5f5",
                      padding: 16,
                      borderRadius: 8,
                      marginBottom: 20,
                    }}
                  >
                    <h4 style={{ marginBottom: 12, color: "#666" }}>
                      📝 Nội dung đánh giá:
                    </h4>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Khách hàng:</strong> {responseReview.customerName}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Phòng:</strong> {responseReview.roomName}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Đánh giá:</strong>{" "}
                      <Rate
                        disabled
                        value={responseReview.rating}
                        style={{ fontSize: 14 }}
                      />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <strong>Tiêu đề:</strong> {responseReview.title}
                    </div>
                    <div
                      style={{
                        background: "#fff",
                        padding: 12,
                        borderRadius: 4,
                        borderLeft: "3px solid #faad14",
                        fontStyle: "italic",
                      }}
                    >
                      "{responseReview.content}"
                    </div>
                  </div>

                  {/* Form phản hồi */}
                  <Form
                    form={responseForm}
                    layout="vertical"
                    onFinish={handleSendResponse}
                  >
                    <Form.Item
                      name="issueDescription"
                      label="📋 Mô tả vấn đề đã ghi nhận"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập mô tả vấn đề",
                        },
                      ]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Ví dụ: Phòng không được dọn sạch, thiết bị điều hòa gặp trục trặc..."
                      />
                    </Form.Item>

                    <Form.Item
                      name="actionTaken"
                      label="✅ Hành động khắc phục đã thực hiện"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập hành động khắc phục",
                        },
                      ]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Ví dụ: Đã kiểm tra và sửa chữa thiết bị, nhắc nhở nhân viên về quy trình vệ sinh..."
                      />
                    </Form.Item>

                    {/* <Form.Item
                      name="compensation"
                      label="🎁 Ưu đãi bồi thường (mỗi dòng một ưu đãi)"
                      rules={[{ required: true, message: 'Vui lòng nhập ưu đãi bồi thường' }]}
                    >
                      <Input.TextArea
                        rows={4}
                        placeholder={`Ví dụ:
Voucher giảm 20% cho lần đặt phòng tiếp theo
Miễn phí upgrade phòng trong 6 tháng  
Miễn phí dịch vụ spa trị giá 500.000đ`}
                      />
                    </Form.Item> */}

                    <Form.Item
                      name="senderName"
                      label="👤 Tên người gửi"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập tên người gửi",
                        },
                      ]}
                    >
                      <Input placeholder="Ví dụ: Nguyễn Văn A" />
                    </Form.Item>

                    <div
                      style={{
                        background: "#fff7e6",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 16,
                        border: "1px solid #ffd591",
                      }}
                    >
                      <strong>💡 Lưu ý:</strong>
                      <ul
                        style={{
                          margin: "8px 0 0 20px",
                          fontSize: 13,
                          color: "#666",
                        }}
                      >
                        <li>Email sẽ được gửi trực tiếp đến khách hàng</li>
                        <li>
                          Nội dung cần lịch sự, chuyên nghiệp và thể hiện sự
                          thấu hiểu
                        </li>
                        <li>Ưu đãi bồi thường nên phù hợp với mức độ sự cố</li>
                      </ul>
                    </div>

                    <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                      <Space>
                        <Button
                          onClick={() => {
                            setResponseModalVisible(false);
                            responseForm.resetFields();
                          }}
                        >
                          Hủy
                        </Button>
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={responseLoading}
                          style={{ background: "#C9A043" }}
                        >
                          📧 Gửi email phản hồi
                        </Button>
                      </Space>
                    </Form.Item>
                  </Form>
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
