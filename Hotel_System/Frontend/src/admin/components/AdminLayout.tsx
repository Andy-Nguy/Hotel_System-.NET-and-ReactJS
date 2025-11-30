import React, { ReactNode } from "react";
import Slidebar from "./Slidebar";
import HeaderSection from "./HeaderSection";
import "../styles/modalGlobal.css";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div
      className="admin-modal-fix"
      style={{ minHeight: "100vh", background: "#f8fafc" }}
    >
      <Slidebar />
      <div style={{ marginLeft: 280 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: "0px 60px" }}>{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
