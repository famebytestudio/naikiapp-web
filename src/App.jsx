import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Feed from './pages/Ngo/Feed.jsx'
import ListingDetail from './pages/Ngo/ListingDetail.jsx'
import MyClaims from './pages/Ngo/MyClaims.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ngo" element={<Feed />} />
        <Route path="/ngo/claims" element={<MyClaims />} />
        <Route path="/ngo/listings/:id" element={<ListingDetail />} />
        <Route path="*" element={<Navigate to="/ngo" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
