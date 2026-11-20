import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LiveProvider } from "./context/LiveContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import MainLayout from "./layouts/MainLayout";
import Home from "./pages/Home";
import Browse from "./pages/Browse";
import AuctionDetails from "./pages/AuctionDetails";
import CreateAuction from "./pages/CreateAuction";
import MyAuctions from "./pages/MyAuctions";
import MyBids from "./pages/MyBids";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* LiveProvider: one SSE connection for live bids, closings and notifications */}
        <LiveProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/browse" element={<Browse />} />
              <Route path="/auctions/:id" element={<AuctionDetails />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/create"
                element={
                  <ProtectedRoute>
                    <CreateAuction />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-auctions"
                element={
                  <ProtectedRoute>
                    <MyAuctions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bids"
                element={
                  <ProtectedRoute>
                    <MyBids />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </LiveProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
