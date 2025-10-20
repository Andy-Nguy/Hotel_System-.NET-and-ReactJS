import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQs = () => {
  const [activeIndex, setActiveIndex] = useState(null);

  const faqs = [
    {
      question: "Thời gian nhận phòng và trả phòng là mấy giờ?",
      answer:
        "Thời gian nhận phòng là từ 14:00 và trả phòng trước 12:00. Nếu bạn cần nhận phòng sớm hoặc trả phòng muộn, vui lòng liên hệ với chúng tôi để được hỗ trợ.",
    },
    {
      question: "Khách sạn có cung cấp dịch vụ đưa đón sân bay không?",
      answer:
        "Có, chúng tôi cung cấp dịch vụ đưa đón sân bay 24/7. Vui lòng đặt trước ít nhất 24 giờ để đảm bảo xe sẵn sàng đón bạn.",
    },
    {
      question: "Có WiFi miễn phí không?",
      answer:
        "Có, WiFi tốc độ cao hoàn toàn miễn phí trong toàn bộ khu vực khách sạn, bao gồm phòng nghỉ và khu vực công cộng.",
    },
    {
      question: "Khách sạn có chấp nhận thú cưng không?",
      answer:
        "Chúng tôi có chính sách chấp nhận thú cưng với một số điều kiện. Vui lòng liên hệ trước khi đặt phòng để được tư vấn chi tiết.",
    },
    {
      question: "Có chỗ đậu xe không? Có mất phí không?",
      answer:
        "Khách sạn có bãi đậu xe rộng rãi, an toàn hoàn toàn miễn phí cho khách lưu trú. Chúng tôi cũng có dịch vụ trông xe 24/7.",
    },
    {
      question: "Chính sách hủy phòng như thế nào?",
      answer:
        "Bạn có thể hủy miễn phí trước 48 giờ so với thời gian nhận phòng. Sau thời gian này, phí hủy sẽ được áp dụng tùy theo loại phòng và thời điểm đặt.",
    },
    {
      question: "Khách sạn có nhà hàng không?",
      answer:
        "Có, chúng tôi có 2 nhà hàng phục vụ ẩm thực Á - Âu, 1 quầy bar sang trọng và dịch vụ phòng 24/7.",
    },
    {
      question: "Có dịch vụ giặt ủi không?",
      answer:
        "Có, chúng tôi cung cấp dịch vụ giặt ủi nhanh chóng. Quần áo sẽ được trả trong vòng 24 giờ hoặc dịch vụ nhanh trong 6 giờ với phụ phí.",
    },
  ];

  const toggleFAQ = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  return (
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="uppercase font-tertiary tracking-[6px] text-accent mb-4">
            Câu Hỏi Thường Gặp
          </div>
          <h2 className="h2">
            Có Thắc Mắc?
          </h2>
          <p className="max-w-2xl mx-auto">
            Tìm câu trả lời cho những câu hỏi phổ biến nhất về dịch vụ của chúng
            tôi
          </p>
        </div>

        {/* FAQs List */}
        <div className="max-w-4xl mx-auto">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-lg mb-4 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button
                onClick={() => toggleFAQ(idx)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-lg pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`text-accent flex-shrink-0 transition-transform duration-300 ${
                    activeIndex === idx ? "rotate-180" : ""
                  }`}
                  size={24}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  activeIndex === idx ? "max-h-96" : "max-h-0"
                }`}
              >
                <div className="px-6 pb-5 pt-2 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="text-center mt-12">
          <p className="mb-4">
            Không tìm thấy câu trả lời bạn cần?
          </p>
          <button className="btn btn-lg btn-primary">
            Liên Hệ Với Chúng Tôi
          </button>
        </div>
      </div>
    </section>
  );
};

export default FAQs;
