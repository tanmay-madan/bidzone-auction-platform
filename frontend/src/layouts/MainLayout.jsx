import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-8 mt-auto">
        <div className="mx-auto max-w-6xl px-6 text-sm text-slate flex items-center justify-between">
          <span>BidZone</span>
          <span>Full Stack Development Project</span>
        </div>
      </footer>
    </div>
  );
}
