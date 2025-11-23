import React, { ReactNode } from "react";
import Slidebar from "./Slidebar";
import HeaderSection from "./HeaderSection";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Slidebar />
      <div style={{ marginLeft: 240 }}>
        <HeaderSection showStats={false} />
        <main style={{ padding: "0px 60px" }}>{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
