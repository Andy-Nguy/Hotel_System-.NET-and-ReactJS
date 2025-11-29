import React, { useState } from 'react';
import Slidebar from './Slidebar';
import HeaderSection from './HeaderSection';
import { Card, Form, Input, Button, Select, Upload, Spin, Modal, message, Space } from 'antd';
import { UploadOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface BlogFormData {
  title: string;
  category: string;
  type: 'internal' | 'external';
  image: string; // cover image URL (after upload)
  date: string;
  excerpt: string;
  author: string;
  tags: string;
  content: string; // for internal
  images: string[]; // for internal gallery
  externalLink: string; // for external
  status: 'DRAFT' | 'PUBLISHED';
}

const BlogCreate: React.FC = () => {
  const [form] = Form.useForm();
  const [formData, setFormData] = useState<Partial<BlogFormData>>({
    type: 'internal',
    status: 'DRAFT',
    tags: '',
    images: [],
  });

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  const categories = ['Ẩm thực', 'Check-in', 'Tin tức', 'Địa điểm Xanh', 'Lưu trú Nghệ thuật', 'Khách sạn Sang Trọng', 'Cảnh báo khẩn cấp'];

  // ===== IMAGE UPLOAD HANDLERS =====
  
  // Handle cover image upload
  const handleCoverImageUpload = async (file: any) => {
    if (!file) return;
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const res = await fetch('/admin/blogs/upload-image', {
        method: 'POST',
        body: formDataUpload,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, image: data.url }));
        message.success('✔️ Ảnh cover được upload thành công');
      } else {
        const err = await res.text();
        message.error(`❌ Upload ảnh thất bại: ${err}`);
      }
    } catch (e) {
      console.error('Upload error:', e);
      message.error('❌ Lỗi upload ảnh cover');
    } finally {
      setUploading(false);
    }
  };

  // Handle gallery images upload (internal only)
  const handleGalleryUpload = async (file: any) => {
    if (!file) return;
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const res = await fetch('/admin/blogs/upload-image', {
        method: 'POST',
        body: formDataUpload,
      });

      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), data.url],
        }));
        message.success('✔️ Ảnh được thêm vào gallery');
      } else {
        message.error('❌ Upload ảnh gallery thất bại');
      }
    } catch (e) {
      console.error('Gallery upload error:', e);
      message.error('❌ Lỗi upload ảnh gallery');
    } finally {
      setUploading(false);
    }
  };

  // ===== VALIDATION HELPERS =====

  // Real-time validation
  const validateField = (fieldName: string, value: string): string | null => {
    switch (fieldName) {
      case 'title':
        if (!value?.trim()) return 'Tiêu đề là bắt buộc';
        if (value.trim().length < 3) return 'Tiêu đề phải có ít nhất 3 ký tự';
        return null;

      case 'category':
        if (!value?.trim()) return 'Danh mục là bắt buộc';
        return null;

      case 'image':
        if (!value?.trim()) return 'Ảnh cover là bắt buộc';
        return null;

      case 'externalLink':
        if (!value?.trim()) return 'Đường dẫn bên ngoài là bắt buộc';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Đường dẫn không hợp lệ (phải bắt đầu bằng http:// hoặc https://)';
        }

      case 'content':
        if (!value?.trim()) return 'Nội dung là bắt buộc cho loại bài viết nội bộ';
        return null;

      default:
        return null;
    }
  };

  // Show preview
  const handlePreview = () => {
    if (formData.type === 'internal') {
      setPreviewContent(`
        <div style="padding: 20px; background: #f5f5f5; font-family: Arial, sans-serif;">
          <h1 style="color: #333; margin-bottom: 10px;">${formData.title || 'Tiêu đề bài viết'}</h1>
          <div style="margin-bottom: 15px; font-size: 14px; color: #666;">
            <strong>Danh mục:</strong> ${formData.category || 'N/A'} | 
            <strong>Tác giả:</strong> ${formData.author || 'Admin'} | 
            <strong>Ngày:</strong> ${formData.date || new Date().toLocaleDateString('vi-VN')}
          </div>
          ${formData.image ? `<img src="${formData.image}" alt="cover" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 4px;">` : ''}
          <p style="font-style: italic; color: #555; margin: 15px 0;">${formData.excerpt || 'Không có mô tả'}</p>
          <div style="margin: 20px 0; line-height: 1.8; color: #333;">${formData.content || '<p>Nội dung bài viết sẽ hiển thị ở đây</p>'}</div>
          ${formData.images && formData.images.length > 0 ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #333;">Gallery:</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                ${formData.images.map(img => `<img src="${img}" alt="gallery" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px;">`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `);
    } else {
      setPreviewContent(`
        <div style="padding: 20px; background: #f5f5f5; font-family: Arial, sans-serif;">
          <h1 style="color: #333; margin-bottom: 10px;">${formData.title || 'Tiêu đề bài viết'}</h1>
          <div style="margin-bottom: 15px; font-size: 14px; color: #666;">
            <strong>Danh mục:</strong> ${formData.category || 'N/A'} | 
            <strong>Tác giả:</strong> ${formData.author || 'Admin'}
          </div>
          ${formData.image ? `<img src="${formData.image}" alt="cover" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 4px;">` : ''}
          <p style="font-style: italic; color: #555; margin: 15px 0;">${formData.excerpt || 'Không có mô tả'}</p>
          <div style="margin: 20px 0;">
            <a href="${formData.externalLink || '#'}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; font-size: 16px; text-decoration: underline; padding: 10px 20px; background: #e6f2ff; border-radius: 4px; display: inline-block;">
              🔗 Xem bài viết gốc
            </a>
          </div>
          <p style="color: #999; font-size: 12px;">URL: ${formData.externalLink || 'Link bài viết'}</p>
        </div>
      `);
    }
    setPreviewOpen(true);
  };

  // ===== FORM SUBMISSION =====
  
  // Submit form
  const handleSubmit = async () => {
    // Comprehensive validation
    const titleError = validateField('title', formData.title || '');
    if (titleError) {
      message.error(`❌ ${titleError}`);
      return;
    }

    const categoryError = validateField('category', formData.category || '');
    if (categoryError) {
      message.error(`❌ ${categoryError}`);
      return;
    }

    const imageError = validateField('image', formData.image || '');
    if (imageError) {
      message.error(`❌ ${imageError}`);
      return;
    }

    if (formData.type === 'internal') {
      const contentError = validateField('content', formData.content || '');
      if (contentError) {
        message.error(`❌ ${contentError}`);
        return;
      }
      if (!formData.images || formData.images.length === 0) {
        message.error('❌ Phải có ít nhất một ảnh gallery cho loại bài viết nội bộ');
        return;
      }
    } else if (formData.type === 'external') {
      const externalLinkError = validateField('externalLink', formData.externalLink || '');
      if (externalLinkError) {
        message.error(`❌ ${externalLinkError}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title?.trim(),
        category: formData.category?.trim(),
        type: formData.type,
        image: formData.image,
        date: formData.date?.trim() || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
        excerpt: formData.excerpt?.trim() || '',
        author: formData.author?.trim() || 'Admin',
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(t => t) : [],
        content: formData.content?.trim() || '',
        images: formData.images || [],
        externalLink: formData.externalLink?.trim() || '',
        status: formData.status || 'DRAFT',
      };

      const res = await fetch('/admin/blogs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        message.success('✔️ Tạo bài viết thành công!');
        // Navigate back to BlogManager
        setTimeout(() => {
          try {
            window.history.pushState(null, '', '/admin/blog');
            window.dispatchEvent(new PopStateEvent('popstate'));
          } catch {
            window.location.hash = '#/admin/blog';
          }
        }, 1500);
      } else {
        const errData = await res.json();
        const errorMsg = errData.error || errData.message || 'Lỗi không xác định';
        message.error(`❌ ${errorMsg}`);
      }
    } catch (e) {
      console.error('Submit error:', e);
      message.error('❌ Lỗi gửi bài viết. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: '0px 60px' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(2,6,23,0.06)' }}>
            <h2 style={{ marginBottom: 24 }}>Tạo Bài Viết Blog Mới</h2>

            <Spin spinning={uploading} tip="Đang upload ảnh...">
              <Card style={{ marginBottom: 20 }}>
                <Form layout="vertical" form={form}>
                  {/* Title */}
                  <Form.Item 
                    label="Tiêu đề *" 
                    required
                    help={formData.title && formData.title.length < 3 ? "Tiêu đề phải có ít nhất 3 ký tự" : ""}
                    validateStatus={formData.title && formData.title.length < 3 ? "warning" : ""}
                  >
                    <Input
                      placeholder="Nhập tiêu đề bài viết (tối thiểu 3 ký tự)"
                      value={formData.title || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      maxLength={200}
                    />
                  </Form.Item>

                  {/* Category */}
                  <Form.Item label="Danh mục *" required>
                    <Select
                      placeholder="Chọn danh mục"
                      value={formData.category || undefined}
                      onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                    >
                      {categories.map(cat => <Select.Option key={cat} value={cat}>{cat}</Select.Option>)}
                    </Select>
                  </Form.Item>

                  {/* Type */}
                  <Form.Item label="Loại bài viết *" required>
                    <Select
                      placeholder="Chọn loại"
                      value={formData.type || 'internal'}
                      onChange={(val) => setFormData(prev => ({ 
                        ...prev, 
                        type: val as 'internal' | 'external', 
                        images: [], 
                        content: '', 
                        externalLink: '' 
                      }))}
                    >
                      <Select.Option value="internal">Nội bộ (có nội dung + gallery)</Select.Option>
                      <Select.Option value="external">Bên ngoài (link ngoài)</Select.Option>
                    </Select>
                  </Form.Item>

                  {/* Cover Image */}
                  <Form.Item label="Ảnh Cover *" required>
                    <div style={{ marginBottom: 10 }}>
                      {formData.image && (
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img 
                            src={formData.image} 
                            alt="cover" 
                            style={{ maxWidth: 200, maxHeight: 150, marginBottom: 10, borderRadius: 4 }} 
                          />
                          <Button 
                            danger 
                            size="small" 
                            onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                            style={{ position: 'absolute', top: 0, right: 0 }}
                          >
                            Xóa
                          </Button>
                        </div>
                      )}
                    </div>
                    <Upload
                      maxCount={1}
                      accept="image/*"
                      beforeUpload={(file) => {
                        handleCoverImageUpload(file);
                        return false;
                      }}
                    >
                      <Button icon={<UploadOutlined />}>Upload Ảnh Cover</Button>
                    </Upload>
                  </Form.Item>

                  {/* Author & Date */}
                  <Form.Item label="Tác giả">
                    <Input
                      placeholder="Nhập tên tác giả (nếu không nhập, mặc định là 'Admin')"
                      value={formData.author || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      maxLength={100}
                    />
                  </Form.Item>

                  <Form.Item label="Ngày">
                    <Input
                      placeholder="vd: 20th November, 2025 hoặc 2025-11-20"
                      value={formData.date || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </Form.Item>

                  {/* Excerpt */}
                  <Form.Item label="Mô tả ngắn">
                    <Input.TextArea
                      placeholder="Nhập mô tả ngắn (optional)"
                      rows={3}
                      value={formData.excerpt || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                      maxLength={500}
                      showCount
                    />
                  </Form.Item>

                  {/* Tags */}
                  <Form.Item label="Tags (cách nhau bằng dấu phẩy)">
                    <Input
                      placeholder="vd: tag1, tag2, tag3"
                      value={formData.tags || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                    />
                  </Form.Item>

                  {/* Conditional rendering based on type */}
                  {formData.type === 'internal' ? (
                    <>
                      {/* Content */}
                      <Form.Item label="Nội dung *" required>
                        <Input.TextArea
                          placeholder="Nhập nội dung bài viết (HTML hoặc text)"
                          rows={10}
                          value={formData.content || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                        />
                      </Form.Item>

                      {/* Gallery Images */}
                      <Form.Item label="Ảnh Gallery *" required>
                        <div style={{ marginBottom: 10 }}>
                          {formData.images && formData.images.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                              {formData.images.map((img, idx) => (
                                <div key={idx} style={{ position: 'relative' }}>
                                  <img src={img} alt={`gallery-${idx}`} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4 }} />
                                  <Button
                                    danger
                                    size="small"
                                    onClick={() => setFormData(prev => ({
                                      ...prev,
                                      images: (prev.images || []).filter((_, i) => i !== idx),
                                    }))}
                                    style={{ position: 'absolute', top: 5, right: 5 }}
                                  >
                                    Xóa
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <Upload
                          maxCount={10}
                          beforeUpload={(file) => {
                            handleGalleryUpload(file);
                            return false;
                          }}
                        >
                          <Button icon={<UploadOutlined />}>Thêm ảnh vào Gallery</Button>
                        </Upload>
                      </Form.Item>
                    </>
                  ) : (
                    <>
                      {/* External Link */}
                      <Form.Item label="Đường dẫn bên ngoài *" required>
                        <Input
                          placeholder="vd: https://vnexpress.net/..."
                          value={formData.externalLink || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, externalLink: e.target.value }))}
                        />
                      </Form.Item>
                    </>
                  )}

                  {/* Status */}
                  <Form.Item label="Trạng thái">
                    <Select
                      value={formData.status || 'DRAFT'}
                      onChange={(val) => setFormData(prev => ({ ...prev, status: val as 'DRAFT' | 'PUBLISHED' }))}
                    >
                      <Select.Option value="DRAFT">Bản nháp</Select.Option>
                      <Select.Option value="PUBLISHED">Xuất bản</Select.Option>
                    </Select>
                  </Form.Item>

                  {/* Action Buttons */}
                  <Form.Item>
                    <Space>
                      <Button
                        type="primary"
                        onClick={handleSubmit}
                        loading={submitting}
                        disabled={uploading}
                      >
                        💾 Lưu Bài Viết
                      </Button>
                      <Button 
                        icon={<EyeOutlined />} 
                        onClick={handlePreview}
                        disabled={uploading || submitting}
                      >
                        👁️ Xem trước
                      </Button>
                      <Button 
                        onClick={() => {
                          try {
                            window.history.pushState(null, '', '/admin/blog');
                            window.dispatchEvent(new PopStateEvent('popstate'));
                          } catch {
                            window.location.hash = '#/admin/blog';
                          }
                        }}
                        disabled={uploading || submitting}
                      >
                        ↩️ Quay lại
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>
            </Spin>

            {/* Preview Modal - Fixed to use open instead of visible */}
            <Modal
              open={previewOpen}
              onCancel={() => setPreviewOpen(false)}
              footer={null}
              width={900}
              title="Xem trước bài viết"
              bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
            >
              <div dangerouslySetInnerHTML={{ __html: previewContent }} />
            </Modal>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BlogCreate;
