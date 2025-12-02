import { useState, useEffect } from "react";
import { getRooms, type Room } from "../../api/roomsApi";
import {
  getAmenities,
  getAmenitiesForRoom,
  assignAmenityToRoom,
  removeAmenityFromRoom,
  type Amenity,
} from "../../api/amenticsApi";

export const AmenticsRoomSection = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomAmenities, setRoomAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedAmenitiesMap, setSelectedAmenitiesMap] = useState<
    Record<string, boolean>
  >({});

  // Load rooms and amenities on mount
  useEffect(() => {
    loadInitialData();
  }, []);

  // When room is selected, load its amenities
  useEffect(() => {
    if (selectedRoom) {
      loadRoomAmenities(selectedRoom.idphong);
    }
  }, [selectedRoom]);

  // Update selected amenities map when room amenities change
  useEffect(() => {
    const map: Record<string, boolean> = {};
    roomAmenities.forEach((a) => {
      map[a.idtienNghi] = true;
    });
    setSelectedAmenitiesMap(map);
  }, [roomAmenities]);

  const loadInitialData = async () => {
    setLoading(true);
    setError("");
    try {
      const [roomsData, amenitiesData] = await Promise.all([
        getRooms(),
        getAmenities(),
      ]);
      setRooms(roomsData);
      setAmenities(amenitiesData);
    } catch (err: any) {
      setError(err.message || "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const loadRoomAmenities = async (roomId: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await getAmenitiesForRoom(roomId);
      setRoomAmenities(data);
    } catch (err: any) {
      setError(err.message || "Không thể tải tiện nghi của phòng");
      setRoomAmenities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAmenityToggle = (amenityId: string) => {
    setSelectedAmenitiesMap((prev) => ({
      ...prev,
      [amenityId]: !prev[amenityId],
    }));
  };

  const handleSaveChanges = async () => {
    if (!selectedRoom) {
      alert("Vui lòng chọn phòng");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Determine which amenities were added and removed
      const currentAmenityIds = new Set(roomAmenities.map((a) => a.idtienNghi));
      const selectedIds = new Set(
        Object.entries(selectedAmenitiesMap)
          .filter(([_, selected]) => selected)
          .map(([id, _]) => id)
      );

      // Remove amenities that are no longer selected
      for (const amenityId of currentAmenityIds) {
        if (!selectedIds.has(amenityId)) {
          await removeAmenityFromRoom(selectedRoom.idphong, amenityId);
        }
      }

      // Add newly selected amenities
      for (const amenityId of selectedIds) {
        if (!currentAmenityIds.has(amenityId)) {
          await assignAmenityToRoom(selectedRoom.idphong, amenityId);
        }
      }

      // Reload room amenities to confirm
      await loadRoomAmenities(selectedRoom.idphong);
      alert("Cập nhật tiện nghi thành công!");
    } catch (err: any) {
      setError(err.message || "Lỗi khi cập nhật tiện nghi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Cấu hình tiện nghi phòng</h1>
      </div>

      {error && <div style={styles.errorMsg}>{error}</div>}

      <div style={styles.content}>
        {/* Left Panel: Room Selection */}
        <div style={styles.leftPanel}>
          <h2 style={styles.panelTitle}>Chọn phòng</h2>
          <div style={styles.roomList}>
            {loading ? (
              <div style={styles.loadingMsg}>Đang tải phòng...</div>
            ) : rooms.length === 0 ? (
              <div style={styles.emptyMsg}>Chưa có phòng nào</div>
            ) : (
              rooms.map((room) => (
                <button
                  key={room.idphong}
                  type="button"
                  style={{
                    ...styles.roomItem,
                    ...(selectedRoom?.idphong === room.idphong
                      ? styles.roomItemActive
                      : {}),
                  }}
                  onClick={() => setSelectedRoom(room)}
                >
                  <div style={styles.roomItemName}>{room.tenPhong}</div>
                  <div style={styles.roomItemId}>{room.idphong}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Amenities Selection */}
        <div style={styles.rightPanel}>
          {selectedRoom ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <h2 style={styles.panelTitle}>
                  Tiện nghi của {selectedRoom.tenPhong}
                </h2>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  {Object.values(selectedAmenitiesMap).filter(Boolean).length}{" "}
                  đã chọn
                </div>
              </div>

              <div style={styles.amenitiesSearchWrap}>
                <input
                  placeholder="Tìm kiếm tiện nghi trong phòng..."
                  style={styles.searchInputSmall}
                  onChange={(e) => {
                    // lightweight local filter - keep original amenities
                    const q = e.target.value.toLowerCase();
                    if (!q) setAmenities((a) => a.slice());
                    else
                      setAmenities((a) =>
                        a.filter((am) =>
                          (am.tenTienNghi || "").toLowerCase().includes(q)
                        )
                      );
                  }}
                />
              </div>

              {loading ? (
                <div style={styles.loadingMsg}>Đang tải tiện nghi...</div>
              ) : amenities.length === 0 ? (
                <div style={styles.emptyMsg}>Chưa có tiện nghi nào</div>
              ) : (
                <div style={styles.amenitiesGrid}>
                  {amenities.map((amenity) => {
                    const checked = !!selectedAmenitiesMap[amenity.idtienNghi];
                    return (
                      <label
                        key={amenity.idtienNghi}
                        style={{
                          ...styles.amenityPill,
                          ...(checked ? styles.amenityPillActive : {}),
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            handleAmenityToggle(amenity.idtienNghi)
                          }
                          style={{ display: "none" }}
                          disabled={saving}
                        />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>
                            {amenity.tenTienNghi}
                          </div>
                          <div style={styles.amenityCountPill}>
                            {amenity.roomCount || 0}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 14,
                }}
              >
                <button
                  type="button"
                  style={{ ...styles.btn, ...styles.btnPrimary }}
                  onClick={handleSaveChanges}
                  disabled={saving}
                >
                  💾 {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </>
          ) : (
            <div style={styles.selectPrompt}>Vui lòng chọn một phòng</div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: "0px",
    backgroundColor: "transparent",
  },
  header: {
    marginBottom: "20px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "600" as const,
    margin: 0,
    color: "#333",
  },
  errorMsg: {
    padding: "12px 15px",
    backgroundColor: "#ffe6e6",
    color: "#c0392b",
    borderRadius: "4px",
    marginBottom: "15px",
    border: "1px solid #e74c3c",
  },
  content: {
    display: "flex" as const,
    gap: "20px",
    height: "500px",
  },
  leftPanel: {
    flex: "0 0 280px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    padding: "15px",
    border: "1px solid #eee",
    display: "flex" as const,
    flexDirection: "column" as const,
  },
  panelTitle: {
    fontSize: "14px",
    fontWeight: "600" as const,
    margin: "0 0 12px 0",
    color: "#333",
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  roomList: {
    flex: 1,
    overflowY: "auto" as const,
    display: "flex" as const,
    flexDirection: "column" as const,
    gap: "8px",
  },
  roomItem: {
    padding: "10px 12px",
    border: "1px solid #e6eef6",
    borderRadius: "8px",
    backgroundColor: "#fff",
    cursor: "pointer" as const,
    textAlign: "left" as const,
    transition: "all 0.2s",
    fontWeight: "500" as const,
    fontSize: "13px",
  },
  roomItemActive: {
    boxShadow: "0 8px 20px rgba(59,130,246,0.08)",
    border: "1px solid rgba(59,130,246,0.3)",
    transform: "translateY(-2px)",
  },
  roomItemName: {
    fontSize: "13px",
    fontWeight: "600" as const,
    marginBottom: "4px",
  },
  roomItemId: {
    fontSize: "11px",
    opacity: 0.7,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    padding: "15px",
    border: "1px solid #eee",
    display: "flex" as const,
    flexDirection: "column" as const,
  },
  amenitiesSearchWrap: {
    marginBottom: 10,
  },
  searchInputSmall: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #e6eef6",
    borderRadius: 8,
    fontSize: 13,
    boxSizing: "border-box" as const,
  },
  amenitiesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "start",
  },
  amenityPill: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "12px 14px",
    background: "#fff",
    border: "1px solid #e6eef6",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.12s",
  },
  amenityPillActive: {
    background: "linear-gradient(135deg,#ecfdf5,#bbf7d0)",
    border: "1px solid #34d399",
  },
  amenityCountPill: {
    background: "#eef2ff",
    color: "#3730a3",
    padding: "4px 8px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
  },
  amenityItem: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "10px",
    padding: "10px 12px",
    backgroundColor: "#fff",
    borderRadius: "6px",
    border: "1px solid #ddd",
    cursor: "pointer" as const,
    transition: "all 0.2s",
    fontSize: "13px",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    cursor: "pointer" as const,
    accentColor: "#3b82f6",
  },
  amenityLabel: {
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "8px",
    fontWeight: "500" as const,
  },
  amenityCount: {
    fontSize: "11px",
    color: "#999",
    fontWeight: "400" as const,
  },
  btn: {
    padding: "10px 16px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer" as const,
    fontSize: "13px",
    fontWeight: "600" as const,
    transition: "all 0.2s",
  },
  btnPrimary: {
    backgroundColor: "#27ae60",
    color: "white",
  },
  loadingMsg: {
    padding: "12px 15px",
    backgroundColor: "#e8f4f8",
    color: "#2c3e50",
    borderRadius: "4px",
    textAlign: "center" as const,
    fontSize: "13px",
  },
  emptyMsg: {
    padding: "20px 15px",
    backgroundColor: "#f0f0f0",
    color: "#999",
    borderRadius: "4px",
    textAlign: "center" as const,
    fontSize: "13px",
    fontStyle: "italic" as const,
  },
  selectPrompt: {
    display: "flex" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    height: "100%",
    color: "#999",
    fontSize: "14px",
    fontStyle: "italic" as const,
  },
};
