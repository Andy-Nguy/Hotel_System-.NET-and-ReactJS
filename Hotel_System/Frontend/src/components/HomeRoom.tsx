import React, { useEffect, useState, useRef } from "react";

function resolveImageUrl(u?: string | null) {
  if (!u) return undefined;
  const s = String(u).trim();
  if (!s) return undefined;
  if (s.startsWith('http') || s.startsWith('//')) return s;
  if (s.startsWith('/img')) return s; // already relative img path
  if (s.startsWith('/assets')) return s; // keep relative
  if (s.startsWith('/')) return s; // other relative path
  // filename only -> use relative path to /img/room so dev proxy forwards to backend
  return `/img/room/${s}`;
}
import { getRoomTypes } from "../api/roomsApi";

type RoomType = {
  idLoaiPhong: string;
  tenLoaiPhong?: string | null;
  moTa?: string | null;
  urlAnhLoaiPhong?: string | null;
  [key: string]: any;
};

const HomeRoom: React.FC = () => {
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const dragged = useRef(false);
  const [visibleCount, setVisibleCount] = useState<number>(4);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const handleDragging = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = sliderRef.current;
    if (!el) return;
    isDragging.current = true;
    dragged.current = false;
    startX.current = e.clientX;
    startScroll.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = sliderRef.current;
    if (!el || !isDragging.current) return;
    const x = e.clientX;
    const walk = x - startX.current;
    if (Math.abs(walk) > 5) dragged.current = true;
    el.scrollLeft = startScroll.current - walk;
  };

  const endDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    const el = sliderRef.current;
    if (!el) return;
    isDragging.current = false;
    try {
      if (e && e.pointerId) el.releasePointerCapture(e.pointerId);
    } catch {}
    el.style.cursor = 'grab';
    // small timeout reset
    setTimeout(() => { dragged.current = false; }, 50);
  };

  // determine visible count by breakpoint
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      if (w >= 992) return 4;
      if (w >= 768) return 3;
      if (w >= 576) return 2;
      return 1;
    };
    const apply = () => setVisibleCount(calc());
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // update current index when scrolling
  const onScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    const total = types.length;
    if (total <= visibleCount) {
      setCurrentIndex(0);
      return;
    }
    const slideWidth = el.clientWidth / visibleCount;
    const idx = Math.round(el.scrollLeft / (slideWidth || 1));
    const clamped = Math.max(0, Math.min(idx, total - 1));
    setCurrentIndex(clamped);
  };

  // ---- progress handle drag handlers ----
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const prog = progressRef.current;
    const track = sliderRef.current;
    if (!prog || !track) return;
    handleDragging.current = true;
    // set pointer capture on the element that received the event (the handle)
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!handleDragging.current) return;
    const prog = progressRef.current;
    const track = sliderRef.current;
    if (!prog || !track) return;

    const total = types.length;
    const vis = Math.min(visibleCount, total) || 1;
    const handlePercent = (vis / total) * 100;
    const rect = prog.getBoundingClientRect();
    const maxLeftPercent = Math.max(0, 100 - handlePercent);
    // pointer position relative to progress bar
    let pct = ((e.clientX - rect.left) / rect.width) * 100 - (handlePercent / 2);
    if (pct < 0) pct = 0;
    if (pct > maxLeftPercent) pct = maxLeftPercent;

    // map percent to scrollLeft
    const maxScroll = track.scrollWidth - track.clientWidth;
    const leftRatio = maxLeftPercent > 0 ? pct / maxLeftPercent : 0;
    const targetScroll = Math.round(leftRatio * maxScroll);
    track.scrollLeft = targetScroll;
    // update index
    const maxIndex = Math.max(0, total - vis);
    const idx = Math.round(leftRatio * maxIndex);
    setCurrentIndex(Math.max(0, Math.min(idx, total - 1)));
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    // release pointer capture from the element that had it
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch {}
    handleDragging.current = false;
  };
  // ---- end progress handle ----

  useEffect(() => {
    let mounted = true;
    const fetchTypes = async () => {
      try {
        const data = await getRoomTypes();
        if (!mounted) return;
        const normalized = (data || []).map((t: any) => ({
          idLoaiPhong: t.idLoaiPhong ?? t.IdloaiPhong ?? t.IdLoaiPhong ?? t.idLoaiPhong,
          tenLoaiPhong: t.tenLoaiPhong ?? t.TenLoaiPhong ?? t.tenLoaiPhong,
          moTa: t.moTa ?? t.MoTa,
          urlAnhLoaiPhong: t.urlAnhLoaiPhong ?? t.UrlAnhLoaiPhong,
          ...t,
        }));
        setTypes(normalized);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Failed to load room types");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    fetchTypes();
    return () => {
      mounted = false;
    };
  }, []);

  const goToRoomPage = (id?: string) => {
    if (!id) return;
    window.location.hash = `#rooms?loaiId=${encodeURIComponent(id)}`;
  };

  if (loading) {
    return (
      <section className="hp-room-section">
        <div className="container-fluid">
          <div>Loading room types...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="hp-room-section">
        <div className="container-fluid">
          <div className="text-danger">Error loading room types: {error}</div>
        </div>
      </section>
    );
  }

  return (
    <>
      <style>
        {`
          .homeroom-container {
            padding-left: 150px !important;
            padding-right: 150px !important;
          }
          
          .homeroom-section {
            padding: 80px 0 !important;
          }
          
          .room-card {
            transition: all 0.3s ease !important;
          }
          
          .room-card:hover {
            transform: translateY(-8px) !important;
            box-shadow: 0 12px 36px rgba(0,0,0,0.2) !important;
          }
          
          .room-card .room-content {
            opacity: 0 !important;
            visibility: hidden !important;
            transition: all 0.4s ease !important;
            transform: translateY(20px) !important;
          }
          
          .room-card:hover .room-content {
            opacity: 1 !important;
            visibility: visible !important;
            transform: translateY(0) !important;
          }
          
          .room-card:hover .room-title {
            color: #dfa974 !important;
          }
          
          .room-card:hover .room-overlay {
            background: linear-gradient(45deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.5) 100%) !important;
          }
          
          @media (max-width: 768px) {
            .homeroom-container {
              padding-left: 20px !important;
              padding-right: 20px !important;
            }
            
            .homeroom-section {
              padding: 60px 0 !important;
            }
            
            .section-title {
              font-size: 2rem !important;
            }
          }
          
          @media (max-width: 576px) {
            .room-card {
              height: 350px !important;
            }
            
            .room-content {
              padding: 20px !important;
            }
          }
        `}
      </style>
      <section className="hp-room-section homeroom-section">
        <div className="container-fluid homeroom-container">
        {/* Section Header */}
        <div className="row">
          <div className="col-12">
            <div className="text-center mb-5">
              <h2 className="section-title" style={{ 
                fontSize: '2.5rem', 
                fontWeight: '700',
                color: '#333',
                marginBottom: '20px',
                position: 'relative'
              }}>
                Loại phòng của chúng tôi
              </h2>
              <div style={{
                width: '100px',
                height: '3px',
                backgroundColor: '#dfa974',
                margin: '0 auto 30px',
                borderRadius: '2px'
              }}></div>
              <p style={{ 
                fontSize: '1.1rem', 
                color: '#666',
                maxWidth: '600px',
                margin: '0 auto',
                lineHeight: '1.6'
              }}>
                Khám phá các loại phòng đẳng cấp với tiện nghi hiện đại và dịch vụ tuyệt vời
              </p>
            </div>
          </div>
        </div>

        <div className="hp-room-items">
          {/* Slider wrapper: shows 4 items per view on desktop, responsive down to 2/1 */}
          <div className="slider-wrapper" style={{ position: 'relative', overflow: 'visible' }}>
            <button
              className="slider-btn prev"
              aria-label="previous"
              onClick={() => {
                const track = sliderRef.current;
                if (!track) return;
                track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
              }}
              style={{
                position: 'absolute',
                left: -32,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 999,
                background: 'rgba(255,255,255,0.95)',
                border: 'none',
                width: 40,
                height: 40,
                borderRadius: 20,
                boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: '#222'
              }}
            >
              ‹
            </button>

            <div
              className="slider-track"
              ref={sliderRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onPointerLeave={endDrag}
              onScroll={onScroll}
              style={{
                overflow: 'hidden',
                scrollBehavior: 'smooth',
                cursor: 'grab',
                touchAction: 'pan-y'
              }}
            >
              <div className="slider-inner" style={{ display: 'flex', gap: 24 }}>
                {types.length === 0 && (
                  <div style={{ padding: '40px 0' }} className="text-center text-muted">Không tìm thấy loại phòng nào.</div>
                )}

                {types.map((type) => (
                  <div key={type.idLoaiPhong} className="slide" style={{ flex: '0 0 25%' }} onClick={(e) => {
                    // Prevent accidental click when user was dragging
                    if (dragged.current && e.target === e.currentTarget) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}>
                    <div
                      className="hp-room-item room-card"
                      style={{
                        backgroundImage: `url(${resolveImageUrl(type.urlAnhLoaiPhong) ?? `/img/room/room-b1.jpg`})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        height: '400px',
                        position: 'relative',
                        cursor: 'pointer'
                      }}
                    >
                      <div className="room-overlay" style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(45deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.2) 100%)',
                        transition: 'all 0.3s ease'
                      }}></div>

                      <div className="hr-text room-content" style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: '30px 25px',
                        color: 'white',
                        zIndex: 2
                      }}>
                        <h3 className="room-title" style={{
                          fontSize: '1.5rem',
                          fontWeight: '600',
                          marginBottom: '12px',
                          color: 'white',
                          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                          transition: 'color 0.3s ease'
                        }}>
                          {type.tenLoaiPhong ?? `Loại phòng`}
                        </h3>
                        <p style={{
                          minHeight: '48px',
                          marginBottom: '20px',
                          color: 'rgba(255,255,255,0.9)',
                          lineHeight: '1.5',
                          fontSize: '0.95rem'
                        }}>
                          {type.moTa ?? 'Trải nghiệm không gian nghỉ dưỡng tuyệt vời với đầy đủ tiện nghi hiện đại.'}
                        </p>
                        <div style={{ marginTop: '16px' }}>
                          <button
                            onClick={() => goToRoomPage(type.idLoaiPhong)}
                            style={{
                              background: 'linear-gradient(135deg, #dfa974 0%, #c8956d 100%)',
                              border: 'none',
                              padding: '12px 28px',
                              borderRadius: '25px',
                              fontWeight: '600',
                              fontSize: '0.95rem',
                              transition: 'all 0.3s ease',
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              boxShadow: '0 4px 15px rgba(223, 169, 116, 0.4)',
                              textDecoration: 'none',
                              borderBottom: 'none',
                              display: 'inline-block',
                              color: '#fff'
                            }}
                          >
                            Xem chi tiết
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="slider-btn next"
              aria-label="next"
              onClick={() => {
                const track = sliderRef.current;
                if (!track) return;
                track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
              }}
              style={{
                position: 'absolute',
                right: -32,
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 999,
                background: 'rgba(255,255,255,0.95)',
                border: 'none',
                width: 40,
                height: 40,
                borderRadius: 20,
                boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: '#222'
              }}
            >
              ›
            </button>
          </div>
          {/* Progress bar + counter */}
          {types.length > 0 && (
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <div style={{ width: '60%', margin: '0 auto', position: 'relative' }}>
                <div ref={progressRef} style={{ height: 6, background: 'transparent', borderRadius: 4, position: 'relative' }}>
                  {/* handle */}
                  {(() => {
                  const total = types.length;
                  const vis = Math.min(visibleCount, total) || 1;
                  const handlePercent = (vis / total) * 100;
                  const maxIndex = Math.max(0, total - vis);
                  const leftPercent = maxIndex > 0 ? (currentIndex / maxIndex) * (100 - handlePercent) : 0;
                    return (
                      <div
                        onPointerDown={onHandlePointerDown}
                        onPointerMove={onHandlePointerMove}
                        onPointerUp={onHandlePointerUp}
                        onPointerCancel={onHandlePointerUp}
                        style={{
                          position: 'absolute',
                          top: -4,
                          left: `${leftPercent}%`,
                          width: `${handlePercent}%`,
                          height: 14,
                          background: '#222',
                          borderRadius: 6,
                          transform: 'translateX(0)',
                          touchAction: 'none',
                          cursor: 'grab'
                        }}
                      />
                    );
                })()}
                </div>
              </div>
              <div style={{ marginTop: 8, color: '#333', fontWeight: 500 }}>{String(currentIndex + 1).padStart(2, '0')} / {String(types.length).padStart(2, '0')}</div>
            </div>
          )}
        </div>
      </div>
    </section>
    </>
  );
};

export default HomeRoom;
