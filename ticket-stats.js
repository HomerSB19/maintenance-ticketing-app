import { createClient } from '@supabase/supabase-js';
import { DateTime } from 'luxon';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const timezone = req.query.timezone || 'America/Mexico_City';
    const now = DateTime.now().setZone(timezone);

    // Today's period (8 AM to 8 AM)
    let todayStart, todayEnd;
    if (now.hour < 8) {
        todayStart = now.minus({ days: 1 }).set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
        todayEnd = now.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    } else {
        todayStart = now.set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
        todayEnd = now.plus({ days: 1 }).set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    }

    // Week's period (Monday 8 AM to current)
    let weekStart = now.startOf('week').set({ hour: 8, minute: 0, second: 0, millisecond: 0 });
    if (now.hour < 8) {
        weekStart = weekStart.minus({ days: 7 });
    }

    // Convert to UTC
    const todayStartUTC = todayStart.toUTC().toISO();
    const todayEndUTC = todayEnd.toUTC().toISO();
    const weekStartUTC = weekStart.toUTC().toISO();

    // Count today
    const { count: today, error: todayError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStartUTC)
      .lt('created_at', todayEndUTC);

    if (todayError) throw new Error(todayError.message);

    // Count week
    const { count: week, error: weekError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStartUTC);

    if (weekError) throw new Error(weekError.message);

    return res.status(200).json({ today: today || 0, week: week || 0 });
  } catch (error) {
    console.error('ticket-stats API error:', error);
    return res.status(500).json({ error: `Internal server error: ${error.message}` });
  }
}