import React, { useEffect, useState, useRef } from "react";
import { getServices, getServiceById, Service as ApiService } from "../api/serviceApi";
import { getPromotionsForService, getAllPromotions } from "../api/promotionApi";
import ComboCard from './ComboCard';
import DetailComboCard from './DetailComboCard';

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
  // promotion fields (optional, filled client-side)
  promotionId?: string | null;
  promotionName?: string | null;
  loaiGiamGia?: string | null;
  giaTriGiam?: number | null;
  discountedPrice?: number | null;
  promotionMoTa?: string | null;
  promotionBanner?: string | null;
  promotionNgayBatDau?: string | null;
  promotionNgayKetThuc?: string | null;
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
  const [selectedPromotion, setSelectedPromotion] = useState<any | null>(null);

  // slider refs & states
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const handleDragging = useRef(false);
  const [visibleCount, setVisibleCount] = useState<number>(3);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [combos, setCombos] = useState<any[]>([]);
  const [selectedCombo, setSelectedCombo] = useState<any | null>(null);
  const [comboModalOpen, setComboModalOpen] = useState(false);

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
        // Load combos from khuyenMaiCombos (only active promotions)
        try {
          const promos = await getAllPromotions("active");
          if (Array.isArray(promos) && promos.length > 0) {
            // Extract combos from khuyenMaiCombos field
            const allCombos: any[] = [];
            promos.forEach((p: any) => {
              // Only process active promotions
              const promoActive = (p.trangThai || p.TrangThai || '').toLowerCase() === 'active';
              if (!promoActive) return;

              const combos = p.khuyenMaiCombos || p.KhuyenMaiCombos || [];
              combos.forEach((combo: any) => {
                  // Check if combo itself is active
                  const comboActive = !combo.trangThai || (combo.trangThai || combo.TrangThai || '').toLowerCase() === 'active';
                  if (!comboActive) return;

                  const mappings = (combo.khuyenMaiComboDichVus || combo.KhuyenMaiComboDichVus || []);
                  const serviceIds = mappings.map((s: any) => s.iddichVu || s.IddichVu).filter(Boolean);

                  if (serviceIds.length > 0) {
                    allCombos.push({
                      comboId: combo.idkhuyenMaiCombo || combo.IdkhuyenMaiCombo || String(Math.random()),
                      promotionId: p.idkhuyenMai || p.IdkhuyenMai,
                      name: combo.tenCombo || combo.TenCombo || 'Combo',
                      description: combo.moTa || combo.MoTa || p.moTa || p.MoTa || null,
                      banner: p.hinhAnhBanner || p.HinhAnhBanner || null,
                      // store mapping objects and service ids; we'll enrich with full service details below
                      mappingItems: mappings,
                      serviceIds: serviceIds,
                      comboMeta: {
                        ngayBatDau: combo.ngayBatDau || combo.NgayBatDau || p.ngayBatDau || p.NgayBatDau || null,
                        ngayKetThuc: combo.ngayKetThuc || combo.NgayKetThuc || p.ngayKetThuc || p.NgayKetThuc || null,
                        createdAt: combo.createdAt || combo.CreatedAt || null,
                        updatedAt: combo.updatedAt || combo.UpdatedAt || null,
                      },
                      comboPrice: p.giaTriGiam ?? p.GiaTriGiam ?? 0,
                      loaiGiamGia: p.loaiGiamGia || p.LoaiGiamGia || 'amount',
                      isActive: true
                    });
                  }
                });
            });

            // Enrich combos with full service details from service API and mapping metadata
            try {
              const enriched = await Promise.all(allCombos.map(async (c) => {
                try {
                  const servicesFull = await Promise.all((c.serviceIds || []).map(async (id: string) => {
                    try {
                      const svc = await getServiceById(id);
                      return svc;
                    } catch (e) {
                      return null;
                    }
                  }));

                  // merge mappingItems metadata (e.g., IsActive, CreatedAt) into service objects when available
                  const mergedServices = (servicesFull || []).map((svc: any, idx: number) => {
                    const mapping = (c.mappingItems || [])[idx] || {};
                    if (!svc) {
                      return {
                        id: c.serviceIds[idx],
                        TenDichVu: mapping.tenDichVu || mapping.TenDichVu || 'Dịch vụ',
                        TienDichVu: mapping.tienDichVu ?? mapping.TienDichVu ?? 0,
                        IsActive: mapping.isActive ?? mapping.IsActive ?? true,
                      };
                    }
                    return {
                      id: svc.iddichVu ?? svc.id ?? c.serviceIds[idx],
                      HinhDichVu: svc.hinhDichVu ?? svc.HinhDichVu ?? undefined,
                      TenDichVu: (svc.tenDichVu ?? svc.TenDichVu) || mapping.tenDichVu || mapping.TenDichVu || 'Dịch vụ',
                      TienDichVu: svc.tienDichVu ?? svc.TienDichVu ?? mapping.tienDichVu ?? mapping.TienDichVu ?? 0,
                      TrangThai: svc.trangThai ?? svc.TrangThai ?? undefined,
                      ThoiLuongUocTinh: svc.thoiLuongUocTinh ?? svc.ThoiLuongUocTinh ?? undefined,
                      ThongTinDV: svc.thongTinDv ?? svc.ThongTinDV ?? undefined,
                      GhiChu: svc.ghiChu ?? svc.GhiChu ?? undefined,
                      IsActive: mapping.isActive ?? mapping.IsActive ?? true,
                    };
                  });

                  const originalPrice = mergedServices.reduce((sum: number, s: any) => sum + (s.TienDichVu ?? s.tienDichVu ?? 0), 0);

                  return { ...c, services: mergedServices, originalPrice };
                } catch (e) {
                  return { ...c, services: [], originalPrice: 0 };
                }
              }));
              setCombos(enriched);
            } catch (e) {
              // fallback to raw combos if enrichment fails
              setCombos(allCombos);
            }
          }
        } catch (err) {
          console.warn('Failed to load combos:', err);
          // ignore - combos optional
        }
        // enrich each service with applicable promotion (pick best saving)
        try {
          const enriched = await Promise.all(mapped.map(async (s) => {
            try {
              const promos = await getPromotionsForService(s.id);
              if (promos && promos.length > 0) {
                const original = s.TienDichVu ?? 0;
                const scored = promos.map((p: any) => {
                  const val = Number(p.giaTriGiam ?? 0);
                  if ((p.loaiGiamGia || '').toLowerCase() === 'percent') {
                    return { p, saving: original * (val / 100) };
                  }
                  return { p, saving: val };
                });
                scored.sort((a: any, b: any) => (b.saving || 0) - (a.saving || 0));
                const best = scored[0]?.p ?? null;
                if (best) {
                  let discounted = original;
                  const val = Number(best.giaTriGiam ?? 0);
                  const t = (best.loaiGiamGia || '').toLowerCase();
                  if (t === 'percent') discounted = Math.round(original * (1 - val / 100));
                  else discounted = Math.round(Math.max(0, original - val));

                  return {
                    ...s,
                    promotionId: best.promotionId,
                    promotionName: best.promotionName,
                    loaiGiamGia: best.loaiGiamGia,
                    giaTriGiam: best.giaTriGiam ?? null,
                    discountedPrice: discounted,
                    promotionMoTa: best.moTa ?? null,
                    promotionBanner: best.hinhAnhBanner ?? null,
                    promotionNgayBatDau: best.ngayBatDau ?? null,
                    promotionNgayKetThuc: best.ngayKetThuc ?? null,
                  } as Service;
                }
              }
            } catch (err) {
              console.warn('Failed to fetch promos for service', s.id, err);
            }
            return s;
          }));
          setServices(enriched);
        } catch (err) {
          // fallback
          setServices(mapped);
        }
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
    // Load promotions that apply to this service and pick the best (highest discount)
    try {
      setSelectedPromotion(null);
      const promos = await getPromotionsForService(s.id);
      if (promos && promos.length > 0) {
        // choose promotion with largest numeric reduction equivalent
        const original = s.TienDichVu ?? 0;
        const scored = promos.map((p: any) => {
          const val = p.giaTriGiam ?? 0;
          // For percent promotions compute equivalent VND saved
          if ((p.loaiGiamGia || "").toLowerCase() === "percent") {
            return { p, saving: original * (Number(val) / 100) };
          }
          // fixed/amount
          return { p, saving: Number(val) };
        });
        scored.sort((a: any, b: any) => (b.saving || 0) - (a.saving || 0));
        const best = scored[0]?.p ?? null;
        if (best) {
          // calculate discounted price
          let discounted = original;
          const val = Number(best.giaTriGiam ?? 0);
          const t = (best.loaiGiamGia || "").toLowerCase();
          if (t === "percent") discounted = Math.round(original * (1 - val / 100));
          else discounted = Math.round(Math.max(0, original - val));

          setSelectedPromotion({
            id: best.promotionId,
            name: best.promotionName,
            loaiGiamGia: best.loaiGiamGia,
            giaTriGiam: best.giaTriGiam,
            moTa: best.moTa,
            ngayBatDau: best.ngayBatDau,
            ngayKetThuc: best.ngayKetThuc,
            hinhAnhBanner: best.hinhAnhBanner,
            discountedPrice: discounted
          });
        }
      }
    } catch (err) {
      console.warn('Failed to load promotions for service', err);
      setSelectedPromotion(null);
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
    <section className="services-section spad" style={{ background: '#fff' }}>
      <style>{`
        .services-container { padding-left: 150px !important; padding-right: 150px !important; }
        .services-section { padding: 80px 0 !important; }
        @media (max-width: 768px) {
          .services-container { padding-left: 20px !important; padding-right: 20px !important; }
          .services-section { padding: 60px 0 !important; }
        }
      `}</style>
      <div className="container-fluid services-container">
        <div className="row">
          <div className="col-lg-12">
            <div className="section-title">
              <span>Dịch vụ</span>
              <h2>Các dịch vụ của chúng tôi</h2>
            </div>
          </div>
        </div>

        {/* Combos */}
        {combos && combos.length > 0 && (
          <div style={{ margin: '12px 0 20px 0' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              {combos.map(c => (
                <ComboCard key={c.comboId} combo={c} onView={(combo) => {
                  setSelectedCombo(combo);
                  setComboModalOpen(true);
                }} />
              ))}
            </div>
          </div>
        )}

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
                            borderRadius: 18,
                            padding: 12,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            opacity: unavailable ? 0.75 : 1,
                            position: 'relative',
                            background: '#fff',
                            color: '#222',
                            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                            overflow: 'hidden'
                          }}
                        >
                      {unavailable && (
                        <span style={{ position: 'absolute', left: 12, top: 12, background: '#d9534f', color: '#fff', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                          Không khả dụng
                        </span>
                      )}

                      <div style={{ textAlign: 'center', paddingTop: 6 }}>
                        <img src={s.HinhDichVu || placeholderImg} alt={s.TenDichVu} style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 14, marginBottom: 12, boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }} />
                      </div>

                      <h5 style={{ margin: '4px 0 6px 0', color: '#222' }}>{s.TenDichVu}</h5>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ color: '#333', flex: 1 }}>
                          <strong>Giá: </strong>
                          {s.discountedPrice != null && s.discountedPrice < (s.TienDichVu ?? 0) ? (
                            <span style={{ marginLeft: 8 }}>
                              <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 8 }}>{currencyFormatter.format(s.TienDichVu)}</span>
                              <span style={{ color: '#d89860', fontWeight: 700 }}>{currencyFormatter.format(s.discountedPrice)}</span>
                            </span>
                          ) : (
                            <span style={{ marginLeft: 8 }}>{currencyFormatter.format(s.TienDichVu)}</span>
                          )}
                        </div>
                        {s.giaTriGiam != null && s.discountedPrice != null && s.discountedPrice < (s.TienDichVu ?? 0) && (
                          <div style={{ background: '#fdeedb', color: '#d9534f', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                            {(String((s.loaiGiamGia || '').toLowerCase()) === 'percent') ? `Giảm ${Number(s.giaTriGiam)}%` : `Giảm ${currencyFormatter.format(Number(s.giaTriGiam || 0))}`}
                          </div>
                        )}
                      </div>

                      <div style={{ color: '#666', marginBottom: 8 }}>
                        <strong>Thời gian: </strong>
                        {s.ThoiGianBatDau && s.ThoiGianKetThuc ? `${s.ThoiGianBatDau} - ${s.ThoiGianKetThuc}` : '-'}
                      </div>

                      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
                        <button className="btn" onClick={() => openDetails(s)} disabled={unavailable} style={{ flex: 1, background: 'linear-gradient(135deg, #dfa974 0%, #d89860 100%)', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 14px' }}>
                          Xem chi tiết
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <h3 style={{ marginTop: 0, marginBottom: 0 }}>{selected.TenDichVu}</h3>
                        {selectedPromotion && (
                          <div style={{ background: '#f5f7fa', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ color: '#d9534f' }}>{(selectedPromotion.loaiGiamGia || '').toLowerCase() === 'percent' ? `Giảm ${Number(selectedPromotion.giaTriGiam)}%` : `Giảm ${currencyFormatter.format(Number(selectedPromotion.giaTriGiam || 0))}`}</strong>
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <strong>Giá: </strong>
                        {selectedPromotion ? (
                          <span style={{ marginLeft: 8 }}>
                            <span style={{ textDecoration: 'line-through', color: '#999', marginRight: 8 }}>{currencyFormatter.format(selected.TienDichVu)}</span>
                            <span style={{ color: '#d89860', fontWeight: 700 }}>{currencyFormatter.format(selectedPromotion.discountedPrice)}</span>
                          </span>
                        ) : (
                          <span style={{ marginLeft: 8 }}>{currencyFormatter.format(selected.TienDichVu)}</span>
                        )}
                      </div>
                    <div style={{ marginBottom: 8 }}><strong>Trạng thái: </strong>{isAvailable(selected.TrangThai) ? (<span style={{ color: 'green' }}>Khả dụng</span>) : (<span style={{ color: '#d9534f' }}>Không khả dụng</span>)}</div>
                    <div style={{ marginBottom: 8 }}><strong>Thời lượng ước tính: </strong>{formatDuration(selected.ThoiLuongUocTinh)}</div>
                    <div style={{ marginBottom: 8 }}><strong>Khung giờ áp dụng: </strong>{selected.ThoiGianBatDau || '-'} — {selected.ThoiGianKetThuc || '-'}</div>
                    {selectedPromotion && (
                      <div style={{ marginTop: 8, marginBottom: 8, background: '#fafafa', padding: 10, borderRadius: 6 }}>
                        {selectedPromotion.hinhAnhBanner && (
                          <div style={{ marginBottom: 8 }}>
                            <img src={selectedPromotion.hinhAnhBanner} alt={selectedPromotion.name} style={{ maxWidth: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }} />
                          </div>
                        )}
                        <div style={{ marginBottom: 6 }}><strong>Khuyến mãi:</strong> {selectedPromotion.name}</div>
                        {selectedPromotion.moTa && <div style={{ marginBottom: 6, color: '#444' }}>{selectedPromotion.moTa}</div>}
                        <div style={{ color: '#666' }}><strong>Thời gian áp dụng: </strong>{selectedPromotion.ngayBatDau ? new Date(selectedPromotion.ngayBatDau).toLocaleDateString('vi-VN') : '-'} — {selectedPromotion.ngayKetThuc ? new Date(selectedPromotion.ngayKetThuc).toLocaleDateString('vi-VN') : '-'}</div>
                      </div>
                    )}
                  </div>
                </div>

                <hr />

                <div style={{ marginBottom: 8 }}><strong>Mô tả:</strong><p>{selected.ThongTinDV || 'Không có mô tả'}</p></div>

                <div style={{ marginBottom: 8 }}><strong>Ghi chú:</strong><p>{selected.GhiChu || '-'}</p></div>

                <div style={{ marginLeft: 350, marginTop: 12, display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline-secondary" onClick={() => setModalOpen(false)}>Đóng</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combo detail modal */}
      <DetailComboCard visible={comboModalOpen} combo={selectedCombo} onClose={() => { setComboModalOpen(false); setSelectedCombo(null); }} />
    </section>
  );
};

export default Services;
