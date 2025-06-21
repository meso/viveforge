import { Route, Router } from 'preact-router'
import { Layout } from './components/Layout'
import { AuthPage } from './pages/Auth'
import { CustomSQL } from './pages/CustomSQL'
import { DatabasePage } from './pages/Database'
import { HomePage } from './pages/Home'
import { SettingsPage } from './pages/Settings'
import { StoragePage } from './pages/Storage'

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
