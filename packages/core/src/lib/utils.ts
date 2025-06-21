export function generateId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substr(2, 9)
  return `${timestamp}-${randomPart}`
}