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

const MainPage: React.FC = () => {
  const [route, setRoute] = React.useState<string>(
    () => window.location.hash || "#/"
  );

  React.useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    const safejQueryPluginCall = (
      selector: string,
      plugin: string,
      options: any = {}
    ) => {
      try {
        const $ = (window as any).jQuery;
        if ($ && $.fn && $.fn[plugin]) {
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
        $(".search-switch").on("click", function () {
          $(".search-model").fadeIn(400);
        });
        $(".search-close-switch").on("click", function () {
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
        $(".canvas-open").on("click", function () {
          $(".offcanvas-menu-wrapper").addClass("show-offcanvas-menu-wrapper");
          $(".offcanvas-menu-overlay").addClass("active");
        });
        $(".canvas-close, .offcanvas-menu-overlay").on("click", function () {
          $(".offcanvas-menu-wrapper").removeClass(
            "show-offcanvas-menu-wrapper"
          );
          $(".offcanvas-menu-overlay").removeClass("active");
        });
      }
    } catch (e) {
      console.error("Lỗi offcanvas menu:", e);
    }
  }, []);

  if (route === "#/login") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <LoginPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#/register") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <RegisterPage />
        <FooterSection />
      </>
    );
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
