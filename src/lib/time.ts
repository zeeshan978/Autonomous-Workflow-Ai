import { formatDistanceToNowStrict } from 'date-fns';

/**
 * Safely formats a date to a relative time string (e.g., "3 minutes ago").
 * Handles Supabase UTC timestamps properly by appending 'Z' if missing timezone info.
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return 'unknown time';
  
  try {
    let d = new Date(dateString);
    
    // If string and doesn't contain timezone info, assume UTC
    if (typeof dateString === 'string' && dateString.includes('T') && !dateString.endsWith('Z') && !dateString.includes('+')) {
       d = new Date(`${dateString}Z`);
    }

    if (isNaN(d.getTime())) return 'unknown time';
    
    return formatDistanceToNowStrict(d, { addSuffix: true });
  } catch {
    return 'unknown time';
  }
}
