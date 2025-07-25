const { createClient } = require('@supabase/supabase-js');
const { getCurrentMexicoCityTime } = require('./utils/time'); // Import the new utility

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    const ticketId = req.params.ticketId;
    const { assigned_to } = req.body; // Only assigned_to is needed for assignment

    if (!assigned_to) {
        return res.status(400).json({ error: 'Technician name is required.' });
    }

    try {
        const assigned_at = getCurrentMexicoCityTime().toISO(); // Get current Mexico City time

        const { data, error } = await supabase
            .from('tickets')
            .update({ assigned_to: assigned_to, status: 'Ongoing', assigned_at: assigned_at })
            .eq('ticket_id', ticketId)
            .in('status', ['Open']) // Only allow assignment if status is 'Open'
            .select(); // Select the updated row to check if anything was updated

        if (error) throw error;

        if (data && data.length > 0) {
            res.status(200).json({ message: 'Ticket assigned successfully.', ticket: data[0] });
        } else {
            res.status(404).json({ error: 'Ticket not found or already assigned/resolved.' });
        }
    } catch (error) {
        console.error('Error assigning ticket:', error);
        res.status(500).json({ error: error.message });
    }
};