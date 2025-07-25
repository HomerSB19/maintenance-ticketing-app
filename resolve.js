const { createClient } = require('@supabase/supabase-js');
const { DateTime } = require('luxon'); // Already used by time.js, but good to explicitly include if needed
const { getCurrentMexicoCityTime, MEXICO_CITY_TIMEZONE } = require('./utils/time'); // Import the new utility

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    const ticketId = req.params.ticketId;
    const { issue, fix } = req.body; // status, resolved_by are derived or set by the backend

    if (!issue || !fix) {
        return res.status(400).json({ error: 'Issue and Fix descriptions are required.' });
    }

    try {
        // First, fetch the ticket to get created_at and assigned_to
        const { data: ticket, error: fetchError } = await supabase
            .from('tickets')
            .select('created_at, assigned_at, assigned_to, status')
            .eq('ticket_id', ticketId)
            .single();

        if (fetchError) throw fetchError;
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found.' });
        }
        if (ticket.status !== 'Ongoing') {
            return res.status(400).json({ error: 'Ticket is not in "Ongoing" status.' });
        }

        const resolved_at = getCurrentMexicoCityTime();
        let downtime_minutes = 0;

        if (ticket.created_at) {
            // Parse created_at string into a Luxon DateTime object, assuming it's an ISO string in Mexico City TZ
            const created_dt = DateTime.fromISO(ticket.created_at, { zone: MEXICO_CITY_TIMEZONE });

            if (created_dt.isValid && resolved_at.isValid) {
                const diff = resolved_at.diff(created_dt, 'minutes').toObject();
                downtime_minutes = Math.max(0, Math.round(diff.minutes || 0)); // Ensure non-negative and round
            } else {
                console.warn(`Invalid date for downtime calculation for ticket ${ticketId}: created_at=${ticket.created_at}, resolved_at=${resolved_at.toISO()}`);
            }
        }

        const resolved_by = ticket.assigned_to || 'Unknown'; // Use assigned_to if available, otherwise 'Unknown'

        const { data, error } = await supabase
            .from('tickets')
            .update({
                issue: issue,
                fix: fix,
                status: 'Closed',
                resolved_by: resolved_by,
                resolved_at: resolved_at.toISO(), // Store as ISO string
                downtime_minutes: downtime_minutes
            })
            .eq('ticket_id', ticketId)
            .in('status', ['Ongoing']) // Only allow resolution if status is 'Ongoing'
            .select(); // Select the updated row to check if anything was updated

        if (error) throw error;

        if (data && data.length > 0) {
            res.status(200).json({ message: 'Ticket resolved successfully.', ticket: data[0] });
        } else {
            res.status(404).json({ error: 'Ticket not found or not in "Ongoing" status.' });
        }
    } catch (error) {
        console.error('Error resolving ticket:', error);
        res.status(500).json({ error: error.message });
    }
};