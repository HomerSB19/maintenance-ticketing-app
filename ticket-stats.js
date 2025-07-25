// ticket-stats.js
const { createClient } = require('@supabase/supabase-js');
const { getDailyTimeRange, getWeeklyTimeRange } = require('./utils/time'); // Import the new utility

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get daily range (8 AM to 8 AM)
    const { startOfDay, endOfDay } = getDailyTimeRange();

    // Get weekly range (Monday 8 AM to Monday 8 AM)
    const { startOfWeek, endOfWeek } = getWeeklyTimeRange();

    // Fetch tickets generated "today" (8 AM to 8 AM)
    const { count: ticketsToday, error: errorToday } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay.toISO())
      .lt('created_at', endOfDay.toISO());

    if (errorToday) throw errorToday;

    // Fetch tickets generated "this week" (Monday 8 AM to Monday 8 AM)
    const { count: ticketsWeek, error: errorWeek } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfWeek.toISO())
      .lt('created_at', endOfWeek.toISO());

    if (errorWeek) throw errorWeek;

    res.status(200).json({
      today: ticketsToday,
      week: ticketsWeek,
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ error: error.message });
  }
}