import React, { useState, useMemo, useEffect } from "react";
import Slidebar from "../components/Slidebar";
import HeaderSection from "../components/HeaderSection";
import BlogDetail from "../components/BlogDetail";
import {
  Card,
  Input,
  Table,
  Space,
  Button,
  Tag,
  message,
  Badge,
  Select,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  PoweroffOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { blogPosts, BlogPost } from "../../data/blogPosts"; // Sử dụng data mẫu đã có

// Định nghĩa trạng thái mở rộng cho Admin
type AdminPostStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface AdminBlogPost extends BlogPost {
  status: AdminPostStatus;
  // optional admin metadata used in the admin mock UI
  author_id?: number;
  updated_at?: string;
  published_at?: string;
  view_count?: number;
  rejection_reason?: string;
  rejected_at?: string | null;
  approved_at?: string | null;
  audit_log?: string;
  created_at?: string;
  displayOrder?: number | null;
  order?: number; // Added for admin sorting
  // camelCase variants (optional for compatibility)
  viewCount?: number;
  rejectionReason?: string;
  rejectedAt?: string | null;
  approvedAt?: string | null;
  auditLog?: string;
  publishedAt?: string | null;
  authorId?: string;
  slug?: string;
}

// Giả lập dữ liệu blog với trạng thái quản lý
const adminBlogPosts: AdminBlogPost[] = blogPosts.map((post, index) => ({
  ...post,
  status: (index === 0
    ? "PUBLISHED"
    : index === 1
    ? "ARCHIVED"
    : "DRAFT") as AdminPostStatus,
  order: index,
  // Giả định thêm trường author_id
  author_id: index % 2 === 0 ? 1 : 2,
}));

const BlogManager: React.FC = () => {
  const [filter, setFilter] = useState({
    status: "ALL",
    category: "ALL",
    search: "",
  });

  // Thêm state cho loading khi toggle
  const [loading, setLoading] = useState(false);

  const readAdminPosts = () => {
    try {
      const raw = localStorage.getItem("admin_blog_posts");
      if (!raw) return adminBlogPosts;
      return JSON.parse(raw) as AdminBlogPost[];
    } catch {
      return adminBlogPosts;
    }
  };

  const [posts, setPosts] = useState<AdminBlogPost[]>(() => readAdminPosts());

  // Load posts from API on mount; fallback to localStorage
  useEffect(() => {
    let mounted = true;
    const fetchPosts = async () => {
      try {
        const res = await fetch("/api/blog?admin=true");
        if (res.ok) {
          const data = await res.json();
          if (!mounted) return;
          const mapped = (data as any[]).map(
            (d, idx) =>
              ({
                id: d.id,
                title: d.title,
                category: d.category,
                type: d.type || "internal",
                image: d.image || "",
                date: d.date || d.publishedAt || d.createdAt || "",
                excerpt: d.excerpt || "",
                author: d.author || "",
                tags:
                  typeof d.tags === "string"
                    ? d.tags.split(",").map((t: string) => t.trim())
                    : d.tags || [],
                content: d.content || "",
                status: (d.status || "DRAFT") as AdminPostStatus,
                displayOrder: d.displayOrder,
                order: typeof d.order === "number" ? d.order : idx,
                images: d.images || [],
                externalLink: d.externalLink || "",
              } as AdminBlogPost)
          );
          // Apply manual ordering if known problematic titles appear (fix admin display order)
          const desiredOrderByTitle: Record<string, number> = {
            "Tuyệt phẩm Kiến trúc: King Palace": 0,
            "Cập nhật Tình hình Bão": 1,
            abc: 2,
          };

          const hasAny = mapped.some((m) =>
            Object.keys(desiredOrderByTitle).includes(m.title)
          );
          if (hasAny) {
            const withOrder = mapped.map((m) => ({
              ...m,
              order:
                typeof desiredOrderByTitle[m.title] === "number"
                  ? desiredOrderByTitle[m.title]
                  : typeof m.order === "number"
                  ? m.order
                  : 999,
            }));
            // fill remaining orders sequentially for items without explicit mapping
            let next = 0;
            const used = new Set<number>(
              withOrder
                .filter((x) => typeof x.order === "number" && x.order < 999)
                .map((x) => x.order as number)
            );
            withOrder.forEach((w) => {
              if (w.order === 999) {
                while (used.has(next)) next++;
                w.order = next;
                used.add(next);
              }
              next = Math.max(next, (w.order as number) + 1);
            });
            withOrder.sort((a, b) => (a.order as number) - (b.order as number));
            setPosts(withOrder);
          } else {
            setPosts(mapped);
          }
          return;
        }
      } catch (e) {
        console.warn("Blog API not reachable, using local posts");
      }
      setPosts(readAdminPosts());
    };
    fetchPosts();
    return () => {
      mounted = false;
    };
  }, []);

  // Persist admin posts to localStorage whenever changed
  useEffect(() => {
    try {
      localStorage.setItem("admin_blog_posts", JSON.stringify(posts));
    } catch {}
  }, [posts]);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<AdminBlogPost | null>(null);

  // ===== ACTION HANDLERS (Giữ nguyên các hàm không liên quan đến toggle) =====

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`/api/blog/${id}/duyet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: updated.status as AdminPostStatus,
                  approvedAt: updated.approvedAt,
                }
              : p
          )
        );
        return;
      }
    } catch (e) {
      console.warn("Approve failed, fallback to local");
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "PUBLISHED" as AdminPostStatus } : p
      )
    );
  };

  const handleReject = async (id: number, reason: string) => {
    try {
      const res = await fetch(`/api/blog/${id}/tu-choi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "DRAFT" as AdminPostStatus,
                  rejectionReason: reason,
                }
              : p
          )
        );
        return;
      }
    } catch (e) {
      console.warn("Reject failed, fallback to local");
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "DRAFT" as AdminPostStatus,
              rejectionReason: reason,
            }
          : p
      )
    );
  };

  const handlePublish = async (id: number) => {
    try {
      const res = await fetch(`/api/blog/${id}/xuat-ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, status: updated.status as AdminPostStatus }
              : p
          )
        );
        message.success("Xuất bản thành công!");
        return;
      }
      const errData = await res.json();
      throw new Error(errData.error || "Lỗi xuất bản");
    } catch (e: any) {
      message.error(`Xuất bản thất bại: ${e.message}`);
      throw e;
    }
  };

  const handleHide = async (id: number) => {
    try {
      const res = await fetch(`/api/blog/${id}/an`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        await res.json();
        setPosts((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, status: "ARCHIVED" as AdminPostStatus } : p
          )
        );
        message.success("Đã ẩn bài viết!");
        return;
      }
    } catch (e) {
      console.warn("Hide failed, fallback to local");
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "ARCHIVED" as AdminPostStatus } : p
      )
    );
  };

  const handleEdit = (id: number) => {
    const post = posts.find((p) => p.id === id);
    if (post) {
      try {
        window.history.pushState(null, "", `/admin/blog/edit/${id}`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch {
        window.location.hash = `#/admin/blog/edit/${id}`;
      }
    }
  };

  const handleDeleteBlog = async (id: number) => {
    if (!window.confirm("Xác nhận Xóa vĩnh viễn bài viết này?")) return;
    try {
      const res = await fetch(`/api/blog/${id}?hard=true`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        message.success("Xóa vĩnh viễn thành công!");
        return;
      }
    } catch (e) {
      console.warn("Delete failed, fallback to local");
    }
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  // Danh sách các danh mục duy nhất
  const categories = useMemo(() => {
    const cats = new Set(blogPosts.map((p) => p.category));
    return ["ALL", ...Array.from(cats)];
  }, []);

  // Hàm chuyển đổi trạng thái (Cập nhật API chung)
  const updatePostStatus = (id: number, newStatus: AdminPostStatus) => {
    (async () => {
      setLoading(true);
      const post = posts.find((p) => p.id === id);
      if (!post) {
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      // Create payload with correct camelCase field names for backend
      const payload = {
        title: post.title || "",
        slug: (post as any).slug || "",
        excerpt: post.excerpt || "",
        content: post.content || "",
        image: post.image || "",
        category: post.category || "",
        author: post.author || "Admin",
        status: newStatus,
        type: post.type || "internal",
        date: post.date || "",
        externalLink: post.externalLink || "",
        // Convert tags array to comma-separated string
        tags: Array.isArray(post.tags)
          ? post.tags.filter((t) => t).join(", ")
          : post.tags || "",
        images: post.images || [],
        viewCount: (post as any).viewCount ?? (post as any).view_count ?? 0,
        rejectionReason:
          (post as any).rejectionReason ?? (post as any).rejection_reason ?? "",
        rejectedAt:
          (post as any).rejectedAt ?? (post as any).rejected_at ?? null,
        approvedAt:
          (post as any).approvedAt ?? (post as any).approved_at ?? null,
        auditLog: (post as any).auditLog ?? (post as any).audit_log ?? "",
        createdAt:
          (post as any).createdAt ??
          (post as any).created_at ??
          new Date().toISOString(),
        updatedAt: now,
        publishedAt:
          (post as any).publishedAt ?? (post as any).published_at ?? null,
        displayOrder: null,
        authorId:
          (post as any).authorId ?? (post as any).author_id?.toString() ?? "",
      };

      try {
        const res = await fetch(`/api/blog/${post.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === id)
                return {
                  ...(p as any),
                  status: updated.status || newStatus,
                  updated_at: updated.updatedAt || now,
                  displayOrder:
                    updated.displayOrder ??
                    (newStatus !== "PUBLISHED" ? null : p.displayOrder),
                } as AdminBlogPost;
              // if we just moved this post away from PUBLISHED, clear its displayOrder locally
              if (newStatus !== "PUBLISHED" && p.displayOrder)
                return { ...p, displayOrder: null } as AdminBlogPost;
              return p;
            })
          );
          try {
            window.dispatchEvent(new CustomEvent("blogs-updated"));
          } catch {}
          message.success(
            newStatus === "PUBLISHED"
              ? "Đã kích hoạt/Xuất bản"
              : newStatus === "ARCHIVED"
              ? "Đã ngưng hoạt động/Lưu trữ"
              : `Cập nhật trạng thái thành ${newStatus}`
          );
          return;
        }
        // parse and show server error message to help debugging
        try {
          const err = await res.json();
          const msg = err.error || err.message || "Cập nhật API thất bại";
          message.error(`❌ ${msg}`);
          throw new Error(msg);
        } catch (inner) {
          message.error("❌ Cập nhật API thất bại");
          throw new Error("Cập nhật API thất bại");
        }
      } catch (e) {
        console.warn("API update failed, falling back to local");
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id !== id
              ? post
              : ({
                  ...post,
                  status: newStatus,
                  updated_at: now,
                } as AdminBlogPost)
          )
        );
        message.warning(
          `Lỗi API, cập nhật cục bộ thành công trạng thái: ${newStatus}`
        );
      } finally {
        setLoading(false);
      }
    })();
  };

  // Hàm cập nhật thứ tự hiển thị
  const updateDisplayOrder = (id: number, order: number | null) => {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    if (post.status !== "PUBLISHED") {
      message.warning(
        "Chỉ có thể đặt thứ tự hiển thị cho bài viết đã xuất bản"
      );
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const bodyPayload = order === null ? null : order;
        const res = await fetch(`/api/blog/${id}/thu-tu-hien-thi`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        if (res.ok) {
          const updated = await res.json();
          // Apply updated displayOrder and clear any conflicting local entries
          setPosts((prev) =>
            prev.map((p) => {
              if (p.id === id)
                return {
                  ...(p as any),
                  displayOrder: updated.displayOrder,
                } as AdminBlogPost;
              if (
                updated.displayOrder != null &&
                p.id !== id &&
                p.displayOrder === updated.displayOrder
              )
                return { ...p, displayOrder: null } as AdminBlogPost;
              return p;
            })
          );
          try {
            window.dispatchEvent(new CustomEvent("blogs-updated"));
          } catch {}
          message.success(
            order
              ? `Đã đặt thứ tự hiển thị: ${order}`
              : "Đã xóa thứ tự hiển thị"
          );
          return;
        }
        try {
          const err = await res.json();
          const msg = err.error || err.message || "Cập nhật thứ tự thất bại";
          message.error(`❌ ${msg}`);
          throw new Error(msg);
        } catch (inner) {
          message.error("❌ Cập nhật thứ tự thất bại");
          throw new Error("Cập nhật thứ tự thất bại");
        }
      } catch (e) {
        console.warn("API update failed, falling back to local");
        setPosts((prevPosts) =>
          prevPosts.map((p) => {
            if (p.id === id)
              return { ...p, displayOrder: order } as AdminBlogPost;
            if (order != null && p.displayOrder === order)
              return { ...p, displayOrder: null } as AdminBlogPost;
            return p;
          })
        );
        message.warning(`Lỗi API, cập nhật cục bộ thứ tự: ${order || "xóa"}`);
      } finally {
        setLoading(false);
      }
    })();
  };

  // Hàm Xóa blog (trực tiếp, không cần xoá mềm)
  const handleDeletePost = async (id: number) => {
    if (!window.confirm("Xác nhận xóa bài viết này?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/blog/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Chỉ xóa blog được chọn khỏi danh sách
        setPosts((prev) => prev.filter((p) => p.id !== id));
        message.success("Xóa bài viết thành công!");
        return;
      }
      message.error("Xóa bài viết thất bại!");
    } catch (e) {
      console.warn("Delete failed:", e);
      message.error("Xóa bài viết thất bại!");
    } finally {
      setLoading(false);
    }
  };

  // Hàm Toggle (Thay thế softDeletePost trong cột Thao tác)
  const handleTogglePublishStatus = (
    id: number,
    currentStatus: AdminPostStatus
  ) => {
    // Nếu đang là PUBLISHED (Đang hoạt động) -> Chuyển sang ARCHIVED (Ngưng hoạt động)
    const newStatus: AdminPostStatus =
      currentStatus === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";
    updatePostStatus(id, newStatus);
  };

  // 1. D) Danh sách & lọc (List & Filter)
  const filteredPosts = useMemo(() => {
    let list = posts;

    // Lọc theo Trạng thái
    if (filter.status !== "ALL") {
      list = list.filter((p) => p.status === filter.status);
    }

    // Lọc theo Danh mục
    if (filter.category !== "ALL") {
      list = list.filter((p) => p.category === filter.category);
    }

    // Tìm kiếm theo Tiêu đề
    if (filter.search) {
      list = list.filter((p) =>
        p.title.toLowerCase().includes(filter.search.toLowerCase())
      );
    }

    // If any posts have a displayOrder (1-5), surface those first ordered by displayOrder.
    return list.slice().sort((a, b) => {
      const aDO = typeof a.displayOrder === "number" ? a.displayOrder : null;
      const bDO = typeof b.displayOrder === "number" ? b.displayOrder : null;
      if (aDO !== null || bDO !== null) {
        if (aDO === null) return 1;
        if (bDO === null) return -1;
        return (aDO as number) - (bDO as number);
      }
      // fallback to admin 'order' field
      return (
        (typeof a.order === "number" ? a.order : 0) -
        (typeof b.order === "number" ? b.order : 0)
      );
    });
  }, [posts, filter]);

  // status styles are applied via Tag colors in the table; helper removed to avoid unused variable.

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
            <h2 style={{ marginBottom: 16 }}>Quản lý bài viết Blog</h2>

            {/* Stats Cards */}
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
                    style={{ fontSize: 28, fontWeight: 600, color: "#667eea" }}
                  >
                    {posts.length}
                  </div>
                  <div style={{ color: "#666", marginTop: 4 }}>
                    Tổng bài viết
                  </div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 28, fontWeight: 600, color: "#10B981" }}
                  >
                    {posts.filter((p) => p.status === "PUBLISHED").length}
                  </div>
                  <div style={{ color: "#666", marginTop: 4 }}>Đã xuất bản</div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: "center" }}>
                  <Badge
                    count={posts.filter((p) => p.status === "DRAFT").length}
                    style={{ backgroundColor: "#f59e0b" }}
                  >
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 600,
                        color: "#f59e0b",
                      }}
                    >
                      {posts.filter((p) => p.status === "DRAFT").length}
                    </div>
                  </Badge>
                  <div style={{ color: "#666", marginTop: 4 }}>Bản nháp</div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 28, fontWeight: 600, color: "#6b7280" }}
                  >
                    {posts.filter((p) => p.status === "ARCHIVED").length}
                  </div>
                  <div style={{ color: "#666", marginTop: 4 }}>Lưu trữ</div>
                </div>
              </Card>
            </div>

            {/* Filter */}
            <Card style={{ marginBottom: 12 }}>
              <Space wrap>
                <Input.Search
                  placeholder="Tìm kiếm theo tiêu đề..."
                  value={filter.search}
                  onChange={(e) =>
                    setFilter({ ...filter, search: e.target.value })
                  }
                  style={{ width: 300 }}
                />
                <select
                  value={filter.category}
                  onChange={(e) =>
                    setFilter({ ...filter, category: e.target.value })
                  }
                  style={{ padding: 8 }}
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <select
                  value={filter.status}
                  onChange={(e) =>
                    setFilter({ ...filter, status: e.target.value as any })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="ALL">Tất cả</option>
                  <option value="PUBLISHED">Đã xuất bản</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="ARCHIVED">Lưu trữ</option>
                </select>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    try {
                      window.history.pushState(null, "", "/admin/blog/create");
                      window.dispatchEvent(new PopStateEvent("popstate"));
                    } catch {
                      window.location.hash = "#/admin/blog/create";
                    }
                  }}
                >
                  Tạo mới
                </Button>
              </Space>
            </Card>

            {/* Table */}
            <Card>
              <Table
                dataSource={filteredPosts}
                rowKey="id"
                pagination={{ pageSize: 12 }}
                loading={loading} // Thêm loading cho bảng
                onRow={(record) => ({
                  onClick: () => {
                    setSelectedPost(record as AdminBlogPost);
                    setDetailVisible(true);
                  },
                })}
                columns={[
                  { title: "ID", dataIndex: "id", key: "id", width: 80 },
                  {
                    title: "Tiêu đề",
                    dataIndex: "title",
                    key: "title",
                    render: (t: string, r: any) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{t}</div>
                        <div style={{ color: "#888" }}>{r.category}</div>
                      </div>
                    ),
                  },
                  {
                    title: "Trạng thái",
                    dataIndex: "status",
                    key: "status",
                    width: 140,
                    render: (s: AdminPostStatus) => {
                      const map: any = {
                        PUBLISHED: "green",
                        DRAFT: "orange",
                        ARCHIVED: "default",
                      };
                      return <Tag color={map[s] || "default"}>{s}</Tag>;
                    },
                  },
                  {
                    title: "Thứ tự hiển thị",
                    dataIndex: "displayOrder",
                    key: "displayOrder",
                    width: 160,
                    render: (d: number | null, r: AdminBlogPost) => {
                      if (r.status !== "PUBLISHED")
                        return <span style={{ color: "#ccc" }}>N/A</span>;
                      return (
                        <Select
                          value={d || undefined}
                          placeholder="Chọn thứ tự"
                          style={{ width: 120 }}
                          allowClear
                          onChange={(value: number | undefined) =>
                            updateDisplayOrder(r.id, value || null)
                          }
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                        >
                          {[1, 2, 3, 4, 5].map((num) => (
                            <Select.Option key={num} value={num}>
                              {num}
                            </Select.Option>
                          ))}
                        </Select>
                      );
                    },
                  },
                  {
                    title: "Ngày",
                    dataIndex: "date",
                    key: "date",
                    width: 140,
                    render: (d: string, r: any) =>
                      r.status === "PUBLISHED" ? d : "N/A",
                  },
                  {
                    title: "Tác giả",
                    dataIndex: "author",
                    key: "author",
                    width: 160,
                    render: (_: any, r: any) =>
                      r.author || `Admin ${r.author_id}`,
                  },
                  {
                    title: "Thao tác",
                    key: "action",
                    fixed: "right" as const,
                    width: 220,
                    render: (_: any, r: AdminBlogPost) => (
                      <Space>
                        <Button
                          icon={<EditOutlined />}
                          size="small"
                          onClick={() => handleEdit(r.id)}
                        >
                          Sửa
                        </Button>

                        {/* Nút Toggle Bật/Tắt */}
                        {(r.status === "PUBLISHED" ||
                          r.status === "ARCHIVED" ||
                          r.status === "DRAFT") && (
                          <Button
                            icon={<PoweroffOutlined />}
                            size="small"
                            type={
                              r.status === "PUBLISHED" ? "default" : "primary"
                            }
                            danger={r.status === "PUBLISHED"} // Nút đỏ nếu đang Bật
                            onClick={(e) => {
                              e.stopPropagation(); // Ngăn mở modal detail
                              handleTogglePublishStatus(r.id, r.status);
                            }}
                          >
                            {r.status === "PUBLISHED" ? "Ngưng" : "Kích hoạt"}
                          </Button>
                        )}

                        {/* Nút Xóa */}
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePost(r.id);
                          }}
                        >
                          Xóa
                        </Button>
                      </Space>
                    ),
                  },
                ]}
                scroll={{ x: 900 }}
              />
              {/* Detail modal shown when a row is clicked */}
              <BlogDetail
                visible={detailVisible}
                blog={selectedPost as any}
                onClose={() => {
                  setDetailVisible(false);
                  setSelectedPost(null);
                }}
                onApprove={handleApprove}
                onReject={handleReject}
                onPublish={handlePublish}
                onHide={handleHide}
                onEdit={handleEdit}
                onDelete={handleDeleteBlog}
              />
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BlogManager;
