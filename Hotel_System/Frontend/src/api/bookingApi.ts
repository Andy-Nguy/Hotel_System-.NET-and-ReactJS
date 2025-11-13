import axios from "axios";

export interface Booking {
  iddatPhong: string;
  idkhachHang?: number;
  tenKhachHang?: string;
  emailKhachHang?: string;
  idphong: string;
  tenPhong?: string;
  soPhong?: string;
  ngayDatPhong?: string;
  ngayNhanPhong: string;
  ngayTraPhong: string;
  soDem?: number;
  tongTien: number;
  tienCoc?: number;
  trangThai: number;
  trangThaiThanhToan: number;
  chiTietDatPhongs: BookingDetail[];
}

export interface BookingDetail {
  idChiTiet: number;
  idPhong: string;
  tenPhongChiTiet?: string;
  soPhongChiTiet?: string;
  soDem: number;
  giaPhong: number;
  thanhTien: number;
  ghiChu?: string;
}

export interface UpdateBookingRequest {
  trangThai?: number;
  trangThaiThanhToan?: number;
}

// Backend runs (launch profile `http`) on: http://0.0.0.0:8080 (accessible as http://localhost:8080)
// Use http://localhost:8080 to avoid TLS dev-certificate issues during local development.
const API_BASE_URL = "http://localhost:8080/api";

export const getBookings = async (): Promise<Booking[]> => {
  const response = await axios.get(`${API_BASE_URL}/DatPhong`);
  return response.data;
};

export const getBookingById = async (id: string): Promise<Booking> => {
  const response = await axios.get(`${API_BASE_URL}/DatPhong/${id}`);
  return response.data;
};

export const updateBooking = async (
  id: string,
  data: UpdateBookingRequest
): Promise<void> => {
  await axios.put(`${API_BASE_URL}/DatPhong/${id}`, data);
};

export const deleteBooking = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE_URL}/DatPhong/${id}`);
};
