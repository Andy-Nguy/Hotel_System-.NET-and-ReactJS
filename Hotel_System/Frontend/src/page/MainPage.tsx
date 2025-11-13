import React, { useEffect } from "react";
import OffcanvasMenu from "../components/OffcanvasMenu";
import HeaderSection from "../components/HeaderSection";
import HeroSection from "../components/HeroSection";
import AboutUs from "../components/AboutUs";
import Services from "../components/Services";
import HomeRoom from "../components/HomeRoom";
import Testimonial from "../components/Testimonial";
import BlogSection from "../components/BlogSection";
import FooterSection from "../components/FooterSection";

import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import RoomPage from "./RoomPage";
import ProfilePage from "./ProfilePage";
import SelectRoomPage from "./SelectRoomPage";
import CheckoutPage from "./CheckoutPage";
import PaymentPage from "./PaymentPage";
import BookingSuccessPage from "./BookingSuccessPage";
import AdminDashboard from "../admin/pages/dashboard";
import RoomManager from "../admin/pages/RoomManager";
import AmenticsManager from "../admin/pages/AmenticsManager";
import ServiceManager from "../admin/pages/ServiceManager";

const MainPage: React.FC = () => {
  // route can be either a pathname (e.g. '/rooms') or a hash (e.g. '#rooms')
  const resolveRoute = () => {
    // Prefer pathname when present (clean URLs like /admin/rooms). Fall back to hash.
    try {
      const p = window.location.pathname;
      if (p && p !== "/") return p;
    } catch (e) {}
    try {
      const h = window.location.hash;
      if (h && h !== "#") return h;
    } catch (e) {}
    return "#";
  };

  const [route, setRoute] = React.useState<string>(resolveRoute);

  React.useEffect(() => {
    const onLocationChange = () => setRoute(resolveRoute());
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
    };
  }, []);
  // If URL has only a single '#' (empty hash), remove it to keep clean URLs
  React.useEffect(() => {
    if (window.location.hash === "#") {
      try {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      } catch (e) {
        window.location.hash = "";
      }
    }
  }, []);
  // Re-run jQuery initializations when route becomes Home. This fixes missing
  // images/slider when navigating back to Home via pushState (no full reload).
  useEffect(() => {
    if (!(route === "#" || route === "/")) return;

    const safejQueryPluginCall = (
      selector: string,
      plugin: string,
      options: any = {}
    ) => {
      try {
        const $ = (window as any).jQuery;
        if ($ && $.fn && $.fn[plugin]) {
          // If already initialized, try to destroy then re-init to avoid dupes
          try {
            const instance = $(selector).data("owl.carousel");
            if (instance && $.fn?.owlCarousel) {
              $(selector).trigger("destroy.owl.carousel");
            }
          } catch {}
          $(selector)[plugin](options);
        } else {
          console.warn(`jQuery plugin "${plugin}" không khả dụng.`);
        }
      } catch (e) {
        console.error(
          `Lỗi khi khởi tạo plugin "${plugin}" trên selector "${selector}":`,
          e
        );
      }
    };

    try {
      const $ = (window as any).jQuery;
      if ($) {
        $("#preloder")
          .delay(500)
          .fadeOut("slow", function (this: any) {
            $(this).remove();
          });
      }
    } catch (e) {
      console.error("Lỗi preloader:", e);
    }

    safejQueryPluginCall(".hero-slider", "owlCarousel", {
      loop: true,
      margin: 0,
      items: 1,
      dots: true,
      animateOut: "fadeOut",
      animateIn: "fadeIn",
      smartSpeed: 1200,
      autoHeight: false,
      autoplay: true,
      mouseDrag: false,
    });

    safejQueryPluginCall(".testimonial-slider", "owlCarousel", {
      items: 2,
      dots: true,
      autoplay: true,
      loop: true,
      smartSpeed: 1200,
      nav: false,
      responsive: { 0: { items: 1 }, 768: { items: 2 } },
    });

    try {
      const $ = (window as any).jQuery;
      if ($ && $.fn && $.fn.datepicker) {
        $(".date-input").datepicker({ minDate: 0, dateFormat: "dd M, yy" });
      }
    } catch (e) {
      console.error("Lỗi khởi tạo datepicker:", e);
    }

    safejQueryPluginCall("select", "niceSelect");

    try {
      const $ = (window as any).jQuery;
      if ($) {
        $(".search-switch")
          .off("click")
          .on("click", function () {
            $(".search-model").fadeIn(400);
          });
        $(".search-close-switch")
          .off("click")
          .on("click", function () {
            $(".search-model").fadeOut(400, function () {
              $("#search-input").val("");
            });
          });
      }
    } catch (e) {
      console.error("Lỗi search model:", e);
    }

    try {
      const $ = (window as any).jQuery;
      if ($) {
        $(".canvas-open")
          .off("click")
          .on("click", function () {
            $(".offcanvas-menu-wrapper").addClass(
              "show-offcanvas-menu-wrapper"
            );
            $(".offcanvas-menu-overlay").addClass("active");
          });
        $(".canvas-close, .offcanvas-menu-overlay")
          .off("click")
          .on("click", function () {
            $(".offcanvas-menu-wrapper").removeClass(
              "show-offcanvas-menu-wrapper"
            );
            $(".offcanvas-menu-overlay").removeClass("active");
          });
      }
    } catch (e) {
      console.error("Lỗi offcanvas menu:", e);
    }
  }, [route]);

  if (route === "#login" || route === "/login") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <LoginPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#register" || route === "/register") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <RegisterPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#rooms" || route === "/rooms") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <RoomPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#profile" || route === "/profile") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <ProfilePage />
        <FooterSection />
      </>
    );
  }

  if (route === "#select-room" || route === "/select-room") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <SelectRoomPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#checkout" || route === "/checkout") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <CheckoutPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#payment" || route === "/payment") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <PaymentPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#booking-success" || route === "/booking-success") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <BookingSuccessPage />
        <FooterSection />
      </>
    );
  }

  // Admin dashboard route (accessible at /admin/dashboard or #admin/dashboard)
  if (
    route === "#admin/dashboard" ||
    route === "/admin/dashboard" ||
    route === "#/admin/dashboard"
  ) {
    return <AdminDashboard />;
  }

  // Admin room manager route (accessible at /admin/rooms or #admin/rooms)
  if (
    route === "#admin/rooms" ||
    route === "/admin/rooms" ||
    route === "#/admin/rooms"
  ) {
    return <RoomManager />;
  }

  // Admin amenities page route (accessible at /admin/amenities or #admin/amenities)
  if (
    route === "#admin/amenities" ||
    route === "/admin/amenities" ||
    route === "#/admin/amenities"
  ) {
    return <AmenticsManager />;
  }

  // Admin services page route (accessible at /admin/services or #admin/services)
  if (
    route === "#admin/services" ||
    route === "/admin/services" ||
    route === "#/admin/services"
  ) {
    return <ServiceManager />;
  }

  return (
    <>
      <OffcanvasMenu />
      <HeaderSection />
      <HeroSection />
      <AboutUs />
      <Services />
      <HomeRoom />
      <Testimonial />
      <BlogSection />
      <FooterSection />
    </>
  );
};

export default MainPage;
