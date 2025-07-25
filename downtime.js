const { createClient } = require('@supabase/supabase-js');
const { getDailyTimeRange } = require('./utils/time');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    try {
        // Get the current 8 AM to 8 AM time window
        const { startOfDay, endOfDay } = getDailyTimeRange();

        // Get all tickets CREATED within the time window
        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('line, status, downtime_minutes')
            .gte('created_at', startOfDay.toISO())
            .lt('created_at', endOfDay.toISO());

        if (error) throw error;

        // Aggregate the data in JavaScript
        const aggregation = {};

        for (const ticket of tickets) {
            // Initialize the line if it's the first time we see it
            if (!aggregation[ticket.line]) {
                aggregation[ticket.line] = { tickets_generated: 0, downtime: 0 };
            }

            // Increment the count of generated tickets
            aggregation[ticket.line].tickets_generated += 1;

            // If this ticket is also "Closed", add its downtime to the sum
            if (ticket.status === 'Closed') {
                aggregation[ticket.line].downtime += ticket.downtime_minutes || 0;
            }
        }

        // Convert the aggregated object into the final array format
        const result = Object.entries(aggregation).map(([line, data]) => ({
            line: line,
            tickets_generated: data.tickets_generated,
            downtime: data.downtime
        }));

        res.status(200).json(result);

    } catch (error) {
        console.error('Error fetching downtime data:', error);
        res.status(500).json({ error: error.message });
    }
};