using Hotel_System.API.DTOs;
using Hotel_System.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Hotel_System.API.Services;

/// <summary>
/// Service xử lý logic khuyến mãi và tích điểm
/// </summary>
public class PromotionService
{
    private readonly HotelSystemContext _context;
    private readonly ILogger<PromotionService> _logger;

    // Quy đổi điểm: 10,000 VNĐ = 1 điểm
    private const decimal MONEY_PER_POINT = 10000m;

    // Tỷ lệ đổi điểm lấy voucher
    private static readonly Dictionary<string, (int Points, decimal Value, string Type)> VoucherExchangeRates = new()
    {
        { "10k", (100, 10000, "fixed") },    // 100 điểm = voucher 10,000 VNĐ
        { "20k", (180, 20000, "fixed") },    // 180 điểm = voucher 20,000 VNĐ (tiết kiệm 20 điểm)
        { "50k", (400, 50000, "fixed") },    // 400 điểm = voucher 50,000 VNĐ (tiết kiệm 100 điểm)
        { "100k", (750, 100000, "fixed") },  // 750 điểm = voucher 100,000 VNĐ (tiết kiệm 250 điểm)
        { "5percent", (200, 5, "percent") }, // 200 điểm = voucher giảm 5%
        { "10percent", (350, 10, "percent") } // 350 điểm = voucher giảm 10%
    };

    public PromotionService(HotelSystemContext context, ILogger<PromotionService> logger)
    {
        _context = context;
        _logger = logger;
    }

    #region 1. Hiển thị danh sách khuyến mãi

