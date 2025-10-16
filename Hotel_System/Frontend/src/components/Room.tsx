interface RoomProps {
  room: {
    title: string;
    price: number;
    image: string;
    stars?: number;
  };
}

const Room = ({ room }: RoomProps) => {
  return (
    <div className="room-card">
      <div className="room-img">
        <img
          src={room.image}
          alt={room.title}
          style={{ width: "100%", height: "240px", objectFit: "cover" }}
        />
      </div>
      <div className="room-content">
        <h5>{room.title}</h5>
        <p>
          <b>Giá:</b> {room.price.toLocaleString("vi-VN")}₫ / đêm
        </p>
        <p>
          <b>Đánh giá:</b> {room.stars ?? 0} ⭐
        </p>
      </div>
    </div>
  );
};

export default Room;
