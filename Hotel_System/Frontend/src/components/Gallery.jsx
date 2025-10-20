const Gallery = () => {
  const images = [
    {
      url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600",
      title: "Lobby sang trọng",
    },
    {
      url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600",
      title: "Phòng Suite",
    },
    {
      url: "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600",
      title: "Hồ bơi vô cực",
    },
    {
      url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600",
      title: "Nhà hàng",
    },
    {
      url: "https://images.unsplash.com/photo-1595521624992-48a59aef95e3?w=600",
      title: "Spa & Wellness",
    },
    {
      url: "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=600",
      title: "Phòng Gym",
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="uppercase font-tertiary tracking-[6px] text-accent mb-4">
            Thư Viện Ảnh
          </div>
          <h2 className="text-[40px] lg:text-[50px] font-primary leading-tight mb-4">
            Khám Phá Không Gian
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Hãy cùng khám phá những không gian đẹp và sang trọng tại khách sạn
            của chúng tôi
          </p>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image, idx) => (
            <div
              key={idx}
              className="relative group overflow-hidden rounded-lg h-[300px] cursor-pointer"
            >
              <img
                src={image.url}
                alt={image.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <h3 className="text-white text-2xl font-primary">
                  {image.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Gallery;
