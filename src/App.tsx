import { Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import DashboardPage from '@/pages/DashboardPage'
import TranslatorPage from '@/pages/TranslatorPage'
import ArticlesPage from '@/pages/ArticlesPage'
import GlossaryPage from '@/pages/GlossaryPage'
import SettingsPage from '@/pages/SettingsPage'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/translator" element={<TranslatorPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/glossary" element={<GlossaryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
