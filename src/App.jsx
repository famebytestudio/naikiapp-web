import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Feed from './pages/Ngo/Feed.jsx'
import ListingDetail from './pages/Ngo/ListingDetail.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/ngo" element={<Feed />} />
        <Route path="/ngo/listings/:id" element={<ListingDetail />} />
        <Route path="*" element={<Navigate to="/ngo" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
