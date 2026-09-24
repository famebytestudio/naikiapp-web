import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing/index.jsx'
import Feed from './pages/Ngo/Feed.jsx'
import ListingDetail from './pages/Ngo/ListingDetail.jsx'
import MyClaims from './pages/Ngo/MyClaims.jsx'
import ImpactDashboard from './pages/Dashboard/ImpactDashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/ngo" element={<Feed />} />
        <Route path="/ngo/claims" element={<MyClaims />} />
        <Route path="/ngo/listings/:id" element={<ListingDetail />} />
        <Route path="/dashboard" element={<ImpactDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
