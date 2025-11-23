export type BlogPost = {
  id: number;
  title: string;
  category: string;
  type: "internal" | "external";
  externalLink?: string;
  image: string;
  date: string;
  excerpt?: string;
  author?: string;
  tags?: string[];
  content?: string; // html or plain text
  images?: string[]; // gallery images
};

export const blogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Tuyệt phẩm Kiến trúc: King Palace",
    category: "Khách sạn Sang Trọng",
    type: "internal",
    image: "https://images.vietnamtourism.gov.vn/vn/images/2017/DinhIDaLatJPG.jpg",
    date: "20th November, 2025",
    excerpt: "Thiên nhiên, không gian yên tĩnh và trải nghiệm nghỉ dưỡng cao cấp.",
    author: "Bùi Văn An",
    tags: ["khách sạn", "đà lạt", "relax", "kiến trúc Pháp"],
    images: [
      "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/08/20/23/a8/getlstd-property-photo.jpg?w=900&h=500&s=1",
      "https://cdn.tienphong.vn/images/9d0288f8304f7ea5ce27e6278ee2a2011172783d03b80038b19231e048a4ef710c835ab09e3206c17ab44bd8714e10a1/tp-1-5.jpg",
      "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/31/c5/1a/2f/caption.jpg?w=1400&h=-1&s=1"
    ],
    content: `
      1. Vị trí và Lịch sử Hình thành (King Palace)

      Dinh I, hay còn gọi là King Palace, là một trong ba dinh thự nổi tiếng của cựu Hoàng Bảo Đại tại Đà Lạt. Tọa lạc trên một ngọn đồi thông xanh mát, cách trung tâm thành phố khoảng 4km, dinh thự này ban đầu được xây dựng bởi triệu phú người Pháp Robert Clément. Tuy nhiên, nơi đây trở nên nổi tiếng khi được Vua Bảo Đại mua lại vào năm 1949 và sử dụng làm tổng hành dinh và nơi nghỉ dưỡng.

      Dinh I không chỉ là một công trình kiến trúc mà còn là chứng nhân cho một giai đoạn lịch sử đầy biến động của Việt Nam.

      Điểm nổi bật:
      Vị trí cao, tầm nhìn bao quát.
      Được bao quanh bởi rừng thông nguyên sinh, tạo không gian biệt lập và yên tĩnh.

      2. Tuyệt tác Kiến trúc Art Deco Đông Dương

      Dinh I là một ví dụ điển hình và hiếm hoi về sự kết hợp hài hòa giữa phong cách kiến trúc Art Deco phương Tây và nét tinh tế của kiến trúc Đông Dương.

      Các Đặc điểm Kiến trúc chính:
      Mặt tiền: Thiết kế khối hộp vuông vắn, tối giản nhưng vẫn toát lên vẻ uy nghi.
      Vật liệu: Sử dụng các vật liệu cao cấp như đá hoa cương, gỗ quý và kính màu.
      Cửa sổ vòm: Lớn, giúp đón ánh sáng tự nhiên tối đa và tạo tầm nhìn ra khung cảnh bên ngoài.
      Hầm ngầm: Dinh thự còn có hệ thống hầm ngầm kiên cố, từng được sử dụng làm nơi trú ẩn và giao thông bí mật.

      3. Không gian Nội thất và Khuôn viên Vương giả

      Nội thất bên trong dinh thự được bảo tồn khá nguyên vẹn, tái hiện cuộc sống của cựu hoàng và hoàng gia. Du khách có thể chiêm ngưỡng phòng làm việc, phòng ngủ với lò sưởi, và các vật dụng sinh hoạt cổ.

      Khuôn viên và Trải nghiệm:
      Vườn thượng uyển: Khu vườn được chăm sóc tỉ mỉ, trồng nhiều loại hoa đặc trưng của Đà Lạt.
      Đồi thông lãng mạn: Lối đi dạo dưới tán thông cao vút mang lại cảm giác thư thái tuyệt đối.
      Cổng chào và lính gác: Du khách còn có thể chụp ảnh với các nhân vật mô phỏng lính gác hoàng gia tại cổng vào.
    `,
  },
  {
    id: 2,
    title: "Cập nhật Tình hình Bão",
    category: "CẢNH BÁO KHẨN CẤP",
    type: "external",
    externalLink: "https://vnexpress.net/41-nguoi-chet-hon-52-000-nha-ngap-do-mua-lu-4969798.html",
    image: "https://i1-vnexpress.vnecdn.net/2025/11/20/nt-32-2845-1763642062-17636437-7860-8374-1763643768.jpg?w=1020&h=0&q=100&dpr=1&fit=crop&s=2DDmrLOUB1wJo69c7omoRw",
    date: "VUI LÒNG KIỂM TRA NGAY",
    excerpt: "Tin tức thời tiết khẩn cấp — mở nguồn tin chính thống.",
    author: "PV Thời tiết",
    tags: ["cảnh báo", "thời tiết", "an toàn"],
    images: ["https://i1-vnexpress.vnecdn.net/2025/11/20/cuuho-3-6992-1763642062-176364-8438-7059-1763643768.jpg?w=1020&h=0&q=100&dpr=1&fit=crop&s=9dDxcv1oFtk5H7OGnxZPKA"],
    content: `Bản tin được tổng hợp từ nguồn chính thống. Vui lòng theo dõi để cập nhật các khuyến nghị an toàn và thay đổi lịch trình du lịch khi cần. Liên hệ ngay với khách sạn để được hỗ trợ chuyển hoặc hủy phòng.`,
  },
  {
    id: 3,
    title: "Top 5 Góc Check-in Tĩnh lặng: Vườn hoa & Quán Cà phê mới",
    category: "Địa điểm Xanh",
    type: "internal",
    image: "https://placehold.co/800x600/E5E7EB/222222?text=Quiet+Checkin",
    date: "18th November, 2025",
    excerpt: "Những góc check-in yên bình cho chuyến đi của bạn.",
    author: "Nguyễn Thị Hoa",
    tags: ["check-in", "vườn hoa", "cà phê", "sống ảo"],
    images: [
      "https://placehold.co/1200x800/E5E7EB/222222?text=Cafe+View",
      "https://placehold.co/1200x800/CED4DA/111111?text=Flower+Garden"
    ],
    content: `
      Trốn tìm giữa Vườn Cẩm Tú Cầu và Cà phê Trên Mây

      Nếu bạn đã quá chán với những điểm đến đông đúc, Đà Lạt vẫn ẩn chứa những khu vườn và quán cà phê mang lại cảm giác bình yên tuyệt đối.

      1. Cà phê Mây Lượn: Quán cà phê nằm trên đỉnh đồi cao, chuyên phục vụ cà phê Arabica bản địa. Thời điểm đẹp nhất là sáng sớm (5:30 - 7:00) để ngắm săn mây.
      2. Vườn Hoa Thanh Xuân: Nơi tập trung nhiều loại hoa lạ, đặc biệt là Cẩm Tú Cầu và hoa Lavender. Địa điểm lý tưởng cho những bức hình cưới hoặc ảnh nghệ thuật.
      3. Thiền Viện Trúc Lâm: Không chỉ là nơi hành hương, đây còn là nơi bạn có thể ngắm toàn cảnh hồ Tuyền Lâm trong không gian tĩnh mịch.

      Mẹo: Mang theo áo ấm và giày thoải mái để khám phá các khu vực xung quanh.
    `,
  },
  {
    id: 4,
    title: "Đặc sản đường phố tại Chợ đêm",
    category: "Ẩm thực Đà Lạt",
    type: "internal",
    image: "https://placehold.co/800x600/F3F4F6/000000?text=Farm+to+Table",
    date: "15th November, 2025",
    excerpt: "Ẩm thực đa dạng, giá cả phải chăng, hương vị đậm đà.",
    author: "Phạm Văn Bảo",
    tags: ["ẩm thực", "chợ đêm", "đồ ăn vặt"],
    images: ["https://placehold.co/1200x800/F3F4F6/000000?text=Food+1"],
    content: `Chợ đêm Đà Lạt là thánh địa ẩm thực đường phố với nhiều món đặc sản như bánh tráng nướng, sữa đậu nành, và các món nướng. Hãy thử và so sánh hương vị địa phương. Chúng tôi khuyến nghị: Bánh tráng nướng trứng gà, Kem bơ, và Sữa đậu nành nóng.`
  },
  {
    id: 5,
    title: "Homestay đẹp có thiết kế độc đáo",
    category: "Lưu trú Nghệ thuật",
    type: "internal",
    image: "https://placehold.co/800x600/D1D5DB/111111?text=Minimalist+Stay",
    date: "12th November, 2025",
    excerpt: "Không gian sáng tạo, phù hợp cho khách muốn trải nghiệm địa phương.",
    author: "Lê Thùy Linh",
    tags: ["homestay", "thiết kế", "tối giản"],
    images: ["https://placehold.co/1200x800/D1D5DB/111111?text=Stay+1"],
    content: `Gợi ý homestay có thiết kế độc đáo, không gian yên tĩnh, thích hợp cho các cặp đôi và nhóm bạn. Nhiều homestay hiện nay theo phong cách tối giản (Minimalist) hoặc Bắc Âu (Scandinavian), mang lại trải nghiệm ấm cúng và gần gũi với thiên nhiên.`
  }
];

export default blogPosts;