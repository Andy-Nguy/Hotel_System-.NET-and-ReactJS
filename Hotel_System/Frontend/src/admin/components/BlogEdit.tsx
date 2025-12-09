import React, { useState, useEffect } from "react";
import Slidebar from "./Slidebar";
import HeaderSection from "./HeaderSection";
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Upload,
  Spin,
  Modal,
  message,
  Space,
  Alert,
} from "antd";
import { UploadOutlined, EyeOutlined } from "@ant-design/icons";
import blogApi from "../../api/blogApi";

interface BlogFormData {
  id?: number;
  title: string;
  category: string;
  type: "internal" | "external";
  image: string;
  date: string;
  excerpt: string;
  author: string;
  tags: string;
  content: string;
  images: string[];
  externalLink: string;
  status:
    | "DRAFT"
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "PUBLISHED"
    | "HIDDEN"
    | "ARCHIVED"
    | "DELETED";
  slug?: string;
  rejectionReason?: string;
}

const BlogEdit: React.FC = () => {
  const [form] = Form.useForm();
  const [formData, setFormData] = useState<Partial<BlogFormData> | null>(null); // Start as null
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [originalData, setOriginalData] =
    useState<Partial<BlogFormData> | null>(null); // Track original data

  const categories = [
    "Ẩm thực",
    "Check-in",
    "Tin tức",
    "Địa điểm Xanh",
    "Lưu trú Nghệ thuật",
    "Khách sạn Sang Trọng",
    "Cảnh báo khẩn cấp",
  ];

  // Load blog data from URL ID
  useEffect(() => {
    const getBlogId = (): string | null => {
      try {
        const p = window.location.pathname;
        const m = p.match(/\/admin\/blog\/edit\/([^/]+)/);
        if (m) return m[1];
      } catch {}
      try {
        const h = window.location.hash;
        const m = h.match(/\/admin\/blog\/edit\/([^/]+)/);
        if (m) return m[1];
      } catch {}
      return null;
    };

    const blogId = getBlogId();
    if (!blogId) {
      message.error("❌ Không tìm thấy ID bài viết");
      setTimeout(() => navigateToManager(), 2000);
      return;
    }

    const fetchBlog = async () => {
      try {
        const data = await blogApi.getBlogBySlug(blogId);
        const initialData = {
          id: data.id,
          title: data.title || "",
          category: data.category || "",
          type: data.type || "internal",
          image: data.image || "",
          date: data.date || "",
          excerpt: data.excerpt || "",
          author: data.author || "",
          tags: Array.isArray(data.tags)
            ? data.tags.join(", ")
            : data.tags || "",
          content: data.content || "",
          images: data.images || [],
          externalLink: data.externalLink || "",
          status: data.status || "DRAFT",
          slug: data.slug || "",
          rejectionReason: data.rejectionReason || "",
        };
        setOriginalData(initialData);
        setFormData(initialData);
      } catch (e) {
        console.error("Fetch error:", e);
        message.error("❌ Không tải được bài viết");
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, []);

  // ===== IMAGE UPLOAD HANDLERS =====

  const handleCoverImageUpload = async (file: any) => {
    if (!file || !formData) return;
    setUploading(true);
    try {
      const title = formData.title || "";
      // If existing cover is a local server path, upload replacing same filename
      if (formData.image && formData.image.startsWith("/img/blog/")) {
        const replacePath = formData.image; // backend will overwrite this file
          const data = await blogApi.uploadBlogImage(file, title, "banner", replacePath);
          setFormData((prev) => (prev ? { ...prev, image: data.url } : null));
      } else {
          const data = await blogApi.uploadBlogImage(file, title, "banner");
          setFormData((prev) => (prev ? { ...prev, image: data.url } : null));
      }
      message.success("✔️ Ảnh cover được upload thành công");
    } catch (e) {
      console.error("Upload error:", e);
      message.error("❌ Lỗi upload ảnh cover");
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (file: any) => {
    if (!file || !formData) return;
    setUploading(true);
    try {
      const title = formData.title || "blog";
      const data = await blogApi.uploadBlogImage(file, title, "gallery");
      setFormData((prev) =>
        prev
          ? {
              ...prev,
              images: [...(prev.images || []), data.url],
            }
          : null
      );
      message.success("✔️ Ảnh được thêm vào gallery");
    } catch (e) {
      console.error("Gallery upload error:", e);
      message.error("❌ Lỗi upload ảnh gallery");
    } finally {
      setUploading(false);
    }
  };

  // ===== VALIDATION HELPERS =====

  const validateField = (fieldName: string, value: string): string | null => {
    switch (fieldName) {
      case "title":
        if (!value?.trim()) return "Tiêu đề là bắt buộc";
        if (value.trim().length < 3) return "Tiêu đề phải có ít nhất 3 ký tự";
        return null;

      case "category":
        if (!value?.trim()) return "Danh mục là bắt buộc";
        return null;

      case "image":
        if (!value?.trim()) return "Ảnh cover là bắt buộc";
        return null;

      case "externalLink":
        if (!value?.trim()) return "Đường dẫn bên ngoài là bắt buộc";
        try {
          new URL(value);
          return null;
        } catch {
          return "Đường dẫn không hợp lệ (phải bắt đầu bằng http:// hoặc https://)";
        }

      case "content":
        if (!value?.trim())
          return "Nội dung là bắt buộc cho loại bài viết nội bộ";
        return null;

      default:
        return null;
    }
  };

  // Show preview
  const handlePreview = () => {
    if (!formData) return;

    if (formData.type === "internal") {
      setPreviewContent(`
        <div style="padding: 20px; background: #f5f5f5; font-family: Arial, sans-serif;">
          <h1 style="color: #333; margin-bottom: 10px;">${
            formData.title || "Tiêu đề bài viết"
          }</h1>
          <div style="margin-bottom: 15px; font-size: 14px; color: #666;">
            <strong>Danh mục:</strong> ${formData.category || "N/A"} | 
            <strong>Tác giả:</strong> ${formData.author || "Admin"} | 
            <strong>Ngày:</strong> ${
              formData.date || new Date().toLocaleDateString("vi-VN")
            }
          </div>
          ${
            formData.image
              ? `<img src="${formData.image}" alt="cover" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 4px;">`
              : ""
          }
          <p style="font-style: italic; color: #555; margin: 15px 0;">${
            formData.excerpt || "Không có mô tả"
          }</p>
          <div style="margin: 20px 0; line-height: 1.8; color: #333;">${
            formData.content || "<p>Nội dung bài viết sẽ hiển thị ở đây</p>"
          }</div>
          ${
            formData.images && formData.images.length > 0
              ? `
            <div style="margin: 20px 0;">
              <h3 style="color: #333;">Gallery:</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                ${formData.images
                  .map(
                    (img) =>
                      `<img src="${img}" alt="gallery" style="width: 100%; height: 150px; object-fit: cover; border-radius: 4px;">`
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        </div>
      `);
    } else {
      setPreviewContent(`
        <div style="padding: 20px; background: #f5f5f5; font-family: Arial, sans-serif;">
          <h1 style="color: #333; margin-bottom: 10px;">${
            formData.title || "Tiêu đề bài viết"
          }</h1>
          <div style="margin-bottom: 15px; font-size: 14px; color: #666;">
            <strong>Danh mục:</strong> ${formData.category || "N/A"} | 
            <strong>Tác giả:</strong> ${formData.author || "Admin"}
          </div>
          ${
            formData.image
              ? `<img src="${formData.image}" alt="cover" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 4px;">`
              : ""
          }
          <p style="font-style: italic; color: #555; margin: 15px 0;">${
            formData.excerpt || "Không có mô tả"
          }</p>
          <div style="margin: 20px 0;">
            <a href="${
              formData.externalLink || "#"
            }" target="_blank" rel="noopener noreferrer" style="color: #0066cc; font-size: 16px; text-decoration: underline; padding: 10px 20px; background: #e6f2ff; border-radius: 4px; display: inline-block;">
              🔗 Xem bài viết gốc
            </a>
          </div>
          <p style="color: #999; font-size: 12px;">URL: ${
            formData.externalLink || "Link bài viết"
          }</p>
        </div>
      `);
    }
    setPreviewOpen(true);
  };

  const navigateToManager = () => {
    try {
      window.history.pushState(null, "", "/admin/blog");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {
      window.location.hash = "#/admin/blog";
    }
  };

  // ===== FORM SUBMISSION =====

  const handleSubmit = async () => {
    if (!formData || !originalData) return;

    // Comprehensive validation
    const titleError = validateField("title", formData.title || "");
    if (titleError) {
      message.error(`❌ ${titleError}`);
      return;
    }

    const categoryError = validateField("category", formData.category || "");
    if (categoryError) {
      message.error(`❌ ${categoryError}`);
      return;
    }

    const imageError = validateField("image", formData.image || "");
    if (imageError) {
      message.error(`❌ ${imageError}`);
      return;
    }

    if (formData.type === "internal") {
      const contentError = validateField("content", formData.content || "");
      if (contentError) {
        message.error(`❌ ${contentError}`);
        return;
      }
      if (!formData.images || formData.images.length === 0) {
        message.error(
          "❌ Phải có ít nhất một ảnh gallery cho loại bài viết nội bộ"
        );
        return;
      }
    } else if (formData.type === "external") {
      const externalLinkError = validateField(
        "externalLink",
        formData.externalLink || ""
      );
      if (externalLinkError) {
        message.error(`❌ ${externalLinkError}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Build payload with only changed fields (merge with original data)
      // For tags, handle both string and array formats
      const getTagsValue = (tags: any): string[] => {
        if (Array.isArray(tags)) return tags;
        if (typeof tags === "string")
          return tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t);
        return [];
      };

      const originalTags = getTagsValue(originalData.tags);
      const currentTags = getTagsValue(formData.tags);

      const payload = {
        title:
          (formData.title?.trim() || "") !== (originalData.title?.trim() || "")
            ? formData.title?.trim()
            : originalData.title,
        category:
          formData.category !== originalData.category
            ? formData.category
            : originalData.category,
        type:
          formData.type !== originalData.type
            ? formData.type
            : originalData.type,
        image:
          formData.image !== originalData.image
            ? formData.image
            : originalData.image,
        date:
          (formData.date?.trim() || "") !== (originalData.date?.trim() || "")
            ? formData.date?.trim() ||
              new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : originalData.date,
        excerpt:
          (formData.excerpt?.trim() || "") !==
          (originalData.excerpt?.trim() || "")
            ? formData.excerpt?.trim()
            : originalData.excerpt,
        author:
          (formData.author?.trim() || "") !==
          (originalData.author?.trim() || "")
            ? formData.author?.trim()
            : originalData.author,
        // Backend expects tags as a comma-separated string (e.g. "tag1, tag2").
        tags:
          JSON.stringify(currentTags) !== JSON.stringify(originalTags)
            ? currentTags.join(", ")
            : Array.isArray(originalTags)
            ? originalTags.join(", ")
            : originalTags || "",
        content:
          (formData.content?.trim() || "") !==
          (originalData.content?.trim() || "")
            ? formData.content?.trim()
            : originalData.content,
        images:
          JSON.stringify(formData.images || []) !==
          JSON.stringify(originalData.images || [])
            ? formData.images
            : originalData.images,
        externalLink:
          (formData.externalLink?.trim() || "") !==
          (originalData.externalLink?.trim() || "")
            ? formData.externalLink?.trim()
            : originalData.externalLink,
        status: formData.status || originalData.status || "DRAFT",
      };

      await blogApi.updateBlog(Number(formData.id), payload as any);
      message.success("✔️ Cập nhật bài viết thành công!");
      // Navigate back to BlogManager
      setTimeout(() => {
        navigateToManager();
      }, 1500);
    } catch (e: any) {
      console.error("Submit error:", e);
      const errorMsg = e.response?.data?.error || e.message || "Lỗi không xác định";
      message.error(`❌ ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Change only status via PUT (server will update existing.Status when provided)
  const changeStatus = async (newStatus: string) => {
    if (!formData || !formData.id) return;
    setSubmitting(true);
    try {
      const payload: any = { id: Number(formData.id), status: newStatus };
      await blogApi.updateBlog(Number(formData.id), payload);
      message.success("Cập nhật trạng thái thành công");
      setFormData((prev) =>
        prev ? { ...prev, status: newStatus as any } : prev
      );
    } catch (e: any) {
      const errorMsg = e.response?.data?.error || e.message || "Lỗi cập nhật trạng thái";
      message.error(`Lỗi: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusLabel = (status?: string) => {
    const labels: any = {
      DRAFT: "Bản nháp",
      PENDING: "Chờ duyệt",
      APPROVED: "Đã duyệt",
      REJECTED: "Từ chối",
      PUBLISHED: "Đã xuất bản",
      HIDDEN: "Ẩn",
      ARCHIVED: "Lưu trữ",
      DELETED: "Đã xóa",
    };
    return labels[status || "DRAFT"] || status || "Không xác định";
  };

  if (loading || !formData) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" tip="Đang tải dữ liệu bài viết..." />
      </div>
    );
  }

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
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
              }}
            >
              <h2 style={{ margin: 0 }}>Chỉnh sửa bài viết</h2>
              <div style={{ fontSize: 12, color: "#666" }}>
                Trạng thái:{" "}
                <strong>
                  {formData ? getStatusLabel(formData.status) : "Đang tải..."}
                </strong>
              </div>
            </div>

            {/* Show warning if blog is in rejection state */}
            {formData &&
              formData.status === "REJECTED" &&
              formData.rejectionReason && (
                <Alert
                  message="Bài viết bị từ chối"
                  description={`Lý do: ${formData.rejectionReason}`}
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

            <Spin spinning={uploading} tip="Đang upload ảnh...">
              <Card style={{ marginBottom: 20 }}>
                <Form layout="vertical" form={form}>
                  {/* Title */}
                  <Form.Item
                    label="Tiêu đề *"
                    required
                    help={
                      formData && formData.title && formData.title.length < 3
                        ? "Tiêu đề phải có ít nhất 3 ký tự"
                        : ""
                    }
                    validateStatus={
                      formData && formData.title && formData.title.length < 3
                        ? "warning"
                        : ""
                    }
                  >
                    <Input
                      placeholder="Nhập tiêu đề bài viết (tối thiểu 3 ký tự)"
                      value={formData?.title || ""}
                      onChange={(e) =>
                        setFormData((prev) =>
                          prev ? { ...prev, title: e.target.value } : null
                        )
                      }
                      maxLength={200}
                    />
                  </Form.Item>

                  {/* Category */}
                  <Form.Item label="Danh mục *" required>
                    <Select
                      placeholder="Chọn danh mục"
                      value={formData.category || undefined}
                      onChange={(val) =>
                        setFormData((prev) => ({ ...prev, category: val }))
                      }
                    >
                      {categories.map((cat) => (
                        <Select.Option key={cat} value={cat}>
                          {cat}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>

                  {/* Type */}
                  <Form.Item label="Loại bài viết *" required>
                    <Select
                      placeholder="Chọn loại"
                      value={formData.type || "internal"}
                      onChange={(val) =>
                        setFormData((prev) => ({
                          ...prev,
                          type: val as "internal" | "external",
                        }))
                      }
                    >
                      <Select.Option value="internal">
                        Nội bộ (có nội dung + gallery)
                      </Select.Option>
                      <Select.Option value="external">
                        Bên ngoài (link ngoài)
                      </Select.Option>
                    </Select>
                  </Form.Item>

                  {/* Cover Image */}
                  <Form.Item label="Ảnh Cover *" required>
                    <div style={{ marginBottom: 10 }}>
                      {formData.image && (
                        <div
                          style={{
                            position: "relative",
                            display: "inline-block",
                          }}
                        >
                          <img
                            src={formData.image}
                            alt="cover"
                            style={{
                              maxWidth: 200,
                              maxHeight: 150,
                              marginBottom: 10,
                              borderRadius: 4,
                            }}
                          />
                          <Button
                            danger
                            size="small"
                            onClick={() =>
                              setFormData((prev) => ({ ...prev, image: "" }))
                            }
                            style={{ position: "absolute", top: 0, right: 0 }}
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
                      <Button icon={<UploadOutlined />}>
                        Upload Ảnh Cover Mới
                      </Button>
                    </Upload>
                  </Form.Item>

                  {/* Author & Date */}
                  <Form.Item label="Tác giả">
                    <Input
                      placeholder="Nhập tên tác giả (nếu không nhập, mặc định là 'Admin')"
                      value={formData.author || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          author: e.target.value,
                        }))
                      }
                      maxLength={100}
                    />
                  </Form.Item>

                  <Form.Item label="Ngày">
                    <Input
                      placeholder="vd: 20th November, 2025 hoặc 2025-11-20"
                      value={formData.date || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          date: e.target.value,
                        }))
                      }
                    />
                  </Form.Item>

                  {/* Excerpt */}
                  <Form.Item label="Mô tả ngắn">
                    <Input.TextArea
                      placeholder="Nhập mô tả ngắn (optional)"
                      rows={3}
                      value={formData.excerpt || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          excerpt: e.target.value,
                        }))
                      }
                      maxLength={500}
                      showCount
                    />
                  </Form.Item>

                  {/* Tags */}
                  <Form.Item label="Tags (cách nhau bằng dấu phẩy)">
                    <Input
                      placeholder="vd: tag1, tag2, tag3"
                      value={formData.tags || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tags: e.target.value,
                        }))
                      }
                    />
                  </Form.Item>

                  {/* Conditional rendering based on type */}
                  {formData.type === "internal" ? (
                    <>
                      {/* Content */}
                      <Form.Item label="Nội dung *" required>
                        <Input.TextArea
                          placeholder="Nhập nội dung bài viết (HTML hoặc text)"
                          rows={10}
                          value={formData.content || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              content: e.target.value,
                            }))
                          }
                        />
                      </Form.Item>

                      {/* Gallery Images */}
                      <Form.Item label="Ảnh Gallery *" required>
                        <div style={{ marginBottom: 10 }}>
                          {formData.images && formData.images.length > 0 && (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, 1fr)",
                                gap: 10,
                                marginBottom: 10,
                              }}
                            >
                              {formData.images.map((img, idx) => (
                                <div key={idx} style={{ position: "relative" }}>
                                  <img
                                    src={img}
                                    alt={`gallery-${idx}`}
                                    style={{
                                      width: "100%",
                                      height: 120,
                                      objectFit: "cover",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <Button
                                    danger
                                    size="small"
                                    onClick={() =>
                                      setFormData((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              images: (
                                                prev.images || []
                                              ).filter((_, i) => i !== idx),
                                            }
                                          : null
                                      )
                                    }
                                    style={{
                                      position: "absolute",
                                      top: 5,
                                      right: 5,
                                    }}
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
                          <Button icon={<UploadOutlined />}>
                            Thêm ảnh vào Gallery
                          </Button>
                        </Upload>
                      </Form.Item>
                    </>
                  ) : (
                    <>
                      {/* External Link */}
                      <Form.Item label="Đường dẫn bên ngoài *" required>
                        <Input
                          placeholder="vd: https://vnexpress.net/..."
                          value={formData.externalLink || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              externalLink: e.target.value,
                            }))
                          }
                        />
                      </Form.Item>
                    </>
                  )}

                  {/* Status - Read only info */}
                  <Form.Item label="Trạng thái (Chỉ xem)">
                    <Input
                      disabled
                      value={getStatusLabel(formData.status)}
                      style={{ background: "#f5f5f5" }}
                    />
                    <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                      Sử dụng các nút hành động trong trang quản lý để thay đổi
                      trạng thái bài viết
                    </div>
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
                        💾 Lưu Thay Đổi
                      </Button>

                      {/* Publish / Hide toggle according to current status */}
                      {formData.status === "PUBLISHED" && (
                        <Button
                          onClick={() => changeStatus("ARCHIVED")}
                          disabled={submitting}
                        >
                          🔕 Ẩn bài
                        </Button>
                      )}

                      {(formData.status === "DRAFT" ||
                        formData.status === "ARCHIVED") && (
                        <Button
                          type="primary"
                          onClick={() => changeStatus("PUBLISHED")}
                          disabled={submitting}
                        >
                          🚀 Xuất bản
                        </Button>
                      )}

                      {/* Soft delete */}
                      {formData.status !== "DELETED" && (
                        <Button
                          danger
                          onClick={() => changeStatus("DELETED")}
                          disabled={submitting}
                        >
                          🗑️ Xóa
                        </Button>
                      )}

                      {/* When DELETED show Restore + Hard Delete */}
                      {formData.status === "DELETED" && (
                        <>
                          <Button onClick={() => changeStatus("ARCHIVED")}>
                            ↩️ Khôi phục
                          </Button>
                          <Button
                            danger
                            onClick={async () => {
                              // Hard delete: call delete endpoint
                              if (!formData?.id) return;
                              if (
                                !window.confirm(
                                  "Xóa vĩnh viễn? Hành động không thể hoàn tác."
                                )
                              )
                                return;
                              setSubmitting(true);
                              try {
                                const res = await fetch(
                                  `/api/blog/${formData.id}?hard=true`,
                                  { method: "DELETE" }
                                );
                                if (res.ok) {
                                  message.success("Đã xóa vĩnh viễn");
                                  navigateToManager();
                                  return;
                                }
                                throw new Error("Xóa vĩnh viễn thất bại");
                              } catch (e: any) {
                                message.error(e.message || "Lỗi xóa vĩnh viễn");
                              } finally {
                                setSubmitting(false);
                              }
                            }}
                          >
                            🗑️ Xóa vĩnh viễn
                          </Button>
                        </>
                      )}

                      <Button
                        icon={<EyeOutlined />}
                        onClick={handlePreview}
                        disabled={uploading || submitting}
                      >
                        👁️ Xem trước
                      </Button>
                      <Button
                        onClick={navigateToManager}
                        disabled={uploading || submitting}
                      >
                        ↩️ Quay lại
                      </Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>
            </Spin>

            {/* Preview Modal */}
            <Modal
              open={previewOpen}
              onCancel={() => setPreviewOpen(false)}
              footer={null}
              width={900}
              title="Xem trước bài viết"
              bodyStyle={{ maxHeight: "70vh", overflowY: "auto" }}
            >
              <div dangerouslySetInnerHTML={{ __html: previewContent }} />
            </Modal>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BlogEdit;
