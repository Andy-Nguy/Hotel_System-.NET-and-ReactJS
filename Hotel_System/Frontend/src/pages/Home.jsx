import {
  BookForm,
  HeroSlider,
  Rooms,
  ScrollToTop,
  About,
  Services,
  Gallery,
  Testimonials,
  FAQs,
  CTA,
  RoomTypes,
} from "../components";

const Home = () => {
  return (
    <div>
      <ScrollToTop />

      {/* Hero Section */}
      <HeroSlider />

      {/* Booking Form */}
      <div className="container mx-auto relative">
        <div className="bg-accent/20 mt-4 p-4 lg:absolute lg:left-0 lg:right-0 lg:p-0 lg:-top-12 lg:z-30 lg:shadow-xl">
          <BookForm />
        </div>
      </div>

      {/* About Section */}
      <About />
      <RoomTypes />

      {/* Rooms Section */}
      <Rooms />

      {/* Services Section */}
      <Services />

      {/* Gallery Section */}
      <Gallery />

      {/* Testimonials Section */}
      <Testimonials />

      {/* FAQs Section */}
      <FAQs />

      {/* Call to Action Section */}
      <CTA />
    </div>
  );
};

export default Home;
