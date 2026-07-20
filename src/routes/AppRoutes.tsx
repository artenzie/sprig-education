import { Routes, Route } from 'react-router-dom'
import Landing from '../pages/Landing'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Lesson from '../pages/Lesson'
import Library from '../pages/Library'
import Progress from '../pages/Progress'
import Certificate from '../pages/Certificate'
import Help from '../pages/Help'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/lesson" element={<Lesson />} />
      <Route path="/library" element={<Library />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/certificate" element={<Certificate />} />
      <Route path="/help" element={<Help />} />
    </Routes>
  )
}

export default AppRoutes
