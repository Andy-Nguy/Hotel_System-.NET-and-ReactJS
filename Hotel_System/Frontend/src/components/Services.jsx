import { Wifi, Coffee, Car, Dumbbell, Utensils, Waves } from "lucide-react";

const Services = () => {
  const services = [
    {
      icon: <Wifi size={40} />,
      title: "WiFi Miễn Phí",
      description:
        "Kết nối internet tốc độ cao không giới hạn trong toàn bộ khách sạn",
    },
    {
      icon: <Utensils size={40} />,
      title: "Nhà Hàng",
      description:
        "Thưởng thức ẩm thực đa dạng từ Á đến Âu với đầu bếp chuyên nghiệp",
    },
    {
      icon: <Waves size={40} />,
      title: "Hồ Bơi",
      description: "Hồ bơi vô cực với view tuyệt đẹp, mở cửa 24/7",
    },
    {
      icon: <Dumbbell size={40} />,
      title: "Phòng Gym",
      description: "Phòng tập gym hiện đại với đầy đủ thiết bị và HLV cá nhân",
    },
    {
      icon: <Car size={40} />,
      title: "Đưa Đón Sân Bay",
      description: "Dịch vụ đưa đón sân bay 24/7 với xe sang trọng",
    },
    {
      icon: <Coffee size={40} />,
      title: "Spa & Massage",
      description: "Thư giãn với dịch vụ spa và massage đẳng cấp 5 sao",
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="uppercase font-tertiary tracking-[6px] text-accent mb-4">
            Dịch Vụ Của Chúng Tôi
          </div>
          <h2 className="text-[40px] lg:text-[50px] font-primary leading-tight mb-4">
            Tiện Nghi & Dịch Vụ
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Khám phá các dịch vụ và tiện nghi cao cấp được thiết kế để mang lại
            trải nghiệm nghỉ dưỡng hoàn hảo nhất
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, idx) => (
            <div
              key={idx}
              className="bg-white p-8 rounded-lg hover:shadow-xl transition-all duration-300 group"
            >
              <div className="text-accent mb-6 group-hover:scale-110 transition-transform duration-300">
                {service.icon}
              </div>
              <h3 className="text-2xl font-primary font-semibold mb-3">
                {service.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
