import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import { Spinner } from "@/components/ui";
import { useMe } from "@/lib/session";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Catalog from "@/pages/Catalog";
import CourseDetail from "@/pages/CourseDetail";
import MyLearning from "@/pages/MyLearning";
import Learn from "@/pages/Learn";
import TrackRecord from "@/pages/TrackRecord";
import Certificates from "@/pages/Certificates";
import CertificateView from "@/pages/CertificateView";
import Rooms from "@/pages/Rooms";
import RoomDetail from "@/pages/RoomDetail";
import Team from "@/pages/Team";
import MemberDetail from "@/pages/MemberDetail";
import AdminCourses from "@/pages/AdminCourses";
import AdminCourseEdit from "@/pages/AdminCourseEdit";
import AdminUsers from "@/pages/AdminUsers";

function Protected({ roles, children }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <Spinner />;
  if (!me) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/sertifikat/:id/cetak" element={<Protected><CertificateView /></Protected>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="katalog" element={<Catalog />} />
        <Route path="katalog/:id" element={<CourseDetail />} />
        <Route path="pelatihan" element={<Protected roles={["counselee", "counselor"]}><MyLearning /></Protected>} />
        <Route path="belajar/:id" element={<Learn />} />
        <Route path="track-record" element={<Protected roles={["counselee", "counselor"]}><TrackRecord /></Protected>} />
        <Route path="sertifikat" element={<Protected roles={["counselee", "counselor"]}><Certificates /></Protected>} />
        <Route path="kelas" element={<Rooms />} />
        <Route path="kelas/:id" element={<RoomDetail />} />
        <Route path="tim" element={<Protected roles={["counselor", "admin"]}><Team /></Protected>} />
        <Route path="tim/:id" element={<Protected roles={["counselor", "admin"]}><MemberDetail /></Protected>} />
        <Route path="admin/course" element={<Protected roles={["admin"]}><AdminCourses /></Protected>} />
        <Route path="admin/course/:id" element={<Protected roles={["admin"]}><AdminCourseEdit /></Protected>} />
        <Route path="admin/pengguna" element={<Protected roles={["admin"]}><AdminUsers /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
