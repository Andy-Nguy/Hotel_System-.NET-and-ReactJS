import React, { useState, useEffect } from "react";
import { message } from 'antd';
import blogPosts from "../data/blogPosts";
import blogApi from "../api/blogApi";

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
  content?: string;
  images?: string[];
  status?: string;
  displayOrder?: number;
}

const BlogSection: React.FC = () => {
  const [featuredBlogs, setFeaturedBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch top 5 featured/published blogs from API
  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const data = await blogApi.getAllBlogs({ limit: 5 });
        // If backend erroneously returns more than 5 published posts, alert the user
        try {
          const totalReturned = Array.isArray(data) ? (data as any[]).length : 0;
          if (totalReturned > 5) {
            message.error('Có nhiều hơn 5 bài đã xuất bản. Hệ thống chỉ cho phép tối đa 5 bài, vui lòng kiểm tra quản trị.');
          }
        } catch (e) {
          // ignore messaging errors
        }
        // Map API response to BlogPost format and normalize displayOrder
        const apiArray = Array.isArray(data) ? (data as any[]) : [];
        const mapped = apiArray
          .filter(d => (d.status || '').toString().toUpperCase() === 'PUBLISHED' && (d.displayOrder !== undefined && d.displayOrder !== null))
          .map(d => ({
          id: d.id,
          title: d.title || '',
          category: d.category || '',
          type: (d.type || 'internal') as 'internal' | 'external',
          image: d.image || '',
          date: d.date || d.publishedAt || '',
          excerpt: d.excerpt || '',
          author: d.author || '',
          tags: typeof d.tags === 'string' ? d.tags.split(',').map((t: string) => t.trim()) : (d.tags || []),
          content: d.content || '',
          images: d.images || [],
          externalLink: d.externalLink || '',
          status: d.status || '',
          displayOrder: typeof d.displayOrder === 'number' ? d.displayOrder : (typeof d.displayOrder === 'string' && !isNaN(parseInt(d.displayOrder)) ? parseInt(d.displayOrder) : undefined),
        } as BlogPost));
        // Sort by displayOrder ascending and take up to 5
        mapped.sort((a, b) => (typeof a.displayOrder === 'number' ? a.displayOrder! : 999) - (typeof b.displayOrder === 'number' ? b.displayOrder! : 999));
        const final = mapped.slice(0, 5);
        console.log('[BlogSection] fetched ordered displayOrders:', final.map(f => f.displayOrder));
        setFeaturedBlogs(final.length > 0 ? final : blogPosts.slice(0, 5));
      } catch (e) {
        console.warn('Blog API not reachable, using local posts');
        setFeaturedBlogs(blogPosts.slice(0, 5));
      } finally {
        setLoading(false);
      }
    };
    fetchBlogs();

    // Re-fetch when admin updates ordering
    const onUpdated = () => fetchBlogs();
    window.addEventListener('blogs-updated', onUpdated);
    return () => window.removeEventListener('blogs-updated', onUpdated);
  }, []);

  // Style chung cho lớp phủ (overlay) để làm hình ảnh tối đi và làm nổi bật chữ trắng
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Lớp phủ màu đen 30%
    transition: 'background-color 0.3s ease',
  };

  if (loading) {
    return (
      <section className="blog-section spad">
        <div className="container">
          <div className="row">
            <div className="col-lg-12 text-center">
              <p>Đang tải bài viết...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Cấu trúc layout 6+6 / 4+4+4 (hoặc 4+8) đã được thiết lập sẵn trong component
  return (
    <section className="blog-section spad">
      <div className="container">
        {/* Tiêu đề Sang trọng */}
        <div className="row">
          <div className="col-lg-12">
            <div className="section-title text-center">
              {/* Giả định CSS cho "section-title" sử dụng font chữ thanh mảnh, màu sắc trung tính (trắng, vàng kim nhạt) */}
              <span style={{ letterSpacing: '2px', textTransform: 'uppercase', color: '#B8860B' }}>
                LUXURY TRAVEL & EVENT
              </span>
              <h2 style={{ fontSize: '3rem', fontWeight: 300, color: '#333' }}>
                Khám Phá Đà Lạt Tinh Hoa
              </h2>
            </div>
          </div>
        </div>
        
        {/* Phần Nội dung Blog - Layout Sang trọng */}
        {/* Row 1: show up to 2 large posts (indexes 0,1) left-to-right */}
        <div className="row mt-4">
          {(featuredBlogs.slice(0, 2)).map((post, idx) => {
            const large = true;
            const minHeight = '450px';
            // Apply red overlay only for the emergency-alert category
            const isEmergencyCategory = (post.category || '').toString().trim().toUpperCase() === 'CẢNH BÁO KHẨN CẤP';
            const overlay = isEmergencyCategory ? { ...overlayStyle, backgroundColor: 'rgba(139, 0, 0, 0.5)' } : overlayStyle;
            const handleInternalNav = (e: React.MouseEvent, path: string) => {
              e.preventDefault();
              try { window.history.pushState(null, "", path); window.dispatchEvent(new PopStateEvent('popstate')); } catch { window.location.href = path; }
            };
            const linkHref = post.type === 'external' && post.externalLink ? post.externalLink : `/blog/${post.id}`;
            const isExternal = post.type === 'external' && post.externalLink;

            return (
              <div className="col-lg-6 col-md-12 mb-4" key={post.id}>
                <div className={`blog-item ${large ? 'large-size' : ''}`} style={{ backgroundImage: `url(${post.image})`, minHeight, position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
                  <div style={overlay} className="hover-overlay" />
                  <div className="bi-text" style={{ position: 'absolute', bottom: large ? '30px' : '20px', left: large ? '30px' : '20px', color: 'white', zIndex: 2 }}>
                    <span className="b-tag" style={{ background: post.type === 'external' ? '#FF4500' : '#B8860B', padding: '5px 10px', fontWeight: post.type === 'external' ? 'bold' : undefined }}>{post.category}</span>
                    <h4 style={{ marginTop: '10px', marginBottom: '5px', fontSize: '2rem' }}>{isExternal ? (<a href={linkHref} target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none' }}>{post.title}</a>) : (<a href={linkHref} onClick={(e) => handleInternalNav(e, linkHref)} style={{ color: 'white', textDecoration: 'none' }}>{post.title}</a>)}</h4>
                    <div className="b-time" style={{ opacity: post.type === 'external' ? 0.9 : 0.8, fontWeight: post.type === 'external' ? 'bold' : undefined }}><i className="icon_clock_alt"></i> {post.date}</div>
                    <div style={{ marginTop: '8px' }}>
                      {isEmergencyCategory ? (
                        <a href={linkHref} onClick={(e) => { if (!isExternal) { e.preventDefault(); handleInternalNav(e, linkHref); } }} className="btn btn-sm" style={{ background: '#B22222', color: 'white', padding: '6px 10px', borderRadius: 4 }}>Xem tin tức</a>
                      ) : (
                        <a href={linkHref} onClick={(e) => { if (!isExternal) { e.preventDefault(); handleInternalNav(e, linkHref); } }} className="btn btn-sm" style={{ background: '#B8860B', color: 'white', padding: '6px 10px', borderRadius: 4 }}>Xem chi tiết</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Row 2: show up to 3 smaller posts (indexes 2,3,4) left-to-right */}
        <div className="row mt-2">
          {(featuredBlogs.slice(2, 5)).map((post) => {
            const minHeight = '300px';
            const isEmergencyCategory = (post.category || '').toString().trim().toUpperCase() === 'CẢNH BÁO KHẨN CẤP';
            const overlay = isEmergencyCategory ? { ...overlayStyle, backgroundColor: 'rgba(139, 0, 0, 0.5)' } : overlayStyle;
            const handleInternalNav = (e: React.MouseEvent, path: string) => { e.preventDefault(); try { window.history.pushState(null, "", path); window.dispatchEvent(new PopStateEvent('popstate')); } catch { window.location.href = path; } };
            const linkHref = post.type === 'external' && post.externalLink ? post.externalLink : `/blog/${post.id}`;
            const isExternal = post.type === 'external' && post.externalLink;

            return (
              <div className="col-lg-4 col-md-6 mb-4" key={post.id}>
                <div className="blog-item" style={{ backgroundImage: `url(${post.image})`, minHeight, position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
                  <div style={overlay} className="hover-overlay" />
                  <div className="bi-text" style={{ position: 'absolute', bottom: '20px', left: '20px', color: 'white', zIndex: 2 }}>
                    <span className="b-tag" style={{ background: post.type === 'external' ? '#FF4500' : '#B8860B', padding: '5px 10px', fontWeight: post.type === 'external' ? 'bold' : undefined }}>{post.category}</span>
                    <h4 style={{ marginTop: '10px', marginBottom: '5px' }}>{isExternal ? (<a href={linkHref} target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none' }}>{post.title}</a>) : (<a href={linkHref} onClick={(e) => handleInternalNav(e, linkHref)} style={{ color: 'white', textDecoration: 'none' }}>{post.title}</a>)}</h4>
                    <div className="b-time" style={{ opacity: post.type === 'external' ? 0.9 : 0.8, fontWeight: post.type === 'external' ? 'bold' : undefined }}><i className="icon_clock_alt"></i> {post.date}</div>
                    <div style={{ marginTop: '8px' }}>
                      {isEmergencyCategory ? (
                        <a href={linkHref} onClick={(e) => { if (!isExternal) { e.preventDefault(); handleInternalNav(e, linkHref); } }} className="btn btn-sm" style={{ background: '#B22222', color: 'white', padding: '6px 10px', borderRadius: 4 }}>Xem tin tức</a>
                      ) : (
                        <a href={linkHref} onClick={(e) => { if (!isExternal) { e.preventDefault(); handleInternalNav(e, linkHref); } }} className="btn btn-sm" style={{ background: '#B8860B', color: 'white', padding: '6px 10px', borderRadius: 4 }}>Xem chi tiết</a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BlogSection;