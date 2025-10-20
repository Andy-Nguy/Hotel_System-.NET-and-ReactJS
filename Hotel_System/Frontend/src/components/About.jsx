import { Check } from "lucide-react";

const About = () => {
  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Image Side */}
          <div className="relative">
            <div className="relative h-[400px] lg:h-[600px] overflow-hidden rounded-lg">
              <img
                src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"
                alt="Luxury Hotel"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
            </div>

            {/* Floating Card */}
            <div className="absolute -bottom-8 -right-8 bg-accent text-white p-8 rounded-lg shadow-2xl hidden lg:block">
              <div className="text-5xl font-primary font-bold">25+</div>
              <div className="text-sm uppercase tracking-[3px] font-tertiary mt-2">
                Năm Kinh Nghiệm
              </div>
            </div>
          </div>

          {/* Content Side */}
          <div>
            <div className="uppercase font-tertiary tracking-[6px] text-accent mb-4">
              Về Chúng Tôi
            </div>
            <h2 className="h2">
              Trải Nghiệm Sang Trọng & Đẳng Cấp
            </h2>
            <p className="mb-6 leading-relaxed">
              Chào mừng bạn đến với khách sạn của chúng tôi - nơi sự sang trọng
              kết hợp hoàn hảo với sự thoải mái. Với hơn 25 năm kinh nghiệm
              trong ngành dịch vụ khách sạn, chúng tôi cam kết mang đến cho bạn
              những trải nghiệm nghỉ dưỡng tuyệt vời nhất.
            </p>
            <p className="mb-8 leading-relaxed">
              Từng chi tiết được thiết kế tinh tế, từng dịch vụ được thực hiện
              với sự tận tâm, tất cả nhằm tạo nên một kỳ nghỉ đáng nhớ cho bạn
              và gia đình.
            </p>

            {/* Features List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {[
                "Phòng nghỉ sang trọng 5 sao",
                "Nhà hàng đẳng cấp quốc tế",
                "Dịch vụ spa & massage",
                "Hồ bơi vô cực tuyệt đẹp",
                "Phòng gym & yoga hiện đại",
                "Dịch vụ 24/7 tận tình",
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <Check className="text-accent flex-shrink-0" size={20} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <button className="btn btn-lg btn-primary">Khám Phá Thêm</button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
