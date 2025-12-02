using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Hotel_System.API.DTOs;
using Hotel_System.API.Models;

namespace Hotel_System.API.Services
{
    public class NhanVienService : INhanVienService
    {
        private readonly HotelSystemContext _db;
        private readonly ILogger<NhanVienService> _logger;

        public NhanVienService(HotelSystemContext db, ILogger<NhanVienService> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task<List<NhanVienDTO>> LayDanhSachNhanVien()
        {
            var nhanViens = await _db.TaiKhoanNguoiDungs
                .Include(tk => tk.IdkhachHangNavigation)
                .Where(tk => tk.VaiTro == 1 || tk.VaiTro == 2) // Nhân viên hoặc Admin
                .Select(tk => new NhanVienDTO
                {
                    IdNguoiDung = tk.IdnguoiDung,
                    IdKhachHang = tk.IdkhachHang,
                    HoTen = tk.IdkhachHangNavigation.HoTen,
                    Email = tk.IdkhachHangNavigation.Email,
                    SoDienThoai = tk.IdkhachHangNavigation.SoDienThoai,
                    NgaySinh = tk.IdkhachHangNavigation.NgaySinh,
                    NgayDangKy = tk.IdkhachHangNavigation.NgayDangKy,
                    VaiTro = tk.VaiTro
                })
                .OrderByDescending(nv => nv.VaiTro) // Admin trước, nhân viên sau
                .ThenBy(nv => nv.HoTen)
                .ToListAsync();

            return nhanViens;
        }

        public async Task<NhanVienDTO?> LayNhanVienTheoId(int idNguoiDung)
        {
            var nhanVien = await _db.TaiKhoanNguoiDungs
                .Include(tk => tk.IdkhachHangNavigation)
                .Where(tk => tk.IdnguoiDung == idNguoiDung && (tk.VaiTro == 1 || tk.VaiTro == 2))
                .Select(tk => new NhanVienDTO
                {
                    IdNguoiDung = tk.IdnguoiDung,
                    IdKhachHang = tk.IdkhachHang,
                    HoTen = tk.IdkhachHangNavigation.HoTen,
                    Email = tk.IdkhachHangNavigation.Email,
                    SoDienThoai = tk.IdkhachHangNavigation.SoDienThoai,
                    NgaySinh = tk.IdkhachHangNavigation.NgaySinh,
                    NgayDangKy = tk.IdkhachHangNavigation.NgayDangKy,
                    VaiTro = tk.VaiTro
                })
                .FirstOrDefaultAsync();

            return nhanVien;
        }

        public async Task<(bool success, string? error, NhanVienDTO? nhanVien)> TaoNhanVien(TaoNhanVienRequest request)
        {
            try
            {
                // Kiểm tra email đã tồn tại chưa
                var existingEmail = await _db.KhachHangs.FirstOrDefaultAsync(k => k.Email == request.Email);
                if (existingEmail != null)
                {
                    return (false, "Email đã được sử dụng", null);
                }

                // Tạo KhachHang (để lưu thông tin cá nhân)
                var khachHang = new KhachHang
                {
                    HoTen = request.HoTen,
                    Email = request.Email,
                    SoDienThoai = request.SoDienThoai,
                    NgaySinh = request.NgaySinh,
                    NgayDangKy = DateOnly.FromDateTime(DateTime.Now),
                    TichDiem = 0
                };

                _db.KhachHangs.Add(khachHang);
                await _db.SaveChangesAsync();

                // Tạo TaiKhoanNguoiDung
                var taiKhoan = new TaiKhoanNguoiDung
                {
                    IdkhachHang = khachHang.IdkhachHang,
                    MatKhau = HashPassword(request.MatKhau),
                    VaiTro = request.VaiTro // 1: nhân viên, 2: admin
                };

                _db.TaiKhoanNguoiDungs.Add(taiKhoan);
                await _db.SaveChangesAsync();

                var nhanVienDTO = new NhanVienDTO
                {
                    IdNguoiDung = taiKhoan.IdnguoiDung,
                    IdKhachHang = khachHang.IdkhachHang,
                    HoTen = khachHang.HoTen,
                    Email = khachHang.Email,
                    SoDienThoai = khachHang.SoDienThoai,
                    NgaySinh = khachHang.NgaySinh,
                    NgayDangKy = khachHang.NgayDangKy,
                    VaiTro = taiKhoan.VaiTro
                };

                _logger.LogInformation("Đã tạo nhân viên mới: {HoTen} ({Email}), VaiTro: {VaiTro}", 
                    khachHang.HoTen, khachHang.Email, taiKhoan.VaiTro);

                return (true, null, nhanVienDTO);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi tạo nhân viên");
                return (false, "Có lỗi xảy ra khi tạo nhân viên", null);
            }
        }

        public async Task<(bool success, string? error)> CapNhatNhanVien(int idNguoiDung, CapNhatNhanVienRequest request)
        {
            try
            {
                var taiKhoan = await _db.TaiKhoanNguoiDungs
                    .Include(tk => tk.IdkhachHangNavigation)
                    .FirstOrDefaultAsync(tk => tk.IdnguoiDung == idNguoiDung);

                if (taiKhoan == null)
                {
                    return (false, "Không tìm thấy nhân viên");
                }

                // Chỉ cho phép cập nhật nhân viên hoặc admin (không cho cập nhật khách hàng thường qua API này)
                if (taiKhoan.VaiTro == 0)
                {
                    return (false, "Không thể cập nhật thông tin khách hàng qua API này");
                }

                var khachHang = taiKhoan.IdkhachHangNavigation;

                // Kiểm tra email mới nếu có thay đổi
                if (!string.IsNullOrEmpty(request.Email) && request.Email != khachHang.Email)
                {
                    var existingEmail = await _db.KhachHangs.FirstOrDefaultAsync(k => k.Email == request.Email && k.IdkhachHang != khachHang.IdkhachHang);
                    if (existingEmail != null)
                    {
                        return (false, "Email đã được sử dụng bởi tài khoản khác");
                    }
                    khachHang.Email = request.Email;
                }

                // Cập nhật thông tin
                if (!string.IsNullOrEmpty(request.HoTen))
                    khachHang.HoTen = request.HoTen;

                if (request.SoDienThoai != null)
                    khachHang.SoDienThoai = request.SoDienThoai;

                if (request.NgaySinh.HasValue)
                    khachHang.NgaySinh = request.NgaySinh;

                if (request.VaiTro.HasValue && (request.VaiTro == 1 || request.VaiTro == 2))
                    taiKhoan.VaiTro = request.VaiTro.Value;

                await _db.SaveChangesAsync();

                _logger.LogInformation("Đã cập nhật thông tin nhân viên ID: {IdNguoiDung}", idNguoiDung);

                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi cập nhật nhân viên ID: {IdNguoiDung}", idNguoiDung);
                return (false, "Có lỗi xảy ra khi cập nhật thông tin nhân viên");
            }
        }

        public async Task<(bool success, string? error)> DoiMatKhauNhanVien(int idNguoiDung, string matKhauMoi)
        {
            try
            {
                var taiKhoan = await _db.TaiKhoanNguoiDungs.FirstOrDefaultAsync(tk => tk.IdnguoiDung == idNguoiDung);

                if (taiKhoan == null)
                {
                    return (false, "Không tìm thấy nhân viên");
                }

                if (taiKhoan.VaiTro == 0)
                {
                    return (false, "Không thể đổi mật khẩu khách hàng qua API này");
                }

                if (string.IsNullOrEmpty(matKhauMoi) || matKhauMoi.Length < 6)
                {
                    return (false, "Mật khẩu mới phải có ít nhất 6 ký tự");
                }

                taiKhoan.MatKhau = HashPassword(matKhauMoi);
                await _db.SaveChangesAsync();

                _logger.LogInformation("Đã đổi mật khẩu nhân viên ID: {IdNguoiDung}", idNguoiDung);

                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi đổi mật khẩu nhân viên ID: {IdNguoiDung}", idNguoiDung);
                return (false, "Có lỗi xảy ra khi đổi mật khẩu");
            }
        }

        public async Task<(bool success, string? error)> XoaNhanVien(int idNguoiDung)
        {
            try
            {
                var taiKhoan = await _db.TaiKhoanNguoiDungs
                    .Include(tk => tk.IdkhachHangNavigation)
                    .FirstOrDefaultAsync(tk => tk.IdnguoiDung == idNguoiDung);

                if (taiKhoan == null)
                {
                    return (false, "Không tìm thấy nhân viên");
                }

                if (taiKhoan.VaiTro == 0)
                {
                    return (false, "Không thể xóa khách hàng qua API này");
                }

                var khachHang = taiKhoan.IdkhachHangNavigation;

                // Xóa tài khoản trước
                _db.TaiKhoanNguoiDungs.Remove(taiKhoan);
                
                // Xóa thông tin khách hàng liên quan
                _db.KhachHangs.Remove(khachHang);

                await _db.SaveChangesAsync();

                _logger.LogInformation("Đã xóa nhân viên ID: {IdNguoiDung}, KhachHang ID: {IdKhachHang}", 
                    idNguoiDung, khachHang.IdkhachHang);

                return (true, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xóa nhân viên ID: {IdNguoiDung}", idNguoiDung);
                return (false, "Có lỗi xảy ra khi xóa nhân viên. Có thể nhân viên này đang có dữ liệu liên quan.");
            }
        }

        // Hash password using PBKDF2 (same as AuthService)
        private string HashPassword(string password)
        {
            var saltSize = 16;
            var iterations = 10000;
            using var rng = RandomNumberGenerator.Create();
            var salt = new byte[saltSize];
            rng.GetBytes(salt);

            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, iterations, HashAlgorithmName.SHA256);
            var hash = pbkdf2.GetBytes(32);

            var hashBytes = new byte[1 + 4 + saltSize + hash.Length];
            hashBytes[0] = 0x01;
            BitConverter.GetBytes(iterations).CopyTo(hashBytes, 1);
            Array.Copy(salt, 0, hashBytes, 5, saltSize);
            Array.Copy(hash, 0, hashBytes, 5 + saltSize, hash.Length);
            return Convert.ToBase64String(hashBytes);
        }
    }
}
