#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dashboardDistPath = join(__dirname, '../dist/index.html')
const coreAssetsPath = join(__dirname, '../../core/src/templates/assets.ts')

try {
  // Read the built index.html to extract asset file names
  const indexHtml = readFileSync(dashboardDistPath, 'utf-8')
  
  // Extract CSS and JS file names using regex
  const cssMatch = indexHtml.match(/href="\/assets\/(index-[^"]+\.css)"/)
  const jsMatch = indexHtml.match(/src="\/assets\/(index-[^"]+\.js)"/)
  
  if (!cssMatch || !jsMatch) {
    console.error('Could not find asset file names in built index.html')
    process.exit(1)
  }
  
  const cssFile = cssMatch[1]
  const jsFile = jsMatch[1]
  
  console.log('Found asset files:')
  console.log('  CSS:', cssFile)
  console.log('  JS:', jsFile)
  
  // Create/update the assets file for templates
  const assetsContent = `// Auto-generated asset file names
export const CURRENT_ASSETS = {
  js: '${jsFile}',
  css: '${cssFile}'
}
`
  writeFileSync(coreAssetsPath, assetsContent)
  
  console.log('✅ Updated core/src/templates/assets.ts with asset references')
  
} catch (error) {
  console.error('❌ Failed to update asset file names:', error.message)
  process.exit(1)
}