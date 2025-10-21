import { useEffect, useState } from "react";
import { Spin, message } from "antd";
import { roomtypeAPI } from "../api/roomAPI";

const RoomTypes = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await roomtypeAPI.getAll();
        setTypes(data);
      } catch (err) {
        console.error(err);
        message.error("Không thể tải loại phòng");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spin />
      </div>
    );
  }

  if (!types || types.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="opacity-75">Không tìm thấy loại phòng nào.</p>
      </div>
    );
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h3 className="h3">Loại Phòng</h3>
          <p className="opacity-75">
            Khám phá các loại phòng phù hợp với nhu cầu của bạn
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {types.map((t) => (
            <div
              key={t.IDLoaiPhong}
              className="bg-white rounded-lg overflow-hidden shadow-sm p-4"
            >
              <img
                src={
                  t.UrlAnhLoaiPhong ||
                  "https://via.placeholder.com/400x200?text=No+Image"
                }
                alt={t.TenLoaiPhong}
                className="w-full h-40 object-cover mb-3 rounded"
              />
              <h4 className="font-semibold mb-2">{t.TenLoaiPhong}</h4>
              <p className="text-sm opacity-75 line-clamp-3">{t.MoTa}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RoomTypes;
