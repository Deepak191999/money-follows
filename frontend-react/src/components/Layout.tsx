import { Outlet } from 'react-router'
import NavBar from './NavBar'
import FeatureBanner from './FeatureBanner'

export default function Layout() {
  return (
    <>
      <NavBar />
      <main className="container">
        <FeatureBanner />
        <Outlet />
      </main>
    </>
  )
}
