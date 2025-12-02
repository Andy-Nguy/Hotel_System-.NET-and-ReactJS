using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Hotel_System.API.Models;

public partial class HotelSystemContext : DbContext
{
    public HotelSystemContext()
    {
    }

    public HotelSystemContext(DbContextOptions<HotelSystemContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Cthddv> Cthddvs { get; set; }

    public virtual DbSet<ChiTietDatPhong> ChiTietDatPhongs { get; set; }

    public virtual DbSet<DanhGium> DanhGia { get; set; }

    public virtual DbSet<DatPhong> DatPhongs { get; set; }

    public virtual DbSet<DichVu> DichVus { get; set; }

    public virtual DbSet<HoaDon> HoaDons { get; set; }

    public virtual DbSet<KhachHang> KhachHangs { get; set; }

    public virtual DbSet<KhuyenMai> KhuyenMais { get; set; }

    public virtual DbSet<KhuyenMaiPhong> KhuyenMaiPhongs { get; set; }
    public virtual DbSet<KhuyenMaiDichVu> KhuyenMaiDichVus { get; set; }
    public virtual DbSet<KhuyenMaiCombo> KhuyenMaiCombos { get; set; }
    public virtual DbSet<KhuyenMaiComboDichVu> KhuyenMaiComboDichVus { get; set; }

    public virtual DbSet<LichSuDatPhong> LichSuDatPhongs { get; set; }

    public virtual DbSet<LoaiPhong> LoaiPhongs { get; set; }

    public virtual DbSet<PendingUser> PendingUsers { get; set; }

    public virtual DbSet<Phong> Phongs { get; set; }

    public virtual DbSet<TaiKhoanNguoiDung> TaiKhoanNguoiDungs { get; set; }

    public virtual DbSet<ThongKeDoanhThuKhachSan> ThongKeDoanhThuKhachSans { get; set; }

    public virtual DbSet<TienNghi> TienNghis { get; set; }

    public virtual DbSet<TienNghiPhong> TienNghiPhongs { get; set; }

    public virtual DbSet<TtdichVu> TtdichVus { get; set; }
    public virtual DbSet<BlogPost> BlogPosts { get; set; }

//     protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
// #warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
//         => optionsBuilder.UseNpgsql("Name=ConnectionStrings:DefaultConnection");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.UseSerialColumns();

        modelBuilder.Entity<Cthddv>(entity =>
        {
            entity.HasKey(e => e.Idcthddv).HasName("PK__CTHDDV__AA3CF58A8BE8DD33");

            entity.ToTable("CTHDDV");

            entity.Property(e => e.Idcthddv).HasColumnName("IDCTHDDV");
            entity.Property(e => e.IddichVu)
                .HasMaxLength(50)
                .HasColumnName("IDDichVu")
                .IsRequired(false); // Nullable
                entity.Property(e => e.IdhoaDon)
                .HasMaxLength(50)
                .HasColumnName("IDHoaDon");
            entity.Property(e => e.TienDichVu)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            // The database schema for CTHDDV does not include an IDKhuyenMai column.
            // Keep the model property for application-side use but prevent EF Core
            // from mapping it (and therefore querying a non-existent column).
            entity.Ignore(e => e.IdkhuyenMai);
            
            entity.Property(e => e.IdkhuyenMaiCombo)
                .HasMaxLength(50)
                .HasColumnName("IDKhuyenMaiCombo");

            entity.HasOne(d => d.IddichVuNavigation).WithMany(p => p.Cthddvs)
                .HasForeignKey(d => d.IddichVu)
                .HasConstraintName("FK_CTHDDV_DichVu");
                
            entity.HasOne(d => d.IdkhuyenMaiComboNavigation).WithMany()
                .HasForeignKey(d => d.IdkhuyenMaiCombo)
                .HasConstraintName("FK_CTHDDV_KhuyenMaiCombo");

            entity.HasOne(d => d.IdhoaDonNavigation).WithMany(p => p.Cthddvs)
                .HasForeignKey(d => d.IdhoaDon)
                .HasConstraintName("FK_CTHDDV_HoaDon");
        });

        modelBuilder.Entity<ChiTietDatPhong>(entity =>
        {
            entity.HasKey(e => e.IDChiTiet).HasName("PK_ChiTietDatPhong");

            entity.ToTable("chitietdatphong");

            entity.HasIndex(e => new { e.IDDatPhong, e.IDPhong }, "UQ_DatPhong_Phong").IsUnique();

            entity.Property(e => e.IDChiTiet).HasColumnName("idchitiet");
            entity.Property(e => e.IDDatPhong)
                .HasMaxLength(50)
                .HasColumnName("IDDatPhong");
            entity.Property(e => e.IDPhong)
                .HasMaxLength(50)
                .HasColumnName("IDPhong");
            entity.Property(e => e.SoDem).HasColumnName("SoDem");
            entity.Property(e => e.GiaPhong)
                .HasColumnType("decimal(18, 2)")
                .HasColumnName("GiaPhong");
            entity.Property(e => e.ThanhTien)
                .HasColumnType("decimal(18, 2)")
                .HasColumnName("ThanhTien");
            entity.Property(e => e.GhiChu).HasColumnName("GhiChu");

            entity.HasOne(d => d.DatPhong).WithMany(p => p.ChiTietDatPhongs)
                .HasForeignKey(d => d.IDDatPhong)
                .HasConstraintName("FK_ChiTietDatPhong_DatPhong");

            entity.HasOne(d => d.Phong).WithMany()
                .HasForeignKey(d => d.IDPhong)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_ChiTietDatPhong_Phong");
        });

        modelBuilder.Entity<DanhGium>(entity =>
        {
            entity.HasKey(e => e.IddanhGia);

            entity.ToTable("danhgia");

            entity.Property(e => e.IddanhGia).HasColumnName("iddanhgia");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IdkhachHang).HasColumnName("idkhachhang");
            entity.Property(e => e.Idphong)
                .HasMaxLength(50)
                .HasColumnName("idphong");
            entity.Property(e => e.IddatPhong)
                .HasMaxLength(50)
                .HasColumnName("iddatphong");
            entity.Property(e => e.IsApproved)
                .HasDefaultValue(false)
                .HasColumnName("isapproved");
            entity.Property(e => e.IsResponded)
                .HasDefaultValue(false)
                .HasColumnName("isresponded");
            entity.Property(e => e.IsAnonym)
                .HasDefaultValue(false)
                .HasColumnName("isanonym");
            entity.Property(e => e.NoiDung)
                .HasColumnType("text")
                .HasColumnName("noidung");
            entity.Property(e => e.SoSao).HasColumnName("sosao");
            entity.Property(e => e.TieuDe)
                .HasMaxLength(200)
                .HasColumnName("tieude");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.IdkhachHangNavigation).WithMany(p => p.DanhGia)
                .HasForeignKey(d => d.IdkhachHang);

            entity.HasOne(d => d.IdphongNavigation).WithMany(p => p.DanhGia)
                .HasForeignKey(d => d.Idphong);
        });

        modelBuilder.Entity<BlogPost>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_BlogPost");
            entity.ToTable("BlogPost");

            entity.Property(e => e.Id).HasColumnName("Id");
            entity.Property(e => e.Title).HasMaxLength(500).HasColumnName("Title");
            entity.Property(e => e.Slug).HasMaxLength(500).HasColumnName("Slug");
            entity.Property(e => e.Excerpt).HasColumnType("text").HasColumnName("Excerpt");
            entity.Property(e => e.Content).HasColumnType("text").HasColumnName("Content");
            entity.Property(e => e.Image).HasMaxLength(1024).HasColumnName("Image");
            entity.Property(e => e.Category).HasMaxLength(200).HasColumnName("Category");
            entity.Property(e => e.AuthorId).HasColumnName("AuthorId");
            entity.Property(e => e.Status).HasMaxLength(50).HasColumnName("Status");
            entity.Property(e => e.Tags).HasMaxLength(1000).HasColumnName("Tags");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()").HasColumnName("CreatedAt");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("now()").HasColumnName("UpdatedAt");
            entity.Property(e => e.PublishedAt).HasColumnName("PublishedAt");
        });

        modelBuilder.Entity<DatPhong>(entity =>
        {
            entity.HasKey(e => e.IddatPhong).HasName("PK__DatPhong__7979F6F8FD1357D0");

            entity.ToTable("DatPhong");

            entity.Property(e => e.IddatPhong)
                .HasMaxLength(50)
                .HasColumnName("IDDatPhong");
            entity.Property(e => e.IdkhachHang).HasColumnName("IDKhachHang");
            entity.Property(e => e.Idphong)
                .HasMaxLength(50)
                .HasColumnName("IDPhong");
            entity.Property(e => e.NgayDatPhong)
                .HasDefaultValueSql("CURRENT_DATE")
                .HasColumnType("date");
            entity.Property(e => e.SoNguoi).HasColumnName("songuoi");
            entity.Property(e => e.SoLuongPhong).HasColumnName("soluongphong");
            entity.Property(e => e.ThoiHan)
                .HasColumnName("thoihan")
                .HasColumnType("timestamptz");
            entity.Property(e => e.TienCoc)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TongTien).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.IdkhachHangNavigation).WithMany(p => p.DatPhongs)
                .HasForeignKey(d => d.IdkhachHang)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_DatPhong_KhachHang");

            entity.HasOne(d => d.IdphongNavigation).WithMany(p => p.DatPhongs)
                .HasForeignKey(d => d.Idphong)
                .HasConstraintName("FK_DatPhong_Phong");
        });

        modelBuilder.Entity<DichVu>(entity =>
        {
            entity.HasKey(e => e.IddichVu).HasName("PK__DichVu__C0C95928D3FBD51F");

            entity.ToTable("DichVu");

            entity.Property(e => e.IddichVu)
                .HasMaxLength(50)
                .HasColumnName("IDDichVu");
            entity.Property(e => e.HinhDichVu).HasMaxLength(255);
            entity.Property(e => e.TenDichVu).HasMaxLength(100);
            entity.Property(e => e.TienDichVu)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.ThoiGianBatDau).HasColumnName("ThoiGianBatDau");
            entity.Property(e => e.ThoiGianKetThuc).HasColumnName("ThoiGianKetThuc");
            entity.Property(e => e.TrangThai)
                .HasMaxLength(50)
                .HasColumnName("TrangThai");
        });

        modelBuilder.Entity<KhuyenMaiDichVu>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_KhuyenMaiDichVu");
            entity.ToTable("KhuyenMaiDichVu");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.IdkhuyenMai)
                .HasMaxLength(50)
                .HasColumnName("IDKhuyenMai");
            entity.Property(e => e.IddichVu)
                .HasMaxLength(50)
                .HasColumnName("IDDichVu");
            entity.Property(e => e.IsActive)
                .HasColumnName("IsActive")
                .HasDefaultValue(true);
            entity.Property(e => e.NgayApDung).HasColumnName("NgayApDung").HasColumnType("date");
            entity.Property(e => e.NgayKetThuc).HasColumnName("NgayKetThuc").HasColumnType("date");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.IdkhuyenMaiNavigation).WithMany(p => p.KhuyenMaiDichVus)
                .HasForeignKey(d => d.IdkhuyenMai)
                .HasConstraintName("FK_KhuyenMaiDichVu_KhuyenMai");
            entity.HasOne(d => d.IddichVuNavigation).WithMany(p => p.KhuyenMaiDichVus)
                .HasForeignKey(d => d.IddichVu)
                .HasConstraintName("FK_KhuyenMaiDichVu_DichVu");
        });

        modelBuilder.Entity<KhuyenMaiCombo>(entity =>
        {
            entity.HasKey(e => e.IdkhuyenMaiCombo).HasName("PK_KhuyenMaiCombo");
            entity.ToTable("KhuyenMaiCombo");

            entity.Property(e => e.IdkhuyenMaiCombo).HasColumnName("IDKhuyenMaiCombo");
            entity.Property(e => e.IdkhuyenMai)
                .HasMaxLength(50)
                .HasColumnName("IDKhuyenMai");
            entity.Property(e => e.TenCombo).HasMaxLength(200).HasColumnName("TenCombo");
            entity.Property(e => e.MoTa).HasColumnType("nvarchar(max)").HasColumnName("MoTa");
            entity.Property(e => e.NgayBatDau).HasColumnName("NgayBatDau");
            entity.Property(e => e.NgayKetThuc).HasColumnName("NgayKetThuc");
            entity.Property(e => e.TrangThai)
                .HasMaxLength(10)
                .HasColumnName("TrangThai")
                .HasDefaultValue("active");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.IdkhuyenMaiNavigation).WithMany(p => p.KhuyenMaiCombos)
                .HasForeignKey(d => d.IdkhuyenMai)
                .HasConstraintName("FK_KhuyenMaiCombo_KhuyenMai");
        });

        modelBuilder.Entity<KhuyenMaiComboDichVu>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK_KhuyenMaiComboDichVu");
            entity.ToTable("KhuyenMaiComboDichVu");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.IdkhuyenMaiCombo)
                .HasMaxLength(50)
                .HasColumnName("IDKhuyenMaiCombo");
            entity.Property(e => e.IddichVu)
                .HasMaxLength(50)
                .HasColumnName("IDDichVu");
            entity.Property(e => e.IsActive).HasColumnName("IsActive").HasDefaultValue(true);
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("(getdate())")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.IdkhuyenMaiComboNavigation).WithMany(p => p.KhuyenMaiComboDichVus)
                .HasForeignKey(d => d.IdkhuyenMaiCombo)
                .HasConstraintName("FK_KhuyenMaiComboDichVu_Combo");

            entity.HasOne(d => d.IddichVuNavigation).WithMany()
                .HasForeignKey(d => d.IddichVu)
                .HasConstraintName("FK_KhuyenMaiComboDichVu_DichVu");
        });

        modelBuilder.Entity<HoaDon>(entity =>
        {
            entity.HasKey(e => e.IdhoaDon).HasName("PK__HoaDon__5B896F4932F43493");

            entity.ToTable("HoaDon");

            entity.Property(e => e.IdhoaDon)
                .HasMaxLength(50)
                .HasColumnName("IDHoaDon");
            entity.Property(e => e.IddatPhong)
                .HasMaxLength(50)
                .HasColumnName("IDDatPhong");
            entity.Property(e => e.NgayLap).HasDefaultValueSql("now()");
            entity.Property(e => e.Slngay).HasColumnName("SLNgay");
            entity.Property(e => e.TienCoc)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TienThanhToan).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TongTien).HasColumnType("decimal(18, 2)");

            entity.HasOne(d => d.IddatPhongNavigation).WithMany(p => p.HoaDons)
                .HasForeignKey(d => d.IddatPhong)
                .HasConstraintName("FK_HoaDon_DatPhong");
        });


        modelBuilder.Entity<KhachHang>(entity =>
        {
            entity.HasKey(e => e.IdkhachHang).HasName("PK__KhachHan__5A7167B57F817519");

            entity.ToTable("KhachHang");

            entity.HasIndex(e => e.Email, "UQ__KhachHan__A9D10534504E46A4").IsUnique();

            entity.Property(e => e.IdkhachHang).HasColumnName("IDKhachHang");
            entity.Property(e => e.Email).HasMaxLength(100);
            entity.Property(e => e.HoTen).HasMaxLength(100);
            entity.Property(e => e.NgayDangKy).HasDefaultValueSql("CURRENT_DATE").HasColumnType("date");
            entity.Property(e => e.SoDienThoai).HasMaxLength(20);
            entity.Property(e => e.TichDiem).HasDefaultValue(0);
        });

        modelBuilder.Entity<KhuyenMai>(entity =>
        {
            entity.HasKey(e => e.IdkhuyenMai).HasName("PK__KhuyenMa__FFAC1400CCC5A38E");

            entity.ToTable("KhuyenMai");

            entity.Property(e => e.IdkhuyenMai)
                .HasMaxLength(50)
                .HasColumnName("IDKhuyenMai");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.GiaTriGiam)
                .HasDefaultValue(0m)
                .HasColumnType("decimal(18, 2)");
            entity.Property(e => e.LoaiGiamGia)
                .HasMaxLength(10)
                .IsUnicode(false);
            entity.Property(e => e.LoaiKhuyenMai)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasDefaultValue("room");
            entity.Property(e => e.TenKhuyenMai).HasMaxLength(200);
            entity.Property(e => e.TrangThai)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasDefaultValue("active");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");
        });

        modelBuilder.Entity<KhuyenMaiPhong>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__KhuyenMa__3214EC275E615389");

            entity.ToTable("KhuyenMaiPhong");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.IdkhuyenMai)
                .HasMaxLength(50)
                .HasColumnName("IDKhuyenMai");
            entity.Property(e => e.Idphong)
                .HasMaxLength(50)
                .HasColumnName("IDPhong");
            entity.Property(e => e.NgayApDung).HasDefaultValueSql("CURRENT_DATE");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.IdkhuyenMaiNavigation).WithMany(p => p.KhuyenMaiPhongs)
                .HasForeignKey(d => d.IdkhuyenMai)
                .HasConstraintName("FK_KhuyenMaiPhong_KhuyenMai");

            entity.HasOne(d => d.IdphongNavigation).WithMany(p => p.KhuyenMaiPhongs)
                .HasForeignKey(d => d.Idphong)
                .HasConstraintName("FK_KhuyenMaiPhong_Phong");
        });

        modelBuilder.Entity<LichSuDatPhong>(entity =>
        {
            entity.HasKey(e => e.IdlichSu).HasName("PK__LichSuDa__911D9E5366AD5C1B");

            entity.ToTable("LichSuDatPhong");

            entity.Property(e => e.IdlichSu).HasColumnName("IDLichSu");
            entity.Property(e => e.IddatPhong)
                .HasMaxLength(50)
                .HasColumnName("IDDatPhong");
            entity.Property(e => e.NgayCapNhat).HasDefaultValueSql("now()");
            entity.Property(e => e.TrangThaiCu).HasMaxLength(50);
            entity.Property(e => e.TrangThaiMoi).HasMaxLength(50);

            entity.HasOne(d => d.IddatPhongNavigation).WithMany(p => p.LichSuDatPhongs)
                .HasForeignKey(d => d.IddatPhong)
                .HasConstraintName("FK_LichSuDatPhong");
        });

        modelBuilder.Entity<LoaiPhong>(entity =>
        {
            entity.HasKey(e => e.IdloaiPhong).HasName("PK__LoaiPhon__485287E2D3FA2143");

            entity.ToTable("LoaiPhong");

            entity.Property(e => e.IdloaiPhong)
                .HasMaxLength(50)
                .HasColumnName("IDLoaiPhong");
            entity.Property(e => e.TenLoaiPhong).HasMaxLength(100);
            entity.Property(e => e.UrlAnhLoaiPhong).HasMaxLength(255);
        });

        modelBuilder.Entity<PendingUser>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__pending___3213E83F61D24267");

            entity.ToTable("pending_users");

            entity.HasIndex(e => e.Email, "UQ__pending___AB6E6164399F635A").IsUnique();

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.Email)
                .HasMaxLength(255)
                .HasColumnName("email");
            entity.Property(e => e.Hoten)
                .HasMaxLength(100)
                .HasColumnName("hoten");
            entity.Property(e => e.Ngaysinh).HasColumnName("ngaysinh").HasColumnType("date");
            entity.Property(e => e.Otp)
                .HasMaxLength(6)
                .IsUnicode(false)
                .IsFixedLength()
                .HasColumnName("otp");
            entity.Property(e => e.OtpExpiredAt).HasColumnName("otp_expired_at");
            entity.Property(e => e.Password)
                .HasMaxLength(255)
                .HasColumnName("password");
            entity.Property(e => e.Sodienthoai)
                .HasMaxLength(15)
                .HasColumnName("sodienthoai");
        });

        modelBuilder.Entity<Phong>(entity =>
        {
            entity.HasKey(e => e.Idphong).HasName("PK__Phong__81CB11522D934F03");

            entity.ToTable("Phong");

            entity.Property(e => e.Idphong)
                .HasMaxLength(50)
                .HasColumnName("IDPhong");
            entity.Property(e => e.GiaCoBanMotDem).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.IdloaiPhong)
                .HasMaxLength(50)
                .HasColumnName("IDLoaiPhong");
            entity.Property(e => e.SoPhong).HasMaxLength(20);
            entity.Property(e => e.TenPhong).HasMaxLength(20);
            entity.Property(e => e.TrangThai).HasMaxLength(50);
            entity.Property(e => e.UrlAnhPhong).HasMaxLength(255);

            entity.HasOne(d => d.IdloaiPhongNavigation).WithMany(p => p.Phongs)
                .HasForeignKey(d => d.IdloaiPhong)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_Phong_LoaiPhong");
        });

        modelBuilder.Entity<TaiKhoanNguoiDung>(entity =>
        {
            entity.HasKey(e => e.IdnguoiDung).HasName("PK__TaiKhoan__FCD7DB096745AC6D");

            entity.ToTable("TaiKhoanNguoiDung");

            entity.Property(e => e.IdnguoiDung).HasColumnName("IDNguoiDung");
            entity.Property(e => e.IdkhachHang).HasColumnName("IDKhachHang");
            entity.Property(e => e.MatKhau).HasMaxLength(255);

            entity.HasOne(d => d.IdkhachHangNavigation).WithMany(p => p.TaiKhoanNguoiDungs)
                .HasForeignKey(d => d.IdkhachHang)
                .HasConstraintName("FK_TaiKhoanNguoiDung_KhachHang");
        });

        modelBuilder.Entity<ThongKeDoanhThuKhachSan>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__ThongKeD__3214EC27886FA6D9");

            entity.ToTable("ThongKeDoanhThuKhachSan");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("created_at");
            entity.Property(e => e.DoanhThuThucNhan)
                .HasComputedColumnSql("(COALESCE(\"TienPhong\", 0) + COALESCE(\"TienDichVu\", 0) - COALESCE(\"TienGiamGia\", 0))", true)
                .HasColumnType("decimal(20, 2)");
            entity.Property(e => e.IddatPhong)
                .HasMaxLength(50)
                .HasColumnName("IDDatPhong");
            entity.Property(e => e.IdhoaDon)
                .HasMaxLength(50)
                .HasColumnName("IDHoaDon");
            entity.Property(e => e.Ngay).HasDefaultValueSql("CURRENT_DATE");
            entity.Property(e => e.TienDichVu).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TienGiamGia).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.TienPhong).HasColumnType("decimal(18, 2)");
            entity.Property(e => e.UpdatedAt)
                .HasDefaultValueSql("now()")
                .HasColumnName("updated_at");

            entity.HasOne(d => d.IddatPhongNavigation).WithMany(p => p.ThongKeDoanhThuKhachSans)
                .HasForeignKey(d => d.IddatPhong)
                .HasConstraintName("FK_ThongKe_DatPhong");

            entity.HasOne(d => d.IdhoaDonNavigation).WithMany(p => p.ThongKeDoanhThuKhachSans)
                .HasForeignKey(d => d.IdhoaDon)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_ThongKe_HoaDon");
        });

        modelBuilder.Entity<TienNghi>(entity =>
        {
            entity.HasKey(e => e.IdtienNghi).HasName("PK__TienNghi__AC680E2F47BF430B");

            entity.ToTable("TienNghi");

            entity.Property(e => e.IdtienNghi)
                .HasMaxLength(50)
                .HasColumnName("IDTienNghi");
            entity.Property(e => e.TenTienNghi).HasMaxLength(100);
        });

        modelBuilder.Entity<TienNghiPhong>(entity =>
        {
            entity.HasKey(e => e.IdtienNghiPhong).HasName("PK__TienNghi__4ACF24F8C0F75A49");

            entity.ToTable("TienNghiPhong");

            entity.Property(e => e.IdtienNghiPhong)
                .HasMaxLength(50)
                .HasColumnName("IDTienNghiPhong");
            entity.Property(e => e.Idphong)
                .HasMaxLength(50)
                .HasColumnName("IDPhong");
            entity.Property(e => e.IdtienNghi)
                .HasMaxLength(50)
                .HasColumnName("IDTienNghi");

            entity.HasOne(d => d.IdphongNavigation).WithMany(p => p.TienNghiPhongs)
                .HasForeignKey(d => d.Idphong)
                .HasConstraintName("FK_TienNghiPhong_Phong");

            entity.HasOne(d => d.IdtienNghiNavigation).WithMany(p => p.TienNghiPhongs)
                .HasForeignKey(d => d.IdtienNghi)
                .HasConstraintName("FK_TienNghiPhong_TienNghi");
        });

        modelBuilder.Entity<TtdichVu>(entity =>
        {
            entity.HasKey(e => e.IdttdichVu).HasName("PK__TTDichVu__7E77C4BC31C6D633");

            entity.ToTable("TTDichVu");

            entity.Property(e => e.IdttdichVu)
                .HasMaxLength(50)
                .HasColumnName("IDTTDichVu");
            entity.Property(e => e.IddichVu)
                .HasMaxLength(50)
                .HasColumnName("IDDichVu");
            entity.Property(e => e.ThongTinDv)
                .HasMaxLength(255)
                .HasColumnName("ThongTinDV");

            entity.HasOne(d => d.IddichVuNavigation).WithMany(p => p.TtdichVus)
                .HasForeignKey(d => d.IddichVu)
                .HasConstraintName("FK_TTDichVu_DichVu");
        });

            // Global convention: Lowercase all table and column names to match PostgreSQL schema
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                // Lowercase table name
                var tableName = entityType.GetTableName();
                if (!string.IsNullOrEmpty(tableName))
                {
                    entityType.SetTableName(tableName.ToLower());
                }

                // Lowercase column names
                foreach (var property in entityType.GetProperties())
                {
                    var columnName = property.GetColumnName();
                    if (!string.IsNullOrEmpty(columnName))
                    {
                        property.SetColumnName(columnName.ToLower());
                    }
                }
            }

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}

