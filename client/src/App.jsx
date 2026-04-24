import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import CreateAccount from "./pages/CreateAccount";
import Messages from "./pages/Messages";
import RateMentor from "./pages/RateMentor";
import Complaints from "./pages/Complaints";
import ComplaintTicketDetail from "./pages/ComplaintTicketDetail";
import UserProfile from "./pages/UserProfile";
import Notifications from "./pages/Notifications";
import ReviewsAll from "./pages/ReviewsAll";
import Appeal from "./pages/Appeal";
import Analytics from "./pages/Analytics";
import CreditsCenter from "./pages/CreditsCenter";
import BkashDemoCheckout from "./pages/BkashDemoCheckout";
import GiftAccessPage from "./pages/GiftAccessPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminComplaints from "./pages/admin/AdminComplaints";
import AdminComplaintDetail from "./pages/admin/AdminComplaintDetail";
import AdminUserSearch from "./pages/admin/AdminUserSearch";
import AdminSuspended from "./pages/admin/AdminSuspended";
import AdminBanned from "./pages/admin/AdminBanned";
import AdminLowRatings from "./pages/admin/AdminLowRatings";
import AdminCoursePromotions from "./pages/admin/AdminCoursePromotions";
import CourseCatalogPage from "./pages/CourseCatalogPage";
import CoursePromoLanding from "./pages/CoursePromoLanding";
import CourseBkashDemoCheckout from "./pages/CourseBkashDemoCheckout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import OfferNotifications from "./components/OfferNotifications";

const App = () => {
  return (
    <>
      <OfferNotifications />
      <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/appeal" element={<Appeal />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/create-account"
        element={
          <ProtectedRoute>
            <CreateAccount />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/credits"
        element={
          <ProtectedRoute>
            <CreditsCenter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/credits/bkash-demo"
        element={
          <ProtectedRoute>
            <BkashDemoCheckout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/courses/promo/bkash-demo"
        element={
          <ProtectedRoute>
            <CourseBkashDemoCheckout />
          </ProtectedRoute>
        }
      />
      <Route path="/courses/promo/:id" element={<CoursePromoLanding />} />
      <Route
        path="/courses"
        element={
          <ProtectedRoute>
            <CourseCatalogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/access/:productKey"
        element={
          <ProtectedRoute>
            <GiftAccessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/complaints"
        element={
          <AdminRoute>
            <AdminComplaints />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/complaints/:id"
        element={
          <AdminRoute>
            <AdminComplaintDetail />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUserSearch />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/suspended"
        element={
          <AdminRoute>
            <AdminSuspended />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/banned"
        element={
          <AdminRoute>
            <AdminBanned />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/low-ratings"
        element={
          <AdminRoute>
            <AdminLowRatings />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/course-promotions"
        element={
          <AdminRoute>
            <AdminCoursePromotions />
          </AdminRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reviews/all-given"
        element={
          <ProtectedRoute>
            <ReviewsAll mode="given" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reviews/all-received"
        element={
          <ProtectedRoute>
            <ReviewsAll mode="received" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reviews"
        element={
          <ProtectedRoute>
            <RateMentor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints/ticket/:id"
        element={
          <ProtectedRoute>
            <ComplaintTicketDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints"
        element={
          <ProtectedRoute>
            <Complaints />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:userId"
        element={
          <ProtectedRoute>
            <UserProfile />
          </ProtectedRoute>
        }
      />
      <Route path="/feed" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  );
};

export default App;
