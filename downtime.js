// downtime.js
const { createClient } = require('@supabase/supabase-js');
const { getDailyTimeRange } = require('./utils/time'); // Import the new utility

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    try {
        // Determine the start and end of the current 8 AM to 8 AM period
        const { startOfDay, endOfDay } = getDailyTimeRange();

        // Fetch all unique lines
        const { data: linesData, error: linesError } = await supabase
            .from('tickets')
            .select('line', { distinct: true });

        if (linesError) throw linesError;

        const lines = linesData.map(row => row.line);
        const downtimeData = [];

        for (const line of lines) {
            // Get total downtime for resolved tickets for this line within the period
            const { data: downtimeResult, error: downtimeError } = await supabase
                .from('tickets')
                .select('downtime_minutes')
                .eq('line', line)
                .eq('status', 'Closed')
                .gte('resolved_at', startOfDay.toISO())
                .lt('resolved_at', endOfDay.toISO());

            if (downtimeError) throw downtimeError;

            const totalDowntime = downtimeResult.reduce((sum, ticket) => sum + (ticket.downtime_minutes || 0), 0);

            // Get tickets generated for this line within the period
            const { count: ticketsGenerated, error: ticketsGeneratedError } = await supabase
                .from('tickets')
                .select('*', { count: 'exact', head: true })
                .eq('line', line)
                .gte('created_at', startOfDay.toISO())
                .lt('created_at', endOfDay.toISO());

            if (ticketsGeneratedError) throw ticketsGeneratedError;

            downtimeData.push({
                line: line,
                tickets_generated: ticketsGenerated,
                downtime: totalDowntime
            });
        }

        res.status(200).json(downtimeData);
    } catch (error) {
        console.error('Error fetching downtime data:', error);
        res.status(500).json({ error: error.message });
    }
};