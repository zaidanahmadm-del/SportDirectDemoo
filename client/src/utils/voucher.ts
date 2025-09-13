/**
 * Generate a unique voucher code
 * Format: SD-{8-char uppercase base36}
 * Deterministic per user per day if email provided
 */
export function generateVoucherCode(email?: string): string {
  const prefix = 'SD-';
  
  if (email) {
    // Create deterministic code based on email + current date
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const input = email + today;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to base36 and pad/truncate to 8 characters
    const code = Math.abs(hash).toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
    return prefix + code;
  } else {
    // Random code if no email
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + code;
  }
}
