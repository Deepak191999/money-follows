import { Navigate, Route, Routes } from 'react-router'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import HighlightsPage from './pages/HighlightsPage'
import GroupsPage from './pages/GroupsPage'
import GroupPage from './pages/GroupPage'
import MePage from './pages/MePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public: the invitee may not have an account yet. */}
      <Route path="/invite/:token" element={<AcceptInvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/highlights" element={<HighlightsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/groups" replace />} />
    </Routes>
  )
}
