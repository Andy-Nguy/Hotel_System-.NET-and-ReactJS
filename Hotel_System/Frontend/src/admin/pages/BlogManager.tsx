import React, { useState, useMemo, useEffect } from 'react';
import Slidebar from '../components/Slidebar';
import HeaderSection from '../components/HeaderSection';
import BlogDetail from '../components/BlogDetail';
import { Card, Input, Table, Space, Button, Tag, Modal, message, Badge } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { blogPosts, BlogPost } from '../../data/blogPosts'; // Sử dụng data mẫu đã có

// Định nghĩa trạng thái mở rộng cho Admin
type AdminPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';

interface AdminBlogPost extends BlogPost {
  status: AdminPostStatus;
  // optional admin metadata used in the admin mock UI
  authorId?: number;
  updated_at?: string;
  published_at?: string;
}

// Giả lập dữ liệu blog với trạng thái quản lý
const adminBlogPosts: AdminBlogPost[] = blogPosts.map((post, index) => ({
  ...post,
  status: index === 0 ? 'PUBLISHED' : index === 1 ? 'DELETED' : index === 2 ? 'ARCHIVED' : 'DRAFT',
  // Giả định thêm trường authorId
  authorId: index % 2 === 0 ? 1 : 2,
}));

const BlogManager: React.FC = () => {
  const [filter, setFilter] = useState({
    status: 'ALL',
    category: 'ALL',
    search: '',
  });

  const readAdminPosts = () => {
    try {
      const raw = localStorage.getItem('admin_blog_posts');
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
        const res = await fetch('/api/blog?admin=true');
        if (res.ok) {
          const data = await res.json();
          if (!mounted) return;
          const mapped = (data as any[]).map(d => ({
            id: d.id,
            title: d.title,
            category: d.category,
            type: d.type || 'internal',
            image: d.image || '',
            date: d.date || d.publishedAt || d.createdAt || '',
            excerpt: d.excerpt || '',
            author: d.author || '',
            tags: typeof d.tags === 'string' ? d.tags.split(',').map((t: string) => t.trim()) : (d.tags || []),
            content: d.content || '',
            status: (d.status || 'DRAFT') as AdminPostStatus,
            images: d.images || [],
            externalLink: d.externalLink || '',
          } as AdminBlogPost));
          setPosts(mapped);
          return;
        }
      } catch (e) {
        console.warn('Blog API not reachable, using local posts');
      }
      setPosts(readAdminPosts());
    };
    fetchPosts();
    return () => { mounted = false; };
  }, []);

  // Persist admin posts to localStorage whenever changed
  useEffect(() => {
    try { localStorage.setItem('admin_blog_posts', JSON.stringify(posts)); } catch {}
  }, [posts]);

  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<AdminBlogPost | null>(null);

  // ===== ACTION HANDLERS =====

  const handleApprove = async (id: number) => {
    try {
      const res = await fetch(`/api/blog/${id}/duyet`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === id ? { ...p, status: updated.status as AdminPostStatus, approvedAt: updated.approvedAt } : p));
        return;
      }
    } catch (e) {
      console.warn('Approve failed, fallback to local');
    }
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'APPROVED' as AdminPostStatus } : p));
  };

  const handleReject = async (id: number, reason: string) => {
    try {
      const res = await fetch(`/api/blog/${id}/tu-choi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'REJECTED' as AdminPostStatus, rejectionReason: reason } : p));
        return;
      }
    } catch (e) {
      console.warn('Reject failed, fallback to local');
    }
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'REJECTED' as AdminPostStatus, rejectionReason: reason } : p));
  };

  const handlePublish = async (id: number) => {
    try {
      const res = await fetch(`/api/blog/${id}/xuat-ban`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === id ? { ...p, status: updated.status as AdminPostStatus } : p));
        return;
      }
      const errData = await res.json();
      throw new Error(errData.error || 'Lỗi xuất bản');
    } catch (e: any) {
      throw e;
    }
  };

  const handleHide = async (id: number) => {
    try {
      const res = await fetch(`/api/blog/${id}/an`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) {
        const updated = await res.json();
        setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'HIDDEN' as AdminPostStatus } : p));
        return;
      }
    } catch (e) {
      console.warn('Hide failed, fallback to local');
    }
    setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'HIDDEN' as AdminPostStatus } : p));
  };

  const handleEdit = (id: number) => {
    const post = posts.find(p => p.id === id);
    if (post) {
      try {
        window.history.pushState(null, '', `/admin/blog/edit/${id}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {
        window.location.hash = `#/admin/blog/edit/${id}`;
      }
    }
  };

  const handleDeleteBlog = async (id: number) => {
    try {
      const res = await fetch(`/api/blog/${id}?hard=true`, { method: 'DELETE' });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== id));
        return;
      }
    } catch (e) {
      console.warn('Delete failed, fallback to local');
    }
    setPosts(prev => prev.filter(p => p.id !== id));
  };

  // Danh sách các danh mục duy nhất
  const categories = useMemo(() => {
    const cats = new Set(blogPosts.map(p => p.category));
    return ['ALL', ...Array.from(cats)];
  }, []);

  // Hàm chuyển đổi trạng thái
  const updatePostStatus = (id: number, newStatus: AdminPostStatus) => {
    (async () => {
      const post = posts.find(p => p.id === id);
      if (!post) return;

      const from = post.status;
      const to = newStatus;
      if (from === 'PUBLISHED' && to === 'DRAFT') {
        alert('Không cho phép chuyển trạng thái từ Published về Draft. Vui lòng chuyển sang Archived nếu muốn ẩn.');
        return;
      }
      if (from === 'ARCHIVED' && to === 'DRAFT') {
        alert('Không cho phép chuyển trạng thái từ Archived về Draft. Vui lòng chuyển sang Published nếu muốn hiển thị.');
        return;
      }

      const now = new Date().toISOString();
      const payload = { ...post, status: to };
      try {
        const res = await fetch(`/admin/blogs/${post.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
          const updated = await res.json();
          setPosts(prev => prev.map(p => p.id === id ? ({ ...(p as any), status: updated.status || to, updated_at: updated.updatedAt || now } as AdminBlogPost) : p));
          return;
        }
      } catch (e) {
        console.warn('API update failed, falling back to local');
      }

      setPosts(prevPosts => prevPosts.map(post => post.id !== id ? post : ({ ...post, status: to, updated_at: now } as AdminBlogPost)));
    })();
  };

  // Hàm xoá mềm (Soft Delete)
  const softDeletePost = (id: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn XÓA MỀM bài viết này không? (Có thể khôi phục)")) return;
    (async () => {
      try {
        const res = await fetch(`/admin/blogs/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setPosts(prev => prev.map(p => p.id === id ? ({ ...p, status: 'DELETED' } as AdminBlogPost) : p));
          return;
        }
      } catch (e) { console.warn('Delete API failed, fallback to local'); }
      updatePostStatus(id, 'DELETED');
    })();
  };

  // Hàm khôi phục (Restore)
  const restorePost = (id: number) => {
    // By default restore soft-deleted posts to ARCHIVED so admin can review before publishing
    updatePostStatus(id, 'ARCHIVED');
  };

  // Hard delete (permanent) - remove from list
  const hardDeletePost = (id: number) => {
    if (!window.confirm('Xóa vĩnh viễn bài viết này? Hành động không thể hoàn tác.')) return;
    (async () => {
      try {
        const res = await fetch(`/admin/blogs/${id}?hard=true`, { method: 'DELETE' });
        if (res.ok) {
          setPosts(prev => prev.filter(p => p.id !== id));
          return;
        }
      } catch (e) { console.warn('Hard delete API failed, fallback to local'); }
      setPosts(prev => prev.filter(p => p.id !== id));
    })();
  };

  // 1. D) Danh sách & lọc (List & Filter)
  const filteredPosts = useMemo(() => {
    let list = posts;

    // Lọc theo Trạng thái
    if (filter.status !== 'ALL') {
      list = list.filter(p => p.status === filter.status);
    }

    // Lọc theo Danh mục
    if (filter.category !== 'ALL') {
      list = list.filter(p => p.category === filter.category);
    }

    // Tìm kiếm theo Tiêu đề
    if (filter.search) {
      list = list.filter(p => p.title.toLowerCase().includes(filter.search.toLowerCase()));
    }

    return list;
  }, [posts, filter]);

  const getStatusStyle = (status: AdminPostStatus) => {
    switch (status) {
      case 'PUBLISHED': return { color: '#10B981', fontWeight: 'bold' };
      case 'DRAFT': return { color: '#F59E0B' };
      case 'ARCHIVED': return { color: '#6B7280' };
      case 'DELETED': return { color: '#EF4444', fontStyle: 'italic' };
      default: return {};
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: '0px 60px' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 8px 24px rgba(2,6,23,0.06)' }}>
            <h2 style={{ marginBottom: 16 }}>Quản lý bài viết Blog</h2>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
              <Card>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 600, color: '#667eea' }}>{posts.length}</div>
                  <div style={{ color: '#666', marginTop: 4 }}>Tổng bài viết</div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 600, color: '#10B981' }}>{posts.filter(p => p.status === 'PUBLISHED').length}</div>
                  <div style={{ color: '#666', marginTop: 4 }}>Đã xuất bản</div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: 'center' }}>
                  <Badge count={posts.filter(p => p.status === 'DRAFT').length} style={{ backgroundColor: '#f59e0b' }}>
                    <div style={{ fontSize: 28, fontWeight: 600, color: '#f59e0b' }}>{posts.filter(p => p.status === 'DRAFT').length}</div>
                  </Badge>
                  <div style={{ color: '#666', marginTop: 4 }}>Bản nháp</div>
                </div>
              </Card>
              <Card>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 600, color: '#6b7280' }}>{posts.filter(p => p.status === 'ARCHIVED').length}</div>
                  <div style={{ color: '#666', marginTop: 4 }}>Lưu trữ</div>
                </div>
              </Card>
            </div>

            {/* Filter */}
            <Card style={{ marginBottom: 12 }}>
              <Space wrap>
                <Input.Search
                  placeholder="Tìm kiếm theo tiêu đề..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  style={{ width: 300 }}
                />
                <select value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })} style={{ padding: 8 }}>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value as any })} style={{ padding: 8 }}>
                  <option value="ALL">Tất cả</option>
                  <option value="PUBLISHED">Đã xuất bản</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="ARCHIVED">Lưu trữ</option>
                  <option value="DELETED">Đã xóa</option>
                </select>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                  try {
                    window.history.pushState(null, '', '/admin/blog/create');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  } catch {
                    window.location.hash = '#/admin/blog/create';
                  }
                }}>
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
                onRow={(record) => ({
                  onClick: () => {
                    setSelectedPost(record as AdminBlogPost);
                    setDetailVisible(true);
                  }
                })}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
                  { title: 'Tiêu đề', dataIndex: 'title', key: 'title', render: (t: string, r: any) => (<div><div style={{ fontWeight: 600 }}>{t}</div><div style={{ color: '#888' }}>{r.category}</div></div>) },
                  { title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 140, render: (s: AdminPostStatus) => {
                      const map: any = { PUBLISHED: 'green', DRAFT: 'orange', ARCHIVED: 'default', DELETED: 'red' };
                      return <Tag color={map[s] || 'default'}>{s}</Tag>;
                    }
                  },
                  { title: 'Ngày', dataIndex: 'date', key: 'date', width: 140, render: (d: string, r: any) => r.status === 'PUBLISHED' ? d : 'N/A' },
                  { title: 'Tác giả', dataIndex: 'author', key: 'author', width: 160, render: (_: any, r: any) => r.author || `Admin ${r.authorId}` },
                  { title: 'Thao tác', key: 'action', fixed: 'right' as const, width: 220, render: (_: any, r: AdminBlogPost) => (
                      <Space>
                        <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(r.id)}>Sửa</Button>
                        <Button danger icon={<DeleteOutlined />} size="small" onClick={() => {
                          if (r.status !== 'DELETED') softDeletePost(r.id);
                          else hardDeletePost(r.id);
                        }}>{r.status !== 'DELETED' ? 'Xóa mềm' : 'Xóa vĩnh viễn'}</Button>
                      </Space>
                    )
                  }
                ]}
                scroll={{ x: 900 }}
              />
              {/* Detail modal shown when a row is clicked */}
              <BlogDetail
                visible={detailVisible}
                blog={selectedPost}
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