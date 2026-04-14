import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import VoiceSearchScreen from './screens/VoiceSearchScreen'
import MapViewScreen from './screens/MapViewScreen'
import ListViewScreen from './screens/ListViewScreen'
import MenuPage from './screens/MenuPage'
import VibeMatchScreen from './screens/VibeMatchScreen'
import ConciergeScreen from './screens/ConciergeScreen'
import EventsScreen from './screens/EventsScreen'
import SurpriseMeScreen from './screens/SurpriseMeScreen'
import SeedPage from './screens/SeedPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/voice" element={<VoiceSearchScreen />} />
        <Route path="/map" element={<MapViewScreen />} />
        <Route path="/list" element={<ListViewScreen />} />
        <Route path="/menu/:id" element={<MenuPage />} />
        <Route path="/vibe" element={<VibeMatchScreen />} />
        <Route path="/concierge" element={<ConciergeScreen />} />
        <Route path="/events" element={<EventsScreen />} />
        <Route path="/tonight" element={<EventsScreen />} />
        <Route path="/surprise" element={<SurpriseMeScreen />} />
        <Route path="/seed" element={<SeedPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
