import React, { useEffect, useState, useRef } from "react";
import { getServices, getServiceById, Service as ApiService } from "../api/serviceApi";

type Service = {
  id: string;
  HinhDichVu?: string;
  TenDichVu: string;
  TienDichVu: number;
  TrangThai?: string;
  ThoiLuongUocTinh?: number; // minutes
  ThongTinDV?: string;
  GhiChu?: string;
  ThoiGianBatDau?: string; // ISO time or HH:mm
  ThoiGianKetThuc?: string;
};

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

const placeholderImg = "/img/service-placeholder.png";


const Services: React.FC = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Service | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // slider refs & states
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const handleDragging = useRef(false);
  const [visibleCount, setVisibleCount] = useState<number>(3);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getServices();
        if (!mounted) return;
        const mapped: Service[] = (data || []).map((a: ApiService) => ({
          id: a.iddichVu ?? a.iddichVu ?? String(Math.random()),
          HinhDichVu: a.hinhDichVu ?? undefined,
          TenDichVu: a.tenDichVu ?? "",
          TienDichVu: a.tienDichVu ?? 0,
          TrangThai: a.trangThai ?? undefined,
          ThoiGianBatDau: a.thoiGianBatDau ?? undefined,
          ThoiGianKetThuc: a.thoiGianKetThuc ?? undefined,
        }));
        setServices(mapped);
      } catch (e: any) {
        console.error('Failed to load services', e);
  if (!mounted) return;
  setError(e?.message ?? 'Failed to load services');
  // clear services on error
  setServices([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    load();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);

    const calc = () => {
      const w = window.innerWidth;
      if (w >= 992) return 3;
      if (w >= 768) return 2;
      return 1;
    };
    const apply = () => setVisibleCount(calc());
    apply();
    window.addEventListener('resize', apply);

    return () => {
      mounted = false;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener('resize', apply);
    };
  }, []);

  // update current index when scrolling
  const onScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    const total = services.length;
    if (total <= visibleCount) {
      setCurrentIndex(0);
      return;
    }
    const slideWidth = el.clientWidth / visibleCount;
    const idx = Math.round(el.scrollLeft / (slideWidth || 1));
    const clamped = Math.max(0, Math.min(idx, total - visibleCount));
    setCurrentIndex(clamped);
  };

  // progress handle pointer handlers
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const prog = progressRef.current;
    const track = sliderRef.current;
    if (!prog || !track) return;
    handleDragging.current = true;
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  };

  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!handleDragging.current) return;
    const prog = progressRef.current;
    const track = sliderRef.current;
    if (!prog || !track) return;

    const total = services.length;
    const vis = Math.min(visibleCount, total) || 1;
    const handlePercent = (vis / total) * 100;
    const rect = prog.getBoundingClientRect();
    const maxLeftPercent = Math.max(0, 100 - handlePercent);
    let pct = ((e.clientX - rect.left) / rect.width) * 100 - (handlePercent / 2);
    if (pct < 0) pct = 0;
    if (pct > maxLeftPercent) pct = maxLeftPercent;

    const maxScroll = track.scrollWidth - track.clientWidth;
    const leftRatio = maxLeftPercent > 0 ? pct / maxLeftPercent : 0;
    const targetScroll = Math.round(leftRatio * maxScroll);
    track.scrollLeft = targetScroll;
    const maxIndex = Math.max(0, total - vis);
    const idx = Math.round(leftRatio * maxIndex);
    setCurrentIndex(Math.max(0, Math.min(idx, total - 1)));
  };

  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try { (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId); } catch {}
    handleDragging.current = false;
  };

  const isAvailable = (status?: string) => {
    if (!status) return true;
    const s = status.toLowerCase();
    if (s.includes('ngưng') || s.includes('inactive') || s.includes('không')) return false;
    return true;
  };

  const openDetails = async (s: Service) => {
    setSelected(s);
    setModalOpen(true);
    try {
      // getServiceById returns the merged service object including detail fields
      const detail = await getServiceById(s.id);
      if (detail) {
        setSelected((prev) => prev ? ({ ...prev, ThongTinDV: detail.thongTinDv ?? prev.ThongTinDV, ThoiLuongUocTinh: detail.thoiLuongUocTinh ?? prev.ThoiLuongUocTinh, GhiChu: detail.ghiChu ?? prev.GhiChu }) : prev);
      }
    } catch (e) {
      console.warn('Failed to load service details', e);
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes && minutes !== 0) return "-";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m} phút`;
  };

  return (
    <section className="services-section spad">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="section-title">
              <span>Dịch vụ</span>
              <h2>Các dịch vụ của chúng tôi</h2>
            </div>
          </div>
        </div>

        {/* Slider */}
        {loading && (
          <div style={{ padding: '40px 0' }} className="text-center text-muted">Đang tải dịch vụ...</div>
        )}
        {error && !loading && (
          <div style={{ padding: '24px 0' }} className="text-center text-danger">Lỗi: {error}</div>
        )}
        <div style={{ position: 'relative', overflow: 'visible' }}>
          <button
            aria-label="previous"
            onClick={() => {
              const track = sliderRef.current;
              if (!track) return;
              track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' });
            }}
            style={{
              position: 'absolute',
              left: -36,
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
            ref={sliderRef}
            onScroll={onScroll}
            style={{
              overflowX: 'auto',
              scrollbarWidth: 'none', /* Firefox */
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 8
            }}
          >
            <div style={{ display: 'flex', gap: 16, padding: '8px 4px' }}>
              {services.map((s) => {
                const unavailable = !isAvailable(s.TrangThai);
                return (
                  <div key={s.id} style={{ flex: `0 0 calc(100% / ${visibleCount})`, maxWidth: `calc(100% / ${visibleCount})` }}>
                    <div
                      className="service-card"
                      style={{
                        border: '1px solid #e6e6e6',
                        borderRadius: 8,
                        padding: 12,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        opacity: unavailable ? 0.55 : 1,
                        position: 'relative',
                        background: '#fff'
                      }}
                    >
                      {unavailable && (
                        <span style={{ position: 'absolute', left: 12, top: 12, background: '#d9534f', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                          Không khả dụng
                        </span>
                      )}

                      <div style={{ textAlign: 'center' }}>
                        <img src={s.HinhDichVu || placeholderImg} alt={s.TenDichVu} style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 6, marginBottom: 10 }} />
                      </div>

                      <h5 style={{ margin: '4px 0 6px 0' }}>{s.TenDichVu}</h5>

                      <div style={{ color: '#333', marginBottom: 6 }}>
                        <strong>Giá: </strong>
                        {currencyFormatter.format(s.TienDichVu)}
                      </div>

                      <div style={{ color: '#666', marginBottom: 8 }}>
                        <strong>Thời gian: </strong>
                        {s.ThoiGianBatDau && s.ThoiGianKetThuc ? `${s.ThoiGianBatDau} - ${s.ThoiGianKetThuc}` : '-'}
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" onClick={() => openDetails(s)} disabled={unavailable} style={{ flex: 1 }}>
                          Xem chi tiết
                        </button>
                        <button className="btn btn-outline-secondary" onClick={() => alert('Đặt dịch vụ: ' + s.TenDichVu)} disabled={unavailable}>
                          Đặt
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            aria-label="next"
            onClick={() => {
              const track = sliderRef.current;
              if (!track) return;
              track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
            }}
            style={{
              position: 'absolute',
              right: -36,
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

          {/* Progress bar */}
          {services.length > 0 && (
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <div style={{ width: '60%', margin: '0 auto', position: 'relative' }}>
                <div ref={progressRef} style={{ height: 8, background: '#eee', borderRadius: 6, position: 'relative' }}>
                  {(() => {
                    const total = services.length;
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
                          height: 16,
                          background: '#222',
                          borderRadius: 8,
                          transform: 'translateX(0)',
                          touchAction: 'none',
                          cursor: 'grab'
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
              <div style={{ marginTop: 8, color: '#333', fontWeight: 500 }}>{String(currentIndex + 1).padStart(2, '0')} / {String(services.length).padStart(2, '0')}</div>
            </div>
          )}
        </div>

      </div>

      {/* Modal */}
      {modalOpen && selected && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }} onClick={() => setModalOpen(false)}>
          <div className="service-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(900px, 95%)', background: '#fff', borderRadius: 8, overflow: 'hidden', maxHeight: '90%', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <img src={selected.HinhDichVu || placeholderImg} alt={selected.TenDichVu} style={{ width: '100%', height: 360, objectFit: 'cover', padding: 18}} />
              </div>
              <div style={{ flex: 1, padding: 18, overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ marginTop: 0 }}>{selected.TenDichVu}</h3>
                    <div style={{ marginBottom: 8 }}><strong>Giá: </strong>{currencyFormatter.format(selected.TienDichVu)}</div>
                    <div style={{ marginBottom: 8 }}><strong>Trạng thái: </strong>{isAvailable(selected.TrangThai) ? (<span style={{ color: 'green' }}>Khả dụng</span>) : (<span style={{ color: '#d9534f' }}>Không khả dụng</span>)}</div>
                    <div style={{ marginBottom: 8 }}><strong>Thời lượng ước tính: </strong>{formatDuration(selected.ThoiLuongUocTinh)}</div>
                    <div style={{ marginBottom: 8 }}><strong>Khung giờ áp dụng: </strong>{selected.ThoiGianBatDau || '-'} — {selected.ThoiGianKetThuc || '-'}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <button aria-label="Đóng" className="btn btn-light" onClick={() => setModalOpen(false)}>Đóng</button>
                  </div>
                </div>

                <hr />

                <div style={{ marginBottom: 8 }}><strong>Mô tả:</strong><p>{selected.ThongTinDV || 'Không có mô tả'}</p></div>

                <div style={{ marginBottom: 8 }}><strong>Ghi chú:</strong><p>{selected.GhiChu || '-'}</p></div>

                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => { alert('Xác nhận đặt: ' + selected.TenDichVu); }} disabled={!isAvailable(selected.TrangThai)}>Đặt dịch vụ</button>
                  <button className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>Đóng</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Services;
