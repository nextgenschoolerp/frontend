import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

// Dev proxy: the browser talks to the Vite origin, so the backend services need no CORS setup.
// Targets can be set in the active mode's .env file or overridden by the shell environment.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // authservice is served under the /authservice context path; the proxy prepends it to /api/... requests
  const auth = env.AUTH_SERVICE_URL || 'http://localhost:8082/authservice';
  // admissionservice is served under the /admissionservice context path
  const admission = env.ADMISSION_SERVICE_URL || 'http://localhost:8083/admissionservice';
  // studentservice (Module 03) is served under the /studentservice context path
  const student = env.STUDENT_SERVICE_URL || 'http://localhost:8084/studentservice';
  // financeservice (Module 04) is served under the /financeservice context path
  const finance = env.FINANCE_SERVICE_URL || 'http://localhost:8085/financeservice';
  // examservice (Module 05) is served under the /examservice context path
  const exams = env.EXAM_SERVICE_URL || 'http://localhost:8086/examservice';
  // academicservice (Module 06, timetables & LMS) is served under the /academicservice context path.
  // Its prefix is /api/v1/lms: /api/v1/academic (studentservice) would also match /api/v1/academics…
  const academic = env.ACADEMIC_SERVICE_URL || 'http://localhost:8087/academicservice';
  // hrservice (Module 07, staff HR, attendance & payroll) is served under the /hrservice context path
  const hr = env.HR_SERVICE_URL || 'http://localhost:8088/hrservice';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/v1/admissions': { target: admission, changeOrigin: true },
        '/api/v1/students': { target: student, changeOrigin: true },
        '/api/v1/academic': { target: student, changeOrigin: true },
        '/api/v1/alumni': { target: student, changeOrigin: true },
        '/api/v1/attendance': { target: student, changeOrigin: true },
        '/api/v1/finance': { target: finance, changeOrigin: true },
        '/api/v1/exams': { target: exams, changeOrigin: true },
        '/api/v1/lms': { target: academic, changeOrigin: true },
        '/api/v1/hr': { target: hr, changeOrigin: true },
        '/api': { target: auth, changeOrigin: true },
      },
    },
  };
});
