import { render } from 'preact'
import { App } from './app'
import './styles/index.css'

const appElement = document.getElementById('app')
if (!appElement) {
  throw new Error('App container not found')
}
render(<App />, appElement)
