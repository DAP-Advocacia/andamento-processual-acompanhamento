// HashRouter em vez de BrowserRouter: o app roda embutido em iframe no Bitrix24,
// que carrega a URL do handler via POST e com query string própria (DOMAIN,
// APP_SID etc.). Rotas no hash não exigem fallback de SPA no servidor e não
// mexem no path/query que o SDK BX24 lê.
import { Navigate, Route, HashRouter as Router, Routes } from 'react-router-dom'
import { ChangelogsPage } from './pages/ChangelogsPage'
import { DashboardPage } from './pages/DashboardPage'
import { InstallationPage } from './pages/InstallationPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/changelogs" element={<ChangelogsPage />} />
        <Route path="/install" element={<InstallationPage />} />
      </Routes>
    </Router>
  )
}


export default App
