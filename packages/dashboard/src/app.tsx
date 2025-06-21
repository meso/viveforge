import { Router, Route } from 'preact-router'
import { Layout } from './components/Layout'
import { HomePage } from './pages/Home'
import { DatabasePage } from './pages/Database'
import { StoragePage } from './pages/Storage'
import { AuthPage } from './pages/Auth'
import { SettingsPage } from './pages/Settings'
import { CustomSQL } from './pages/CustomSQL'

export function App() {
  return (
    <Layout>
      <Router>
        <Route path="/" component={HomePage} />
        <Route path="/database" component={DatabasePage} />
        <Route path="/custom-sql" component={CustomSQL} />
        <Route path="/storage" component={StoragePage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/settings" component={SettingsPage} />
      </Router>
    </Layout>
  )
}