import React from "react";
import blogPosts from "../data/blogPosts"; // Giả định đường dẫn data là "../data/blogPosts"

// --- TYPE DEFINITIONS ---
interface BlogPost {
  id: number;
  title: string;
  category: string;
  type: "internal" | "external";
  externalLink?: string;
  image: string;
  date: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  content?: string; // html or plain text
  images?: string[]; // gallery images
}

// Giả định BlogDetail.tsx nằm trong thư mục components
const BlogDetail: React.FC = () => {
  // Try to read id from pathname (/blog/:id) or hash (#/blog/:id)
  const resolveId = (): number | null => {
    try {
      const p = window.location.pathname;
      const m = p.match(/\/blog\/(\d+)/);
      if (m) return parseInt(m[1], 10);
    } catch {}
    try {
      const h = window.location.hash;
      const m = h.match(/\/blog\/(\d+)/);
      if (m) return parseInt(m[1], 10);
    } catch {}
    // Giả định ID 1 nếu không tìm thấy để hiển thị bài mẫu
    return 1;
  };

  const id = resolveId();
  const [post, setPost] = React.useState<BlogPost | undefined>(undefined);
  const [relatedPosts, setRelatedPosts] = React.useState<BlogPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mainImage, setMainImage] = React.useState<string | undefined>(undefined);

  const readingTime = React.useMemo(() => {
    if (!post) return 0;
    const words = (post.content || "").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [post]);

  // Fetch blog from API
  React.useEffect(() => {
    if (!id) return;
    
    const fetchBlog = async () => {
      try {
        const res = await fetch(`/api/blog/${id}`);
        if (res.ok) {
          const data = await res.json();
          const mapped: BlogPost = {
            id: data.id,
            title: data.title || '',
            category: data.category || '',
            type: (data.type || 'internal') as 'internal' | 'external',
            image: data.image || '',
            date: data.date || data.publishedAt || '',
            excerpt: data.excerpt || '',
            author: data.author || '',
            tags: typeof data.tags === 'string' ? data.tags.split(',').map((t: string) => t.trim()) : (data.tags || []),
            content: data.content || '',
            images: data.images || [],
            externalLink: data.externalLink || '',
          };
          setPost(mapped);
          setMainImage(mapped.images?.[0] || mapped.image);
        } else {
          // Fallback to local data
          const localPost = (blogPosts as BlogPost[]).find((p) => p.id === id);
          setPost(localPost);
          setMainImage(localPost?.images?.[0] || localPost?.image);
        }
      } catch (e) {
        console.warn('Blog API not reachable, using local data');
        const localPost = (blogPosts as BlogPost[]).find((p) => p.id === id);
        setPost(localPost);
        setMainImage(localPost?.images?.[0] || localPost?.image);
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [id]);

  // Increment view count
  React.useEffect(() => {
    if (!id) return;
    fetch(`/api/blog/${id}/tang-luot-xem`, { method: 'POST' })
      .catch(e => console.warn('View count update failed'));
  }, [id]);

  // Fetch related posts
  React.useEffect(() => {
    const fetchRelated = async () => {
      try {
        const res = await fetch('/api/blog?limit=4');
        if (res.ok) {
          const data = await res.json();
          const mapped = (data as any[])
            .filter((d: any) => d.id !== id)
            .slice(0, 3)
            .map(d => ({
              id: d.id,
              title: d.title || '',
              category: d.category || '',
              type: (d.type || 'internal') as 'internal' | 'external',
              image: d.image || '',
              date: d.date || d.publishedAt || '',
              images: d.images || [],
            } as BlogPost));
          setRelatedPosts(mapped.length > 0 ? mapped : blogPosts.filter((p: BlogPost) => p.id !== id).slice(0, 3));
        } else {
          setRelatedPosts(blogPosts.filter((p: BlogPost) => p.id !== id).slice(0, 3));
        }
      } catch (e) {
        setRelatedPosts(blogPosts.filter((p: BlogPost) => p.id !== id).slice(0, 3));
      }
    };
    fetchRelated();
  }, [id]);

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto" style={{ padding: '60px 0' }}>
        <p>Đang tải bài viết...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container max-w-4xl mx-auto" style={{ padding: '60px 0' }}>
        <h2 className="text-3xl font-bold">Bài viết không tìm thấy</h2>
        <p className="mt-4">Không có bài viết nào phù hợp với ID này.</p>
      </div>
    );
  }

  // Xử lý nội dung để hiển thị Markdown (## Tiêu đề, List)
  const renderContent = (content: string) => {
    return content.trim().split('\n\n').map((block, idx) => {
      if (block.startsWith('## ')) {
        // Render block as h3
        return <h3 key={idx} style={{ fontSize: '1.75rem', fontWeight: 500, marginTop: '24px', marginBottom: '12px', color: '#333' }}>{block.replace('## ', '')}</h3>;
      }
      if (block.trim().startsWith('*')) {
        // Render block as ul list
        const items = block.trim().split('\n').map(item => item.trim().replace('*', '').trim());
        return (
          <ul key={idx} style={{ marginBottom: '16px', paddingLeft: '20px', listStyleType: 'disc', color: '#555' }}>
            {items.map((item, itemIdx) => <li key={itemIdx} style={{ marginBottom: '4px' }}>{item}</li>)}
          </ul>
        );
      }
      // Render as standard paragraph
      return <p key={idx} style={{ marginBottom: '16px', lineHeight: 1.8 }}>{block.trim()}</p>;
    });
  };

  return (
    <section className="blog-detail bg-gray-50 font-sans" style={{ padding: '60px 0' }}>
      <div className="container max-w-4xl mx-auto bg-white shadow-xl rounded-lg p-8 lg:p-12">
        <div style={{ marginBottom: 20 }}>
          <span style={{ letterSpacing: '2px', textTransform: 'uppercase', color: post.type === 'external' ? '#FF4500' : '#B8860B', fontSize: '0.85rem', fontWeight: 600 }}>
            {post.category}
          </span>
          <h1 style={{ fontSize: '3rem', fontWeight: 300, color: '#333', marginTop: 10 }}>
            {post.title}
          </h1>
          <div style={{ color: '#777', marginTop: 8, display: 'flex', gap: '15px' }}>
            <span style={{ display: 'flex', alignItems: 'center' }}><i className="icon_clock_alt mr-1"></i> {post.date}</span>
            <span style={{ display: 'flex', alignItems: 'center' }}>• {readingTime} phút đọc</span>
            {post.author && <span style={{ color: '#555' }}>• Bởi <strong>{post.author}</strong></span>}
          </div>
        </div>

        {/* Gallery / main image */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 320, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <img 
              src={mainImage || post.image} 
              alt={post.title} 
              style={{ width: '100%', display: 'block', height: 400, objectFit: 'cover' }} 
            />
          </div>
          
          {/* Thumbnail Selector */}
          <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(post.images || [post.image]).map((src, i) => (
              <button 
                key={i} 
                onClick={() => setMainImage(src)} 
                style={{ 
                  border: 'none', 
                  padding: 0, 
                  cursor: 'pointer', 
                  background: 'transparent',
                  opacity: mainImage === src ? 1 : 0.7,
                  transition: 'opacity 0.2s'
                }}
              >
                <img 
                  src={src} 
                  alt={`${post.title}-${i}`} 
                  style={{ 
                    width: '100%', 
                    height: 100, 
                    objectFit: 'cover', 
                    borderRadius: 6, 
                    border: mainImage === src ? '3px solid #B8860B' : '1px solid rgba(0,0,0,0.08)' 
                  }} 
                />
              </button>
            ))}
            {post.type === 'external' && post.externalLink && (
              <a href={post.externalLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 16, background: '#FF4500', color: 'white', padding: '10px 15px', borderRadius: 6, textAlign: 'center', textDecoration: 'none', fontWeight: 600 }}>
                <i className="icon_document_alt mr-1"></i> Mở nguồn tin chính thống
              </a>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ color: '#333' }}>
          {post.content ? (
            renderContent(post.content)
          ) : (
            <p className="italic text-gray-600">{post.excerpt || 'Nội dung đang được cập nhật. Hãy quay lại sau để xem bài viết chi tiết.'}</p>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div style={{ marginTop: 40, borderTop: '1px solid #eee', paddingTop: 20 }}>
            <strong style={{ color: '#555', marginRight: 10 }}>Tags:</strong>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {post.tags.map((t) => (
                <span key={t} style={{ background: '#f8f8f8', padding: '6px 12px', borderRadius: 20, fontSize: '0.85rem', color: '#888' }}>
                  #{t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Related posts */}
        <div style={{ marginTop: 40 }}>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 400, borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 16 }}>Bài viết liên quan</h3>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {relatedPosts.map((rel) => (
              <a 
                key={rel.id} 
                href={`/blog/${rel.id}`} 
                onClick={(e) => { 
                  e.preventDefault(); 
                  try{ 
                    // Giả lập navigation
                    window.history.pushState(null, '', `/blog/${rel.id}`); 
                    // Kích hoạt re-render cho component cha (cần logic router bên ngoài)
                    window.dispatchEvent(new PopStateEvent('popstate')); 
                  } catch { 
                    window.location.href = `/blog/${rel.id}` 
                  } 
                }} 
                style={{ display: 'block', width: 'calc(33% - 16px)', minWidth: 150, textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 8, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                  <img src={rel.images?.[0] || rel.image} alt={rel.title} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
                </div>
                <div style={{ fontWeight: 500, fontSize: '1.05rem', color: '#333' }}>{rel.title}</div>
                <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{rel.date}</div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BlogDetail;