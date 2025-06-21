import { describe, it, expect } from 'vitest'

// Hash function to test - simple but effective approach
function generateSlugFromName(name: string): string {
  if (!name.trim()) {
    return Date.now().toString(36).slice(-8).padStart(8, '0')
  }

  // Create a seed based on the string content and length
  let seed = name.length + 1000 // Add offset to avoid small numbers
  
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i)
    seed = seed * 31 + char  // Classic polynomial rolling hash
    seed = seed & 0x7fffffff  // Keep positive
  }
  
  // Generate 8 characters using a simple PRNG approach
  let result = ''
  let rng = seed
  
  for (let i = 0; i < 8; i++) {
    // Linear congruential generator
    rng = (rng * 1664525 + 1013904223) & 0x7fffffff
    const digit = rng % 36
    result += digit.toString(36)
  }
  
  return result
}

describe('Slug Generator', () => {
  it('should generate different hashes for single characters', () => {
    const results = []
    for (let i = 0; i < 26; i++) {
      const char = String.fromCharCode(97 + i) // a-z
      const slug = generateSlugFromName(char)
      results.push({ input: char, output: slug })
      console.log(`"${char}" -> "${slug}"`)
    }
    
    // Check for uniqueness
    const uniqueSlugs = new Set(results.map(r => r.output))
    expect(uniqueSlugs.size).toBe(results.length)
    
    // Check that none start with "000"
    const badSlugs = results.filter(r => r.output.startsWith('000'))
    console.log('Bad slugs (starting with 000):', badSlugs)
    expect(badSlugs.length).toBe(0)
  })

  it('should generate well-distributed hashes', () => {
    const testInputs = [
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
      'test', 'hello', 'world', 'api', 'query',
      '私', '私の', '私のクエリ', 'データ', 'ユーザー',
      'My Query', 'User API', 'Data Fetch', 'Hello World'
    ]
    
    const results = testInputs.map(input => ({
      input,
      output: generateSlugFromName(input)
    }))
    
    console.log('\nAll test results:')
    results.forEach(r => console.log(`"${r.input}" -> "${r.output}"`))
    
    // Check for uniqueness
    const uniqueSlugs = new Set(results.map(r => r.output))
    expect(uniqueSlugs.size).toBe(results.length)
    
    // Check distribution of first characters
    const firstChars = results.map(r => r.output[0])
    const firstCharCounts = firstChars.reduce((acc, char) => {
      acc[char] = (acc[char] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log('\nFirst character distribution:', firstCharCounts)
    
    // No character should appear too frequently (max 30% of total)
    const maxCount = Math.ceil(results.length * 0.3)
    Object.values(firstCharCounts).forEach(count => {
      expect(count).toBeLessThanOrEqual(maxCount)
    })
  })

  it('should handle edge cases', () => {
    const edgeCases = ['', ' ', '1', '12', '123']
    
    edgeCases.forEach(input => {
      const slug = generateSlugFromName(input)
      expect(slug).toHaveLength(8)
      expect(/^[0-9a-z]+$/.test(slug)).toBe(true)
      console.log(`Edge case "${input}" -> "${slug}"`)
    })
  })
})