    /// <summary>
    /// Lấy danh sách tất cả khuyến mãi hiện có
    /// </summary>
    public async Task<List<PromotionResponse>> GetAllPromotionsAsync(List<string>? roomIds = null)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);

        var promotions = await _context.KhuyenMais
            .Include(km => km.KhuyenMaiPhongs)
            .ThenInclude(kmp => kmp.IdphongNavigation)
            .ToListAsync();

        var result = promotions.Select(km =>
        {
            var status = GetPromotionStatus(km.NgayBatDau, km.NgayKetThuc);
            var roomsApplied = km.KhuyenMaiPhongs
                .Where(kmp => kmp.IsActive)
                .Select(kmp => kmp.Idphong)
                .ToList();

            // Kiểm tra xem có áp dụng được cho các phòng đang đặt không
            var isApplicable = false;
            if (roomIds != null && roomIds.Any())
            {
                isApplicable = status == "active" && roomsApplied.Any(r => roomIds.Contains(r));
            }
            else
            {
                isApplicable = status == "active";
            }

            return new PromotionResponse
            {
                IdKhuyenMai = km.IdkhuyenMai,
                TenKhuyenMai = km.TenKhuyenMai,
                MoTa = km.MoTa,
                LoaiGiamGia = km.LoaiGiamGia,
                GiaTriGiam = km.GiaTriGiam ?? 0,
                NgayBatDau = km.NgayBatDau,
                NgayKetThuc = km.NgayKetThuc,
                TrangThai = status,
                DanhSachPhongApDung = roomsApplied,
                IsApplicable = isApplicable
            };
        }).ToList();

        return result;
    }

    /// <summary>
    /// Lấy khuyến mãi theo ID phòng
    /// </summary>
    public async Task<List<PromotionResponse>> GetPromotionsByRoomAsync(string roomId)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);

        var promotions = await _context.KhuyenMaiPhongs
            .Include(kmp => kmp.IdkhuyenMaiNavigation)
            .Where(kmp => kmp.Idphong == roomId && kmp.IsActive)
            .Where(kmp => kmp.IdkhuyenMaiNavigation.NgayBatDau <= today
                       && kmp.IdkhuyenMaiNavigation.NgayKetThuc >= today)
            .Select(kmp => kmp.IdkhuyenMaiNavigation)
            .ToListAsync();

        var result = promotions.Select(km => new PromotionResponse
        {
            IdKhuyenMai = km.IdkhuyenMai,
            TenKhuyenMai = km.TenKhuyenMai,
            MoTa = km.MoTa,
            LoaiGiamGia = km.LoaiGiamGia,
            GiaTriGiam = km.GiaTriGiam ?? 0,
            NgayBatDau = km.NgayBatDau,
            NgayKetThuc = km.NgayKetThuc,
            TrangThai = "active",
            DanhSachPhongApDung = new List<string> { roomId },
            IsApplicable = true
        }).ToList();

        return result;
    }

    #endregion

    #region 2. Áp dụng mã giảm giá

    /// <summary>
    /// Áp dụng mã khuyến mãi cho hóa đơn
    /// </summary>
    public async Task<ApplyPromotionResponse> ApplyPromotionAsync(ApplyPromotionRequest request)
    {
        try
        {
            // 1. Kiểm tra hóa đơn tồn tại
            var hoaDon = await _context.HoaDons.FindAsync(request.IdHoaDon);
            if (hoaDon == null)
            {
                return new ApplyPromotionResponse
                {
                    Success = false,
                    Message = "Không tìm thấy hóa đơn"
                };
            }

            // 2. Kiểm tra mã khuyến mãi
            var promotion = await _context.KhuyenMais
                .Include(km => km.KhuyenMaiPhongs)
                .FirstOrDefaultAsync(km => km.IdkhuyenMai == request.MaKhuyenMai);

            if (promotion == null)
            {
                return new ApplyPromotionResponse
                {
                    Success = false,
                    Message = "Mã khuyến mãi không tồn tại"
                };
            }

            // 3. Kiểm tra thời hạn
            var today = DateOnly.FromDateTime(DateTime.Now);
            if (today < promotion.NgayBatDau || today > promotion.NgayKetThuc)
            {
                return new ApplyPromotionResponse
                {
                    Success = false,
                    Message = "Mã khuyến mãi đã hết hạn hoặc chưa đến ngày áp dụng"
                };
            }

            // 4. Kiểm tra phòng có áp dụng không
            var roomsWithPromotion = promotion.KhuyenMaiPhongs
                .Where(kmp => kmp.IsActive)
                .Select(kmp => kmp.Idphong)
                .ToList();

            var hasApplicableRoom = request.DanhSachPhong.Any(r => roomsWithPromotion.Contains(r));
            if (!hasApplicableRoom && roomsWithPromotion.Any()) // Nếu có giới hạn phòng
            {
                return new ApplyPromotionResponse
                {
                    Success = false,
                    Message = $"Mã khuyến mãi chỉ áp dụng cho phòng: {string.Join(", ", roomsWithPromotion)}"
                };
            }

            // 5. Tính toán giảm giá
            decimal tongTienGoc = hoaDon.TongTien;
            decimal soTienGiam = 0;

            if (promotion.LoaiGiamGia == "percent")
            {
                soTienGiam = tongTienGoc * (promotion.GiaTriGiam ?? 0) / 100;
            }
            else if (promotion.LoaiGiamGia == "fixed")
            {
                soTienGiam = promotion.GiaTriGiam ?? 0;
            }

            // Không cho giảm quá tổng tiền
            if (soTienGiam > tongTienGoc)
            {
                soTienGiam = tongTienGoc;
            }

            decimal tongTienSauGiam = tongTienGoc - soTienGiam;

            // 6. Cập nhật hóa đơn
            hoaDon.TongTien = tongTienSauGiam;
            hoaDon.GhiChu = $"Áp dụng mã {request.MaKhuyenMai} - Giảm {soTienGiam:N0} VNĐ";
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Đã áp dụng mã {request.MaKhuyenMai} cho hóa đơn {request.IdHoaDon}. Giảm {soTienGiam:N0} VNĐ");

            return new ApplyPromotionResponse
            {
                Success = true,
                Message = $"Áp dụng mã thành công! Giảm {soTienGiam:N0} VNĐ",
                TongTienGoc = tongTienGoc,
                SoTienGiam = soTienGiam,
                TongTienSauGiam = tongTienSauGiam,
                MaKhuyenMaiApDung = request.MaKhuyenMai
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi áp dụng mã khuyến mãi");
            return new ApplyPromotionResponse
            {
                Success = false,
                Message = $"Có lỗi xảy ra: {ex.Message}"
            };
        }
    }

    #endregion

    #region 3. Tích điểm khi hoàn tất booking

    /// <summary>
    /// Tích điểm cho khách hàng khi hoàn tất thanh toán
    /// </summary>
    public async Task<bool> AddLoyaltyPointsAsync(int idKhachHang, decimal tongTien)
    {
        try
        {
            var khachHang = await _context.KhachHangs.FindAsync(idKhachHang);
            if (khachHang == null)
            {
                _logger.LogWarning($"Không tìm thấy khách hàng ID {idKhachHang}");
                return false;
            }

            // Tính điểm: 10,000 VNĐ = 1 điểm
            int diemTichThem = (int)(tongTien / MONEY_PER_POINT);

            // Cập nhật điểm
            khachHang.TichDiem = (khachHang.TichDiem ?? 0) + diemTichThem;
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Đã tích {diemTichThem} điểm cho khách hàng {khachHang.HoTen} (ID: {idKhachHang}). Tổng điểm: {khachHang.TichDiem}");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Lỗi khi tích điểm cho khách hàng {idKhachHang}");
            return false;
        }
    }

    /// <summary>
    /// Lấy thông tin điểm tích lũy của khách hàng
    /// </summary>
    public async Task<LoyaltyPointsResponse?> GetLoyaltyPointsAsync(int idKhachHang)
    {
        var khachHang = await _context.KhachHangs.FindAsync(idKhachHang);
        if (khachHang == null)
        {
            return null;
        }

        var diemHienTai = khachHang.TichDiem ?? 0;
        var voucherOptions = VoucherExchangeRates
            .Where(v => v.Value.Points <= diemHienTai)
            .Select(v => new VoucherExchangeOption
            {
                TenVoucher = v.Key.ToUpper(),
                MoTa = v.Value.Type == "fixed"
                    ? $"Voucher giảm {v.Value.Value:N0} VNĐ"
                    : $"Voucher giảm {v.Value.Value}%",
                DiemCanThiet = v.Value.Points,
                GiaTriVoucher = v.Value.Value,
                LoaiGiamGia = v.Value.Type
            }).ToList();

        return new LoyaltyPointsResponse
        {
            IdKhachHang = idKhachHang,
            HoTen = khachHang.HoTen,
            DiemHienTai = diemHienTai,
            DiemCoTheDoi = diemHienTai,
            VoucherKhaDung = voucherOptions
        };
    }

    #endregion

    #region 4. Đổi điểm lấy voucher

    /// <summary>
    /// Đổi điểm lấy voucher
    /// </summary>
    public async Task<ExchangePointsResponse> ExchangePointsForVoucherAsync(ExchangePointsRequest request)
    {
        try
        {
            // 1. Kiểm tra khách hàng
            var khachHang = await _context.KhachHangs.FindAsync(request.IdKhachHang);
            if (khachHang == null)
            {
                return new ExchangePointsResponse
                {
                    Success = false,
                    Message = "Không tìm thấy khách hàng"
                };
            }

            // 2. Kiểm tra loại voucher
            if (!VoucherExchangeRates.TryGetValue(request.LoaiVoucher.ToLower(), out var voucherInfo))
            {
                return new ExchangePointsResponse
                {
                    Success = false,
                    Message = "Loại voucher không hợp lệ"
                };
            }

            // 3. Kiểm tra điểm
            var diemHienTai = khachHang.TichDiem ?? 0;
            if (diemHienTai < voucherInfo.Points)
            {
                return new ExchangePointsResponse
                {
                    Success = false,
                    Message = $"Không đủ điểm. Cần {voucherInfo.Points} điểm, bạn có {diemHienTai} điểm"
                };
            }

            // 4. Trừ điểm
            khachHang.TichDiem = diemHienTai - voucherInfo.Points;

            // 5. Tạo voucher mới (lưu vào bảng KhuyenMai)
            var maVoucher = $"VC{DateTime.Now:yyyyMMddHHmmss}";
            var voucher = new KhuyenMai
            {
                IdkhuyenMai = maVoucher,
                TenKhuyenMai = $"Voucher {request.LoaiVoucher.ToUpper()} - Đổi từ {voucherInfo.Points} điểm",
                MoTa = $"Voucher do khách hàng {khachHang.HoTen} đổi điểm",
                LoaiGiamGia = voucherInfo.Type,
                GiaTriGiam = voucherInfo.Value,
                NgayBatDau = DateOnly.FromDateTime(DateTime.Now),
                NgayKetThuc = DateOnly.FromDateTime(DateTime.Now.AddMonths(3)), // Hạn 3 tháng
                TrangThai = "active",
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now
            };

            _context.KhuyenMais.Add(voucher);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Khách hàng {khachHang.HoTen} đã đổi {voucherInfo.Points} điểm lấy voucher {maVoucher}");

            return new ExchangePointsResponse
            {
                Success = true,
                Message = $"Đổi điểm thành công! Voucher {maVoucher} có giá trị {voucherInfo.Value:N0} {(voucherInfo.Type == "percent" ? "%" : "VNĐ")}",
                DiemConLai = khachHang.TichDiem ?? 0,
                MaVoucher = maVoucher,
                GiaTriVoucher = voucherInfo.Value,
                NgayHetHan = voucher.NgayKetThuc
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi đổi điểm lấy voucher");
            return new ExchangePointsResponse
            {
                Success = false,
                Message = $"Có lỗi xảy ra: {ex.Message}"
            };
        }
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Xác định trạng thái của khuyến mãi
    /// </summary>
    private string GetPromotionStatus(DateOnly startDate, DateOnly endDate)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);

        if (today < startDate)
            return "upcoming"; // Sắp diễn ra

        if (today > endDate)
            return "expired"; // Đã hết hạn

        return "active"; // Đang hoạt động
    }

    #endregion
}
