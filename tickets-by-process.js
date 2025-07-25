// tickets-by-process.js
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
            .select('process', { count: 'exact' }) // Select process and count them
            .eq('line', line);

        if (fromDateStr) {
            const fromDt = DateTime.fromISO(fromDateStr, { zone: MEXICO_CITY_TIMEZONE }).set({ hour: EIGHT_AM_HOUR, minute: 0, second: 0, millisecond: 0 });
            query = query.gte('created_at', fromDt.toISO());
        }
        if (toDateStr) {
            const toDt = DateTime.fromISO(toDateStr, { zone: MEXICO_CITY_TIMEZONE }).set({ hour: EIGHT_AM_HOUR, minute: 0, second: 0, millisecond: 0 }).plus({ days: 1 }).minus({ milliseconds: 1 });
            query = query.lt('created_at', toDt.toISO());
        }

        const { data, error } = await query;
        if (error) throw error;

        // Aggregate by process
        const aggregatedData = data.reduce((acc, curr) => {
            const processName = curr.process || 'Unknown Process';
            acc[processName] = (acc[processName] || 0) + 1;
            return acc;
        }, {});

        // Convert to array of objects
        const result = Object.entries(aggregatedData).map(([process, count]) => ({
            process: process,
            count: count
        })).sort((a, b) => b.count - a.count); // Sort by count descending

        res.status(200).json(result);

    } catch (error) {
        console.error('Error fetching tickets by process:', error);
        res.status(500).json({ error: error.message });
    }
};