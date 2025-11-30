import React, { useEffect } from "react";
import OffcanvasMenu from "../components/OffcanvasMenu";
import HeaderSection from "../components/HeaderSection";
import HeroSection from "../components/HeroSection";
import PromotionSection from "../components/PromotionSection";
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
import AdminDashboard from "../admin/pages/Dashboard.tsx";
import RoomManager from "../admin/pages/RoomManager";
import AmenticsManager from "../admin/pages/AmenticsManager";
import ServiceManager from "../admin/pages/ServiceManager";
import PromotionManager from "../admin/pages/PromotionManager";
import BookingManager from "../admin/pages/BookingManager";
import InvoicesManager from "../admin/pages/InvoicesManager";
import CheckoutManager from "../admin/pages/CheckoutManager";
import CheckInManager from "../admin/pages/CheckInManager";
import LoyaltyManager from "../admin/pages/LoyaltyManager";
import ReviewManager from "../admin/pages/ReviewManager";
import BlogManager from "../admin/pages/BlogManager";
import BlogCreate from "../admin/components/BlogCreate";
import BlogEdit from "../admin/components/BlogEdit";
import QuanLyNhanVienManager from "../admin/pages/QuanLyNhanVienManager";

import NoAccessPage from "./NoAccessPage";
import BookingSuccessPage from "./BookingSuccessPage";
import AboutUsSection from "../components/AboutUsSection";
import AboutUsPage from "./AboutUsPage";
import ContactPage from "./ContactPage";
import MyBookingsPage from "./MyBookingsPage";
import BlogDetail from "./BlogDetail";
import ReviewPage from "./ReviewPage";

import AdminLayout from "../admin/components/AdminLayout";
import {
  getUserInfo,
  checkIsNhanVien,
  checkIsAdmin,
} from "../context/UserContext";

