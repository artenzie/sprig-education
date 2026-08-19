import { Navigate, Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { RequireAuth } from './RequireAuth'
import { RequireTeacher } from './RequireTeacher'
import { RequireHost } from './RequireHost'
import { PageLoading } from '../components/PageLoading'

// Lazy per route so each page's code loads only when a student actually
// navigates there, instead of the whole app shipping as one bundle upfront.
const Landing = lazy(() => import('../pages/Landing'))
const Login = lazy(() => import('../pages/Login'))
const SetPin = lazy(() => import('../pages/SetPin'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Topic = lazy(() => import('../pages/Topic'))
const Lesson = lazy(() => import('../pages/Lesson'))
const Library = lazy(() => import('../pages/Library'))
const Progress = lazy(() => import('../pages/Progress'))
const TestFlow = lazy(() => import('../pages/TestFlow'))
const Certificate = lazy(() => import('../pages/Certificate'))
const Help = lazy(() => import('../pages/Help'))
const TeacherStudents = lazy(() => import('../pages/TeacherStudents'))
const HostDashboard = lazy(() => import('../pages/HostDashboard'))

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Public. The landing page and the FAQ have to be readable by a
            teacher deciding whether to use Sprig at all. */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/help" element={<Help />} />

        {/* Signed in, but deliberately exempt from the must-change-PIN
            redirect — this is where that redirect sends people, so gating it
            the same way would loop forever. */}
        <Route element={<RequireAuth allowPinChange />}>
          <Route path="/set-pin" element={<SetPin />} />
        </Route>

        {/* Signed in and past the first-time PIN change. */}
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/topic/:topicId" element={<Topic />} />
          <Route path="/lesson" element={<Lesson />} />
          <Route path="/library" element={<Library />} />
          <Route path="/progress" element={<Progress />} />
          {/* One route for every test type, distinguished by ?type= — the flow
              differs only in which questions fill the pool, so progress checks
              will reuse this with an added topic filter rather than a new page. */}
          <Route path="/test" element={<TestFlow />} />
          <Route path="/certificate" element={<Certificate />} />
        </Route>

        {/* Signed in as a teacher. A separate guard rather than a flag on
            RequireAuth, because the two check opposite things: RequireAuth
            insists on a `students` row and a completed PIN change, neither of
            which a teacher has or ever will. */}
        <Route element={<RequireTeacher />}>
          <Route path="/teacher" element={<TeacherStudents />} />
        </Route>

        {/* Signed in as a teacher who is also a host. A third guard rather
            than a flag on RequireTeacher, for the same reason RequireTeacher
            isn't a flag on RequireAuth: the redirect a failed check should
            produce is different (a non-host teacher belongs on /teacher, not
            /login), and burying that in a boolean prop makes it easy to miss.

            Worth repeating what RequireHost's own header says, because this
            is the widest read access in the app: the guard is a courtesy. The
            RLS policies behind it are the boundary. */}
        <Route element={<RequireHost />}>
          <Route path="/host" element={<HostDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default AppRoutes
