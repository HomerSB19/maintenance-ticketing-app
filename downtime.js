import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get timezone from query, default to America/Mexico_City
    const timezone = req.query.timezone || 'America/Mexico_City';

    // Get current time in the specified timezone
    const now = DateTime.now().setZone(timezone);
    let start, end;

    if (now.hour < 8) {
      // Before 8 AM: Use previous day's 8 AM to current day's 8 AM
      start = now.minus({ days: 1 }).set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
      end = now.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    } else {
      // After 8 AM: Use current day's 8 AM to next day's 8 AM
      start = now.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
      end = now.plus({ days: 1 }).set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    }

    // Convert to UTC for Supabase query
    const startUTC = start.toUTC().toISO();
    const endUTC = end.toUTC().toISO();

    // Query tickets closed in the period
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('line, created_at, resolved_at')
      .eq('status', 'Closed')
      .gte('resolved_at', startUTC)
      .lt('resolved_at', endUTC);

    if (error) {
      console.error('Supabase query error:', error);
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Initialize result for all lines
    const lines = ['MRR', 'FCM', 'IDB', 'MGH', 'PPK', 'IAMM'];
    const result = lines.map(line => ({
      line,
      tickets_closed: 0,
      downtime: 0
    }));

    // Process tickets
    tickets.forEach(ticket => {
      const lineIndex = result.findIndex(item => item.line === ticket.line);
      if (lineIndex !== -1) {
        // Increment tickets_closed
        result[lineIndex].tickets_closed += 1;

        // Calculate downtime (resolved_at - created_at in minutes)
        const createdAt = DateTime.fromISO(ticket.created_at, { zone: 'utc' });
        const resolvedAt = DateTime.fromISO(ticket.resolved_at, { zone: 'utc' });
        const downtimeMinutes = resolvedAt.diff(createdAt, 'minutes').minutes;

        // Ensure non-negative downtime
        if (downtimeMinutes >= 0) {
          result[lineIndex].downtime += Math.round(downtimeMinutes);
        } else {
          console.warn(`Negative downtime detected for ticket ${ticket.ticket_id} on line ${ticket.line}: ${downtimeMinutes} minutes`);
        }
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
}