const MainPage: React.FC = () => {
  // Sử dụng hàm getUserInfo thống nhất
  const getInitialUserInfo = () => {
    return getUserInfo();
  };

  const [cachedUserInfo, setCachedUserInfo] =
    React.useState<any>(getInitialUserInfo);
  const [authLoading, setAuthLoading] = React.useState(!getInitialUserInfo());

  // Fetch user info on mount (to refresh/validate)
  React.useEffect(() => {
    const fetchUserInfo = async () => {
      const token = localStorage.getItem("hs_token");
      if (!token) {
        setCachedUserInfo(null);
        localStorage.removeItem("hs_userInfo");
        setAuthLoading(false);
        return;
      }

      // Sử dụng hàm getUserInfo thống nhất
      const info = getUserInfo();
      if (info && typeof info.role === "number") {
        console.log("[MainPage] Using getUserInfo:", info);
        setCachedUserInfo(info);
        setAuthLoading(false);
        return;
      }

      // Fallback: gọi API profile
      try {
        const API_BASE = `${
          (await import("../api/config")).API_CONFIG.CURRENT
        }/api`;
        const res = await fetch(`${API_BASE}/Auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const profile = await res.json();
          console.log("[MainPage] Profile from API:", profile);
          const userInfo = {
            name: profile.hoTen || profile.HoTen || profile.name,
            role: profile.vaiTro ?? profile.VaiTro ?? profile.role,
            email: profile.email || profile.Email,
          };
          setCachedUserInfo(userInfo);
          localStorage.setItem("hs_userInfo", JSON.stringify(userInfo));
        } else {
          // Fallback to JWT
          const fallbackInfo = getUserInfo();
          setCachedUserInfo(fallbackInfo);
        }
      } catch (e) {
        console.error("[MainPage] Profile fetch error:", e);
        const fallbackInfo = getUserInfo();
        setCachedUserInfo(fallbackInfo);
      }
      setAuthLoading(false);
    };

    fetchUserInfo();
  }, []);

  // Listen for auth changes
  React.useEffect(() => {
    const handleAuthChange = () => {
      const info = getUserInfo();
      console.log("[MainPage] Auth change, getUserInfo:", info);
      setCachedUserInfo(info);
    };

    window.addEventListener("storage", handleAuthChange);
    window.addEventListener("popstate", handleAuthChange);
    window.addEventListener("hashchange", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
      window.removeEventListener("popstate", handleAuthChange);
      window.removeEventListener("hashchange", handleAuthChange);
    };
  }, []);

  // Helper functions sử dụng hàm thống nhất
  const isNhanVien = () => {
    return checkIsNhanVien(cachedUserInfo);
  };

  const isAdmin = () => {
    return checkIsAdmin(cachedUserInfo);
  };

  // Legacy helper
  const parseJwt = (): any | null => {
    return cachedUserInfo;
  };

  // Helper to check admin access - returns true if should show loading
  const shouldShowAdminLoading = (): boolean => {
    const hasToken = !!localStorage.getItem("hs_token");
    const hasUserInfo = !!localStorage.getItem("hs_userInfo");
    // Show loading only if has token but no userInfo yet
    return hasToken && !hasUserInfo && authLoading;
  };

  // Helper to check admin access with loading state
  const checkAdminAccess = (): "loading" | "allowed" | "denied" => {
    if (shouldShowAdminLoading()) return "loading";
    if (isNhanVien()) return "allowed";
    return "denied";
  };

  const redirectToNoAccess = () => {
    try {
      window.history.replaceState(null, "", "/no-access");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch {
      window.location.href = "/no-access";
    }
  };
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

  // Function to refresh userInfo from localStorage using getUserInfo
  const refreshUserInfoFromStorage = () => {
    const info = getUserInfo();
    console.log("[MainPage] Refreshing userInfo:", info);
    if (info) {
      setCachedUserInfo(info);
      setAuthLoading(false);
    } else {
      const token = localStorage.getItem("hs_token");
      if (!token) {
        setCachedUserInfo(null);
        setAuthLoading(false);
      }
    }
  };

  React.useEffect(() => {
    const onLocationChange = () => {
      setRoute(resolveRoute());
      refreshUserInfoFromStorage();
    };
    window.addEventListener("hashchange", onLocationChange);
    window.addEventListener("popstate", onLocationChange);
    window.addEventListener("storage", refreshUserInfoFromStorage);
    return () => {
      window.removeEventListener("hashchange", onLocationChange);
      window.removeEventListener("popstate", onLocationChange);
      window.removeEventListener("storage", refreshUserInfoFromStorage);
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

  if (route === "#forgot-password" || route === "/forgot-password") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <LoginPage />
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

  if (route === "#AboutUsPage" || route === "/AboutUsPage") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <AboutUsPage />
        <FooterSection />
      </>
    );
  }

  if (route === "#contact" || route === "/contact") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <ContactPage />
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

  if (route === "#bookings" || route === "/bookings") {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <MyBookingsPage />
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
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return (
      <AdminLayout>
        <AdminDashboard />
      </AdminLayout>
    );
  }

  // Admin room manager route (accessible at /admin/rooms or #admin/rooms)
  if (
    route === "#admin/rooms" ||
    route === "/admin/rooms" ||
    route === "#/admin/rooms"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return (
      <AdminLayout>
        <RoomManager />
      </AdminLayout>
    );
  }

  // Admin amenities page route (accessible at /admin/amenities or #admin/amenities)
  if (
    route === "#admin/amenities" ||
    route === "/admin/amenities" ||
    route === "#/admin/amenities"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <AmenticsManager />;
  }

  // Admin services page route (accessible at /admin/services or #admin/services)
  if (
    route === "#admin/services" ||
    route === "/admin/services" ||
    route === "#/admin/services"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <ServiceManager />;
  }

  // Admin promotions page route (accessible at /admin/promotions or #admin/promotions)
  if (
    route === "#admin/promotions" ||
    route === "/admin/promotions" ||
    route === "#/admin/promotions"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return (
      <AdminLayout>
        <PromotionManager />
      </AdminLayout>
    );
  }

  // Admin bookings page route (accessible at /admin/bookings or #admin/bookings)
  if (
    route === "#admin/bookings" ||
    route === "/admin/bookings" ||
    route === "#/admin/bookings"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return (
      <AdminLayout>
        <BookingManager />
      </AdminLayout>
    );
  }

  // Admin invoices page route (accessible at /admin/invoices or #admin/invoices)
  if (
    route === "#admin/invoices" ||
    route === "/admin/invoices" ||
    route === "#/admin/invoices"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <InvoicesManager />;
  }

  // Admin checkout management (accessible at /admin/checkout)
  if (
    route === "#admin/checkout" ||
    route === "/admin/checkout" ||
    route === "#/admin/checkout"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <CheckoutManager />;
  }

  // Admin check-in management (accessible at /admin/checkin)
  if (
    route === "#admin/checkin" ||
    route === "/admin/checkin" ||
    route === "#/admin/checkin"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <CheckInManager />;
  }

  if (
    route === "#admin/review" ||
    route === "/admin/review" ||
    route === "#/admin/review"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <ReviewManager />;
  }

  // Blog detail route (internal blog pages)
  if (
    route.startsWith("/blog/") ||
    route.startsWith("#/blog/") ||
    route.startsWith("#blog/")
  ) {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <BlogDetail />
        <FooterSection />
      </>
    );
  }

  // Review page route (for customers to submit reviews after checkout)
  if (
    route.startsWith("/review/") ||
    route.startsWith("#/review/") ||
    route.startsWith("#review/")
  ) {
    return (
      <>
        <OffcanvasMenu />
        <HeaderSection />
        <ReviewPage />
        <FooterSection />
      </>
    );
  }

  // Admin loyalty / points management route (accessible at /admin/loyalty or #admin/loyalty)
  if (
    route === "#admin/loyalty" ||
    route === "/admin/loyalty" ||
    route === "#/admin/loyalty"
  ) {
    if (shouldShowAdminLoading()) {
      return (
        <div style={{ padding: 50, textAlign: "center" }}>Đang tải...</div>
      );
    }
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <LoyaltyManager />;
  }

  // No-access page
  if (route === "#no-access" || route === "/no-access") {
    return <NoAccessPage />;
  }

  if (
    route === "#admin/blog" ||
    route === "/admin/blog" ||
    route === "#/admin/blog"
  ) {
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <BlogManager />;
  }

  if (
    route === "#admin/blog/create" ||
    route === "/admin/blog/create" ||
    route === "#/admin/blog/create"
  ) {
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <BlogCreate />;
  }

  // Blog edit route
  if (
    route.startsWith("#admin/blog/edit/") ||
    route.startsWith("/admin/blog/edit/") ||
    route.startsWith("#/admin/blog/edit/")
  ) {
    if (!isNhanVien()) {
      redirectToNoAccess();
      return null;
    }
    return <BlogEdit />;
  }

  // Quản lý nhân viên - chỉ dành cho Admin (role = 2)
  if (
    route === "#admin/nhanvien" ||
    route === "/admin/nhanvien" ||
    route === "#/admin/nhanvien"
  ) {
    // Kiểm tra quyền admin
    const isAdmin = () => {
      try {
        const userInfo = localStorage.getItem("hs_userInfo");
        if (userInfo) {
          const parsed = JSON.parse(userInfo);
          return parsed.role === 2 || parsed.vaiTro === 2;
        }
      } catch (e) {}
      return false;
    };

    if (!isAdmin()) {
      redirectToNoAccess();
      return null;
    }
    return (
      <AdminLayout>
        <QuanLyNhanVienManager />
      </AdminLayout>
    );
  }

  // No-access page
  if (route === "#no-access" || route === "/no-access") {
    return <NoAccessPage />;
  }

  return (
    <>
      <OffcanvasMenu />
      <HeaderSection />

      <HeroSection />
      <AboutUsSection />
      <PromotionSection />

      <HomeRoom />
      <Services />
      {/* <Testimonial /> */}
      <BlogSection />
      <FooterSection />
    </>
  );
};

export default MainPage;
