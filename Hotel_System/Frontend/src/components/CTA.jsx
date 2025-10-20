import { Phone, Mail, MapPin } from "lucide-react";

const CTA = () => {
  return (
    <section className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600"
          alt="Hotel"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/70"></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="uppercase font-tertiary tracking-[6px] mb-6">
            Đặt Phòng Ngay
          </div>

          <h2 className="font-primary text-[40px] lg:text-[60px] leading-tight mb-6">
            Trải Nghiệm Kỳ Nghỉ Tuyệt Vời
          </h2>

          <p className="text-lg mb-8 max-w-2xl mx-auto leading-relaxed opacity-90">
            Đặt phòng ngay hôm nay và tận hưởng những ưu đãi đặc biệt dành riêng
            cho bạn. Chúng tôi cam kết mang đến trải nghiệm nghỉ dưỡng đẳng cấp
            nhất.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button className="btn btn-lg btn-primary">Đặt Phòng Ngay</button>
            <button className="btn btn-lg btn-white">
              Xem Các Gói Ưu Đãi
            </button>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/20">
            <div className="flex flex-col items-center">
              <Phone className="mb-3" size={32} />
              <div className="font-tertiary uppercase text-sm tracking-[2px] mb-2">
                Điện Thoại
              </div>
              <a
                href="tel:+84123456789"
                className="hover:text-accent transition-colors"
              >
                +84 123 456 789
              </a>
            </div>

            <div className="flex flex-col items-center">
              <Mail className="mb-3" size={32} />
              <div className="font-tertiary uppercase text-sm tracking-[2px] mb-2">
                Email
              </div>
              <a
                href="mailto:info@hotel.com"
                className="hover:text-accent transition-colors"
              >
                info@hotel.com
              </a>
            </div>

            <div className="flex flex-col items-center">
              <MapPin className="mb-3" size={32} />
              <div className="font-tertiary uppercase text-sm tracking-[2px] mb-2">
                Địa Chỉ
              </div>
              <p>123 Đường ABC, Quận 1, TP.HCM</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
