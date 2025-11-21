import React from "react";
import blogPosts from "../data/blogPosts";

const BlogSection: React.FC = () => {
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
        <div className="row mt-4">
          {blogPosts.map((post, idx) => {
            // Determine column sizes based on index to preserve original layout
            let colClass = "col-lg-4 col-md-6 mb-4";
            let minHeight = "300px";
            let large = false;
            if (idx === 0 || idx === 1) {
              colClass = "col-lg-6 col-md-12 mb-4";
              minHeight = "450px";
              large = true;
            }

            const overlay = post.type === "external" ? { ...overlayStyle, backgroundColor: 'rgba(139, 0, 0, 0.5)' } : overlayStyle;

            const handleInternalNav = (e: React.MouseEvent, path: string) => {
              e.preventDefault();
              try {
                window.history.pushState(null, "", path);
                window.dispatchEvent(new PopStateEvent("popstate"));
              } catch (err) {
                // fallback to full navigation
                window.location.href = path;
              }
            };

            const linkHref = post.type === "external" && post.externalLink ? post.externalLink : `/blog/${post.id}`;
            const isExternal = post.type === "external" && post.externalLink;

            return (
              <div className={colClass} key={post.id}>
                <div
                  className={`blog-item ${large ? "large-size" : ""}`}
                  style={{
                    backgroundImage: `url(${post.image})`,
                    minHeight,
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '8px',
                  }}
                >
                  <div style={overlay} className="hover-overlay" />
                  <div className="bi-text" style={{ position: 'absolute', bottom: large ? '30px' : '20px', left: large ? '30px' : '20px', color: 'white', zIndex: 2 }}>
                    <span className="b-tag" style={{ background: post.type === 'external' ? '#FF4500' : '#B8860B', padding: '5px 10px', fontWeight: post.type === 'external' ? 'bold' : undefined }}>
                      {post.category}
                    </span>
                    <h4 style={{ marginTop: '10px', marginBottom: '5px', fontSize: large ? '2rem' : undefined }}>
                      {isExternal ? (
                        <a href={linkHref} target="_blank" rel="noopener noreferrer" style={{ color: 'white', textDecoration: 'none' }}>
                          {post.title}
                        </a>
                      ) : (
                        <a href={linkHref} onClick={(e) => handleInternalNav(e, linkHref)} style={{ color: 'white', textDecoration: 'none' }}>
                          {post.title}
                        </a>
                      )}
                    </h4>
                    <div className="b-time" style={{ opacity: post.type === 'external' ? 0.9 : 0.8, fontWeight: post.type === 'external' ? 'bold' : undefined }}>
                      <i className="icon_clock_alt"></i> {post.date}
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      {post.type === 'external' ? (
                        <a href={linkHref} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: '#FF4500', color: 'white', padding: '6px 10px', borderRadius: 4 }}>
                          Xem tin tức
                        </a>
                      ) : (
                        <a href={linkHref} onClick={(e) => handleInternalNav(e, linkHref)} className="btn btn-sm" style={{ background: '#B8860B', color: 'white', padding: '6px 10px', borderRadius: 4 }}>
                          Xem chi tiết
                        </a>
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