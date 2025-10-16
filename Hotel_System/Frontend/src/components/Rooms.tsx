import { useEffect, useState } from "react";
import { Spin, message } from "antd";
import Room from "./Room";
import { roomAPI } from "../api/roomAPI";
import { IPhong } from "../types/room.type";

const Rooms = () => {
  const [rooms, setRooms] = useState<IPhong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const data = await roomAPI.getAll();
        setRooms(data);
      } catch (error) {
        console.error(error);
        message.error("Không thể tải danh sách phòng");
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, []);

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <Spin size="large" tip="Đang tải danh sách phòng..." />
      </div>
    );

  return (
    <section className="rooms section-padding bg-light">
      <div className="container">
        <div className="section-title">
          <h2>Danh sách phòng</h2>
        </div>
        <div className="row">
          {rooms.map((room) => (
            <div key={room.idPhong} className="col-md-4">
              <Room
                room={{
                  title: room.tenPhong,
                  price: room.giaCoBanMotDem,
                  image:
                    room.urlAnhPhong ||
                    "https://via.placeholder.com/400x250?text=No+Image",
                  stars: room.xepHangSao,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Rooms;
