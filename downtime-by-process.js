// downtime-by-process.js
const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon');
const { MEXICO_CITY_TIMEZONE, EIGHT_AM_HOUR } = require('./utils/time'); // Ensure path is correct

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    const line = req.query.line;
    const fromDateStr = req.query.from;
    const toDateStr = req.query.to;

    if (!line) {
        return res.status(400).json({ error: 'Line parameter is required.' });
    }

    try {
        let query = supabase
            .from('tickets')
            .select('process, downtime_minutes')
            .eq('line', line)
            .eq('status', 'Closed'); // Only consider closed tickets for downtime

        if (fromDateStr) {
            const fromDt = DateTime.fromISO(fromDateStr, { zone: MEXICO_CITY_TIMEZONE }).set({ hour: EIGHT_AM_HOUR, minute: 0, second: 0, millisecond: 0 });
            query = query.gte('resolved_at', fromDt.toISO());
        }
        if (toDateStr) {
            const toDt = DateTime.fromISO(toDateStr, { zone: MEXICO_CITY_TIMEZONE }).set({ hour: EIGHT_AM_HOUR, minute: 0, second: 0, millisecond: 0 }).plus({ days: 1 }).minus({ milliseconds: 1 });
            query = query.lt('resolved_at', toDt.toISO());
        }

        const { data, error } = await query;
        if (error) throw error;

        // Aggregate by process
        const aggregatedData = data.reduce((acc, curr) => {
            const processName = curr.process || 'Unknown Process'; // Handle cases with no process
            acc[processName] = (acc[processName] || 0) + (curr.downtime_minutes || 0);
            return acc;
        }, {});

        // Convert to array of objects
        const result = Object.entries(aggregatedData).map(([process, downtime]) => ({
            process: process,
            downtime: downtime
        })).sort((a, b) => b.downtime - a.downtime); // Sort by downtime descending

        res.status(200).json(result);

    } catch (error) {
        console.error('Error fetching downtime by process:', error);
        res.status(500).json({ error: error.message });
    }
};