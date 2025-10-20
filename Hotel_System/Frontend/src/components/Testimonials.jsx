import { Star, Quote } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper";
import "swiper/css";
import "swiper/css/pagination";

const Testimonials = () => {
  const testimonials = [
    {
      name: "Nguyễn Văn An",
      role: "Doanh nhân",
      rating: 5,
      comment:
        "Một trong những khách sạn tuyệt vời nhất tôi từng ở. Dịch vụ chuyên nghiệp, phòng ốc sang trọng và nhân viên rất thân thiện. Chắc chắn sẽ quay lại!",
      avatar: "https://i.pravatar.cc/150?img=33",
    },
    {
      name: "Trần Thị Bình",
      role: "Kiến trúc sư",
      rating: 5,
      comment:
        "View từ phòng thật tuyệt vời! Bữa sáng phong phú, hồ bơi đẹp và sạch sẽ. Nhân viên luôn sẵn sàng giúp đỡ. Một kỳ nghỉ đáng nhớ!",
      avatar: "https://i.pravatar.cc/150?img=45",
    },
    {
      name: "Lê Hoàng Minh",
      role: "Nhà đầu tư",
      rating: 5,
      comment:
        "Khách sạn đẳng cấp với mọi tiện nghi hiện đại. Đặc biệt ấn tượng với spa và dịch vụ massage. Rất đáng giá cho khoản tiền bỏ ra.",
      avatar: "https://i.pravatar.cc/150?img=12",
    },
    {
      name: "Phạm Thu Hà",
      role: "Marketing Director",
      rating: 5,
      comment:
        "Không gian yên tĩnh, sang trọng. Phòng rộng rãi, giường ngủ êm ái. Nhà hàng có món ăn ngon. Sẽ giới thiệu cho bạn bè và đồng nghiệp.",
      avatar: "https://i.pravatar.cc/150?img=27",
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="uppercase font-tertiary tracking-[6px] text-accent mb-4">
            Đánh Giá Khách Hàng
          </div>
          <h2 className="h2">
            Khách Hàng Nói Gì Về Chúng Tôi
          </h2>
          <p className="max-w-2xl mx-auto">
            Hơn 10,000+ khách hàng hài lòng đã trải nghiệm dịch vụ của chúng tôi
          </p>
        </div>

        {/* Testimonials Slider */}
        <Swiper
          modules={[Autoplay, Pagination]}
          spaceBetween={30}
          slidesPerView={1}
          pagination={{ clickable: true }}
          autoplay={{
            delay: 5000,
            disableOnInteraction: false,
          }}
          breakpoints={{
            768: {
              slidesPerView: 2,
            },
            1024: {
              slidesPerView: 3,
            },
          }}
          className="pb-12"
        >
          {testimonials.map((testimonial, idx) => (
            <SwiperSlide key={idx}>
              <div className="bg-white p-8 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
                {/* Quote Icon */}
                <Quote className="text-accent mb-4" size={40} />

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className="fill-yellow-400 text-yellow-400"
                    />
                  ))}
                </div>

                {/* Comment */}
                <p className="mb-6 leading-relaxed italic">
                  "{testimonial.comment}"
                </p>

                {/* Author Info */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <h4 className="font-semibold">
                      {testimonial.name}
                    </h4>
                    <p className="text-sm opacity-75">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
};

export default Testimonials;
