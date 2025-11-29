import React, { useEffect, useState } from "react";
import { API_CONFIG } from "../api/config";

// Use centralized API config
const API_BASE = `${API_CONFIG.CURRENT}/api`;

interface UserProfile {
  idkhachHang: number;
  hoTen: string;
  ngaySinh?: string;
  soDienThoai?: string;
  email?: string;
  ngayDangKy?: string;
  tichDiem?: number;
}

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loyalty, setLoyalty] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("hs_token");
      if (!token) {
        setError("Bạn chưa đăng nhập");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/auth/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data);
          // fetch loyalty info
          try {
            const resp2 = await fetch(`${API_BASE}/auth/loyalty`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (resp2.ok) {
              const d2 = await resp2.json();
              setLoyalty(d2);
            }
          } catch {}
        } else {
          setError("Không thể tải thông tin cá nhân");
        }
      } catch (err) {
        setError("Lỗi kết nối");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div
        className="container"
        style={{ padding: "100px 0", textAlign: "center" }}
      >
        <p>Đang tải...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="container"
        style={{ padding: "100px 0", textAlign: "center" }}
      >
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "100px 20px" }}>
      <div className="row">
        <div className="col-lg-8 offset-lg-2">
          <div className="section-title">
            <h2>Thông tin cá nhân</h2>
          </div>
          <div className="card">
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Họ tên:</label>
                    <p>{profile?.hoTen}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Email:</label>
                    <p>{profile?.email}</p>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Số điện thoại:</label>
                    <p>{profile?.soDienThoai || "Chưa cập nhật"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Ngày sinh:</label>
                    <p>
                      {profile?.ngaySinh
                        ? new Date(profile.ngaySinh).toLocaleDateString("vi-VN")
                        : "Chưa cập nhật"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Ngày đăng ký:</label>
                    <p>
                      {profile?.ngayDangKy
                        ? new Date(profile.ngayDangKy).toLocaleDateString(
                            "vi-VN"
                          )
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group">
                    <label>Tích điểm:</label>
                    <p>{profile?.tichDiem || 0}</p>
                    {loyalty && (
                      <small className="text-muted">
                        Hạng: {loyalty.tier} ·{" "}
                        {loyalty.totalSpent?.toLocaleString()} ₫ ·{" "}
                        {loyalty.totalNights} đêm
                      </small>
                    )}
                  </div>
                </div>
              </div>
              {loyalty && (
                <div style={{ marginTop: 12 }}>
                  <h5>Ưu đãi thành viên</h5>
                  <p>
                    1 điểm = {loyalty.vndPerPoint?.toLocaleString()} ₫ (hạng{" "}
                    {loyalty.tier})
                  </p>
                  <div>
                    <ul>
                      {Array.isArray(loyalty.rewards) &&
                        loyalty.rewards.map((r: any) => (
                          <li key={r.id} style={{ marginBottom: 6 }}>
                            <strong>{r.name}</strong> — {r.description} —{" "}
                            <em>{r.costPoints} điểm</em>
                            {r.canRedeem ? (
                              <button
                                style={{ marginLeft: 8 }}
                                className="btn btn-sm btn-primary"
                              >
                                Đổi
                              </button>
                            ) : (
                              <button
                                style={{ marginLeft: 8 }}
                                className="btn btn-sm btn-secondary"
                                disabled
                              >
                                Không đủ điểm
                              </button>
                            )}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
