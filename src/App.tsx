import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomeScreen from './screens/HomeScreen'
import VoiceSearchScreen from './screens/VoiceSearchScreen'
import MapViewScreen from './screens/MapViewScreen'
import ListViewScreen from './screens/ListViewScreen'
import MenuPage from './screens/MenuPage'
import VibeMatchScreen from './screens/VibeMatchScreen'

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
      </Routes>
    </BrowserRouter>
  )
}

export default App
