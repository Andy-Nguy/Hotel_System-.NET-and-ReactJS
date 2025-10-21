import apiClient from "./axiosClient";
import { IPhong } from "../types/room.type";
import { ILoaiPhong } from "../types/loaiphong.type";

export const roomAPI = {
  getAll: async (): Promise<IPhong[]> => {
    try {
      const res = await apiClient.get<IPhong[]>("/Phong");
      console.log("✅ API response:", res.data);
      return res.data;
    } catch (error) {
      console.error("❌ API Error:", error);
      throw error;
    }
  },
};
export const roomtypeAPI = {
  getAll: async (): Promise<ILoaiPhong[]> => {
    try {
      const res = await apiClient.get<ILoaiPhong[]>("/LoaiPhong");
      console.log("✅ API response:", res.data);
      return res.data;
    } catch (error) {
      console.error("❌ API Error:", error);
      throw error;
    }
  },
};
