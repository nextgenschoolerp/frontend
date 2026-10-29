import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import { Privacy, Terms } from './pages/Legal.jsx';
import Setup from './pages/Setup.jsx';
import { ForgotPassword, ResetPassword, ChangePassword } from './pages/PasswordPages.jsx';
import { RequireAuth } from './auth.jsx';
import Overview from './pages/Overview.jsx';
import { StudentsDirectory, StudentForm, StudentProfile } from './pages/Students.jsx';
import { StaffDirectory, StaffForm, StaffProfile } from './pages/Staff.jsx';
import AdmissionsWorkspace from './pages/Admissions.jsx';
import { Academics, Teaching, Attendance, Fees } from './pages/Operations.jsx';
import { Calendar, Communications, Reports, Documents, Settings, Help } from './pages/Admin.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="setup" element={<Setup />} />
      <Route path="login" element={<Login />} />
      <Route path="privacy" element={<Privacy />} />
      <Route path="terms" element={<Terms />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="change-password" element={<RequireAuth allowPasswordChange><ChangePassword /></RequireAuth>} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Overview />} />
        <Route path="students" element={<StudentsDirectory />} />
        <Route path="students/new" element={<StudentForm mode="add" />} />
        <Route path="students/:id" element={<StudentProfile />} />
        <Route path="students/:id/edit" element={<StudentForm mode="edit" />} />
        <Route path="admissions" element={<AdmissionsWorkspace />} />
        <Route path="staff" element={<StaffDirectory />} />
        <Route path="staff/new" element={<StaffForm />} />
        <Route path="staff/:id" element={<StaffProfile />} />
        <Route path="staff/:id/edit" element={<StaffForm />} />
        <Route path="academics" element={<Academics />} />
        <Route path="teaching" element={<Teaching />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="fees" element={<Fees />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="communications" element={<Communications />} />
        <Route path="reports" element={<Reports />} />
        <Route path="documents" element={<Documents />} />
        <Route path="settings" element={<Settings />} />
        <Route path="help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
