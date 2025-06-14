#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dashboardDistPath = join(__dirname, '../dist/index.html')
const coreIndexPath = join(__dirname, '../../core/src/index.ts')

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
  
  // Read the core index.ts file
  let coreIndexContent = readFileSync(coreIndexPath, 'utf-8')
  
  // Update the asset references using regex replacement
  coreIndexContent = coreIndexContent.replace(
    /src="\/assets\/index-[^"]+\.js"/,
    `src="/assets/${jsFile}"`
  )
  
  coreIndexContent = coreIndexContent.replace(
    /href="\/assets\/index-[^"]+\.css"/,
    `href="/assets/${cssFile}"`
  )
  
  // Write the updated content back
  writeFileSync(coreIndexPath, coreIndexContent)
  
  console.log('✅ Updated core/src/index.ts with new asset file names')
  
} catch (error) {
  console.error('❌ Failed to update asset file names:', error.message)
  process.exit(1)
}