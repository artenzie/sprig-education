import { Navigate, Routes, Route } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import Landing from '../pages/Landing'
import Login from '../pages/Login'
import SetPin from '../pages/SetPin'
import Dashboard from '../pages/Dashboard'
import Topic from '../pages/Topic'
import Lesson from '../pages/Lesson'
import Library from '../pages/Library'
import Progress from '../pages/Progress'
import Certificate from '../pages/Certificate'
import Help from '../pages/Help'

function AppRoutes() {
  return (
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
        <Route path="/certificate" element={<Certificate />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default AppRoutes
