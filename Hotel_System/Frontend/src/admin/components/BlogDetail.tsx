import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Tag, Spin, message, Input, Divider, Card, Row, Col } from 'antd';
import { EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, EyeOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';

interface BlogPost {
  id: number;
  title: string;
  slug?: string;
  category: string;
  type: 'internal' | 'external';
  image: string;
  date: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  content?: string;
  images?: string[];
  externalLink?: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'HIDDEN' | 'DELETED' | 'ARCHIVED';
  viewCount?: number;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface BlogDetailProps {
  visible: boolean;
  blog: BlogPost | null;
  onClose: () => void;
  onApprove?: (id: number) => void;
  onReject?: (id: number, reason: string) => void;
  onPublish?: (id: number) => void;
  onHide?: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
}

const BlogDetail: React.FC<BlogDetailProps> = ({
  visible,
  blog,
  onClose,
  onApprove,
  onReject,
  onPublish,
  onHide,
  onEdit,
  onDelete,
}) => {
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!blog) return null;

  const getStatusColor = (status: string) => {
    const colorMap: any = {
      DRAFT: 'default',
      PENDING: 'processing',
      APPROVED: 'success',
      REJECTED: 'error',
      PUBLISHED: 'green',
      HIDDEN: 'warning',
      ARCHIVED: 'default',
      DELETED: 'red',
    };
    return colorMap[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const labels: any = {
      DRAFT: 'Bản nháp',
      PENDING: 'Chờ duyệt',
      APPROVED: 'Đã duyệt',
      REJECTED: 'Từ chối',
      PUBLISHED: 'Đã xuất bản',
      HIDDEN: 'Ẩn',
      ARCHIVED: 'Lưu trữ',
      DELETED: 'Đã xóa',
    };
    return labels[status] || status;
  };

  const handleApprove = async () => {
    if (!onApprove) return;
    setLoading(true);
    try {
      await onApprove(blog.id);
      message.success('✔️ Bài viết đã được duyệt');
      onClose();
    } catch (error) {
      message.error('❌ Lỗi duyệt bài viết');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!onReject || !rejectReason.trim()) {
      message.error('❌ Vui lòng nhập lý do từ chối');
      return;
    }
    setLoading(true);
    try {
      await onReject(blog.id, rejectReason);
      message.success('✔️ Bài viết đã bị từ chối');
      setShowRejectForm(false);
      setRejectReason('');
      onClose();
    } catch (error) {
      message.error('❌ Lỗi từ chối bài viết');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!onPublish) return;
    setLoading(true);
    try {
      await onPublish(blog.id);
      message.success('✔️ Bài viết đã được xuất bản');
      onClose();
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || error?.message || 'Lỗi xuất bản bài viết';
      message.error(`❌ ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleHide = async () => {
    if (!onHide) return;
    setLoading(true);
    try {
      await onHide(blog.id);
      message.success('✔️ Bài viết đã bị ẩn');
      onClose();
    } catch (error) {
      message.error('❌ Lỗi ẩn bài viết');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm('Bạn chắc chắn muốn xóa bài viết này?')) return;
    setLoading(true);
    try {
      await onDelete(blog.id);
      message.success('✔️ Bài viết đã bị xóa');
      onClose();
    } catch (error) {
      message.error('❌ Lỗi xóa bài viết');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={1000}
      title={`Chi tiết bài viết: ${blog.title}`}
      footer={null}
      bodyStyle={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      <Spin spinning={loading}>
        {/* Status Badge */}
        <div style={{ marginBottom: 16 }}>
          <Tag color={getStatusColor(blog.status)}>{getStatusLabel(blog.status)}</Tag>
          {blog.viewCount !== undefined && (
            <Tag icon={<EyeOutlined />} style={{ marginLeft: 8 }}>
              {blog.viewCount} lượt xem
            </Tag>
          )}
        </div>

        {/* Cover Image */}
        {blog.image && (
          <div style={{ marginBottom: 16 }}>
            <img
              src={blog.image}
              alt={blog.title}
              style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 8 }}
            />
          </div>
        )}

        {/* Metadata */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 8 }}>
                <strong>Danh mục:</strong> {blog.category}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Tác giả:</strong> {blog.author || 'Admin'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Slug:</strong> <code>{blog.slug}</code>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 8 }}>
                <strong>Loại:</strong> {blog.type === 'internal' ? 'Nội bộ' : 'Bên ngoài'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Ngày:</strong> {blog.date || 'N/A'}
              </div>
              {blog.type === 'external' && blog.externalLink && (
                <div style={{ marginBottom: 8 }}>
                  <strong>Link ngoài:</strong>{' '}
                  <a href={blog.externalLink} target="_blank" rel="noopener noreferrer">
                    {blog.externalLink}
                  </a>
                </div>
              )}
            </Col>
          </Row>
        </Card>

        {/* Excerpt */}
        {blog.excerpt && (
          <Card style={{ marginBottom: 16 }}>
            <strong>Mô tả ngắn:</strong>
            <p style={{ marginTop: 8, fontStyle: 'italic', color: '#666' }}>{blog.excerpt}</p>
          </Card>
        )}

        {/* Tags */}
        {blog.tags && blog.tags.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <strong>Tags:</strong>
            <div style={{ marginTop: 8 }}>
              {blog.tags.map((tag, idx) => (
                <Tag key={idx}>{tag}</Tag>
              ))}
            </div>
          </Card>
        )}

        {/* Content (for internal blogs) */}
        {blog.type === 'internal' && blog.content && (
          <Card style={{ marginBottom: 16 }}>
            <strong>Nội dung:</strong>
            <div
              style={{ marginTop: 8, lineHeight: 1.8, color: '#333' }}
              dangerouslySetInnerHTML={{ __html: blog.content }}
            />
          </Card>
        )}

        {/* Gallery Images (for internal blogs) */}
        {blog.type === 'internal' && blog.images && blog.images.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <strong>Gallery:</strong>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {blog.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`Gallery ${idx}`}
                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4 }}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Rejection Reason (if rejected) */}
        {blog.status === 'REJECTED' && blog.rejectionReason && (
          <Card style={{ marginBottom: 16, backgroundColor: '#fff1f0' }}>
            <strong style={{ color: '#cf1322' }}>Lý do từ chối:</strong>
            <p style={{ marginTop: 8, color: '#cf1322' }}>{blog.rejectionReason}</p>
          </Card>
        )}

        {/* Timestamps */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: '#666' }}>
                <strong>Tạo lúc:</strong> {blog.createdAt ? new Date(blog.createdAt).toLocaleString('vi-VN') : 'N/A'}
              </div>
              {blog.approvedAt && (
                <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>
                  <strong>Duyệt lúc:</strong> {new Date(blog.approvedAt).toLocaleString('vi-VN')}
                </div>
              )}
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: '#666' }}>
                <strong>Cập nhật lúc:</strong> {blog.updatedAt ? new Date(blog.updatedAt).toLocaleString('vi-VN') : 'N/A'}
              </div>
              {blog.rejectedAt && (
                <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                  <strong>Từ chối lúc:</strong> {new Date(blog.rejectedAt).toLocaleString('vi-VN')}
                </div>
              )}
            </Col>
          </Row>
        </Card>

        {/* Action Buttons */}
        <Divider />

        {showRejectForm ? (
          <Card style={{ marginBottom: 16, backgroundColor: '#fef3c7' }}>
            <strong>Lý do từ chối:</strong>
            <Input.TextArea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              rows={3}
              style={{ marginTop: 8 }}
            />
            <Space style={{ marginTop: 12 }}>
              <Button type="primary" danger onClick={handleRejectSubmit} loading={loading}>
                Xác nhận từ chối
              </Button>
              <Button onClick={() => { setShowRejectForm(false); setRejectReason(''); }}>
                Hủy
              </Button>
            </Space>
          </Card>
        ) : null}

        <Space wrap style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {/* Approve button */}
          {(blog.status === 'PENDING' || blog.status === 'REJECTED') && onApprove && (
            <Button type="primary" icon={<CheckOutlined />} onClick={handleApprove} loading={loading}>
              Duyệt
            </Button>
          )}

          {/* Reject button */}
          {(blog.status === 'PENDING' || blog.status === 'APPROVED') && onReject && (
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => setShowRejectForm(!showRejectForm)}
              loading={loading}
            >
              Từ chối
            </Button>
          )}

          {/* Publish button */}
          {blog.status === 'APPROVED' && onPublish && (
            <Button type="primary" icon={<CheckOutlined />} onClick={handlePublish} loading={loading}>
              Xuất bản
            </Button>
          )}

          {/* Hide button */}
          {blog.status === 'PUBLISHED' && onHide && (
            <Button icon={<LockOutlined />} onClick={handleHide} loading={loading}>
              Ẩn
            </Button>
          )}

          {/* Unhide button (show if hidden) */}
          {blog.status === 'HIDDEN' && onPublish && (
            <Button type="primary" icon={<UnlockOutlined />} onClick={handlePublish} loading={loading}>
              Hiển thị lại
            </Button>
          )}

          {/* Edit button */}
          {onEdit && (
            <Button icon={<EditOutlined />} onClick={() => onEdit(blog.id)}>
              Chỉnh sửa
            </Button>
          )}

          {/* Delete button */}
          {onDelete && (
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete} loading={loading}>
              Xóa
            </Button>
          )}

          {/* Close button */}
          <Button onClick={onClose}>
            Đóng
          </Button>
        </Space>
      </Spin>
    </Modal>
  );
};

export default BlogDetail;
