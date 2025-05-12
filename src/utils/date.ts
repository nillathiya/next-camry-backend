export function getCurrentDate(): string {
    return new Date().toISOString().split('T')[0]; // e.g., "2025-03-13"
  }
  
  export default { getCurrentDate };