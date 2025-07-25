const { createClient } = require('@supabase/supabase-js');
const { getDailyTimeRange } = require('./utils/time');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    try {
        // Get the current 8 AM to 8 AM time window
        const { startOfDay, endOfDay } = getDailyTimeRange();

        // Query 1: Get all tickets created within the time window
        const { data: createdTickets, error: createdError } = await supabase
            .from('tickets')
            .select('line')
            .gte('created_at', startOfDay.toISO())
            .lt('created_at', endOfDay.toISO());

        if (createdError) throw createdError;

        // Query 2: Get all tickets closed within the time window to sum their downtime
        const { data: closedTickets, error: closedError } = await supabase
            .from('tickets')
            .select('line, downtime_minutes')
            .eq('status', 'Closed')
            .gte('resolved_at', startOfDay.toISO())
            .lt('resolved_at', endOfDay.toISO());

        if (closedError) throw closedError;

        // Aggregate the data in JavaScript
        const aggregation = {};

        // Count tickets generated per line
        for (const ticket of createdTickets) {
            if (!aggregation[ticket.line]) {
                aggregation[ticket.line] = { tickets_generated: 0, downtime: 0 };
            }
            aggregation[ticket.line].tickets_generated += 1;
        }

        // Sum the downtime per line
        for (const ticket of closedTickets) {
            if (!aggregation[ticket.line]) {
                aggregation[ticket.line] = { tickets_generated: 0, downtime: 0 };
            }
            aggregation[ticket.line].downtime += ticket.downtime_minutes || 0;
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