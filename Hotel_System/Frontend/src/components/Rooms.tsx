import { useEffect, useState } from "react";
import { Spin, message, Tag, Badge } from "antd";
import { User, Bed, Star, DoorOpen } from "lucide-react";
import { roomAPI } from "../api/roomAPI";
import { IPhong } from "../types/room.type";

// Room item component with enhanced UI
interface RoomItemProps {
  room: {
    idPhong: string;
    tenPhong: string;
    soPhong: string;
    moTa?: string;
    giaCoBanMotDem: number;
    soNguoiToiDa?: number;
    xepHangSao: number;
    trangThai: string;
    urlAnhPhong?: string;
  };
}

const Room = ({ room }: RoomItemProps) => {
  const isAvailable = room.trangThai === "Còn trống";

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      {/* Image Container with Badge */}
      <div className="relative overflow-hidden group">
        <img
          src={
            room.urlAnhPhong ||
            "https://via.placeholder.com/400x250?text=No+Image"
          }
          alt={room.tenPhong}
          className="w-full h-56 object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3">
          <Badge
            count={isAvailable ? "Còn trống" : "Bảo trì"}
            style={{
              backgroundColor: isAvailable ? "#52c41a" : "#ff4d4f",
              fontSize: "11px",
              fontWeight: "600",
            }}
          />
        </div>
        <div className="absolute top-3 left-3">
          <Tag
            style={{
              backgroundColor: "#a37d4c",
              color: "white",
              border: "none",
            }}
            className="text-xs font-tertiary uppercase"
          >
            <DoorOpen size={12} className="inline mr-1" />
            Phòng {room.soPhong}
          </Tag>
        </div>
      </div>

      {/* Content Container */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Room Title */}
        <h3 className="h3">{room.tenPhong}</h3>

        {/* Star Rating */}
        <div className="flex items-center gap-1 mb-3">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={16}
              className={
                i < room.xepHangSao
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }
            />
          ))}
          <span className="text-sm ml-1 opacity-75">({room.xepHangSao}/5)</span>
        </div>

        {/* Description */}
        {room.moTa && (
          <p className="text-sm mb-4 line-clamp-2 flex-1">{room.moTa}</p>
        )}

        {/* Room Details */}
        <div className="space-y-2 mb-4">
          {room.soNguoiToiDa && (
            <div className="flex items-center text-sm">
              <User size={16} className="mr-2 text-accent" />
              <span>
                Tối đa: <strong>{room.soNguoiToiDa} người</strong>
              </span>
            </div>
          )}
          <div className="flex items-center text-sm">
            <Bed size={16} className="mr-2 text-accent" />
            <span>
              Mã phòng: <strong>{room.idPhong}</strong>
            </span>
          </div>
        </div>

        {/* Price and Action */}
        <div className="pt-3 border-t border-gray-200 mt-auto">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs opacity-75 mb-1">Giá từ</p>
              <p className="text-2xl font-primary font-bold text-accent">
                {room.giaCoBanMotDem.toLocaleString("vi-VN")}₫
              </p>
              <p className="text-xs opacity-75">/ đêm</p>
            </div>
            <button
              className={`btn btn-sm ${
                isAvailable
                  ? "btn-primary"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!isAvailable}
            >
              {isAvailable ? "Đặt ngay" : "Bảo trì"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Rooms = () => {
  const [rooms, setRooms] = useState<IPhong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await roomAPI.getAll();
        // Filter featured rooms: use rating >= 4 as 'nổi bật' proxy,
        // sort by rating desc and take top 6
        const featured = data
          .filter((r) => (r.xepHangSao ?? 0) >= 4)
          .sort((a, b) => (b.xepHangSao ?? 0) - (a.xepHangSao ?? 0))
          .slice(0, 6);
        setRooms(featured);
      } catch (error) {
        console.error(error);
        message.error("Không thể tải danh sách phòng");
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 opacity-75">Đang tải danh sách phòng...</p>
        </div>
      </div>
    );
  }

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="uppercase font-tertiary tracking-[6px] text-accent mb-4">
            Phòng Nghỉ
          </div>
          <h2 className="h2">Phòng Nổi Bật</h2>
          <p className="max-w-2xl mx-auto">
            Những phòng được đánh giá cao — lựa chọn tốt nhất cho kỳ nghỉ của
            bạn.
          </p>
        </div>

        {/* Room Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rooms.map((room) => (
            <Room key={room.idPhong} room={room} />
          ))}
        </div>

        {/* Empty State */}
        {rooms.length === 0 && (
          <div className="text-center py-16">
            <p className="text-lg opacity-75">Không có phòng nào khả dụng</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Rooms;
