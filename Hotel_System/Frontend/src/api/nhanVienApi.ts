import axiosClient from "./axiosClient";

// Types
export interface NhanVien {
  idNguoiDung: number;
  idKhachHang: number;
  hoTen: string;
  email: string | null;
  soDienThoai: string | null;
  ngaySinh: string | null;
  ngayDangKy: string | null;
  vaiTro: number;
  tenVaiTro: string;
}

export interface ThongKeNhanVien {
  tongSo: number;
  soNhanVien: number;
  soAdmin: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// API Functions

/**
 * Lấy danh sách tất cả nhân viên
 * GET /api/QuanLyNhanVien
 */
export async function layDanhSachNhanVien(): Promise<ApiResponse<NhanVien[]>> {
  try {
    const response = await axiosClient.get<ApiResponse<NhanVien[]>>(
      "/QuanLyNhanVien"
    );
    return response.data;
  } catch (error: any) {
    console.error("[nhanVienApi] Lỗi lấy danh sách nhân viên:", error);
    return {
      success: false,
      error:
        error.response?.data?.error || error.message || "Lỗi kết nối server",
    };
  }
}

/**
 * Lấy thống kê nhân viên
 * GET /api/QuanLyNhanVien/thong-ke
 */
export async function thongKeNhanVien(): Promise<ApiResponse<ThongKeNhanVien>> {
  try {
    const response = await axiosClient.get<ApiResponse<ThongKeNhanVien>>(
      "/QuanLyNhanVien/thong-ke"
    );
    return response.data;
  } catch (error: any) {
    console.error("[nhanVienApi] Lỗi lấy thống kê nhân viên:", error);
    return {
      success: false,
      error:
        error.response?.data?.error || error.message || "Lỗi kết nối server",
    };
  }
}

/**
 * Tạo nhân viên mới
 * POST /api/QuanLyNhanVien
 */
export async function taoNhanVien(data: {
  hoTen: string;
  email: string;
  matKhau: string;
  soDienThoai: string;
  ngaySinh: string;
  vaiTro: number;
}): Promise<ApiResponse<NhanVien>> {
  try {
    const response = await axiosClient.post<ApiResponse<NhanVien>>(
      "/QuanLyNhanVien",
      data
    );
    return response.data;
  } catch (error: any) {
    console.error("[nhanVienApi] Lỗi tạo nhân viên:", error);
    return {
      success: false,
      error:
        error.response?.data?.error || error.message || "Lỗi kết nối server",
    };
  }
}

/**
 * Cập nhật nhân viên
 * PUT /api/QuanLyNhanVien/{id}
 */
export async function capNhatNhanVien(
  id: number,
  data: {
    hoTen: string;
    email: string;
    soDienThoai: string;
    ngaySinh: string;
    vaiTro: number;
  }
): Promise<ApiResponse<NhanVien>> {
  try {
    const response = await axiosClient.put<ApiResponse<NhanVien>>(
      `/QuanLyNhanVien/${id}`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error("[nhanVienApi] Lỗi cập nhật nhân viên:", error);
    return {
      success: false,
      error:
        error.response?.data?.error || error.message || "Lỗi kết nối server",
    };
  }
}

/**
 * Đổi mật khẩu nhân viên
 * PUT /api/QuanLyNhanVien/{id}/doi-mat-khau
 */
export async function doiMatKhauNhanVien(
  id: number,
  data: {
    matKhauMoi: string;
  }
): Promise<ApiResponse<any>> {
  try {
    const response = await axiosClient.put<ApiResponse<any>>(
      `/QuanLyNhanVien/${id}/doi-mat-khau`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error("[nhanVienApi] Lỗi đổi mật khẩu:", error);
    return {
      success: false,
      error:
        error.response?.data?.error || error.message || "Lỗi kết nối server",
    };
  }
}

/**
 * Xóa nhân viên
 * DELETE /api/QuanLyNhanVien/{id}
 */
export async function xoaNhanVien(id: number): Promise<ApiResponse<any>> {
  try {
    const response = await axiosClient.delete<ApiResponse<any>>(
      `/QuanLyNhanVien/${id}`
    );
    return response.data;
  } catch (error: any) {
    console.error("[nhanVienApi] Lỗi xóa nhân viên:", error);
    return {
      success: false,
      error:
        error.response?.data?.error || error.message || "Lỗi kết nối server",
    };
  }
}

// Default export chứa tất cả các functions
const nhanVienApi = {
  layDanhSachNhanVien,
  thongKeNhanVien,
  taoNhanVien,
  capNhatNhanVien,
  doiMatKhauNhanVien,
  xoaNhanVien,
};

export default nhanVienApi;
