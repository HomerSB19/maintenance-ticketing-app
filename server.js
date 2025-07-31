const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { getCurrentMexicoCityTime } = require('./utils/time');
    
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
    
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('Supabase initialized:', { url: supabaseUrl });
    
app.use((req, res, next) => {
    console.log(`Request: ${req.method} ${req.url}`);
    next();
});
    
// Login route
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { user } = data;
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, email')
            .eq('id', user.id)
            .single();
        if (userError) throw userError;
        res.json({ access_token: data.session.access_token, role: userData.role, email: userData.email });
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});
    
// Logout route
app.post('/api/logout', async (req, res) => {
    try {
        res.json({ message: 'Logged out' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
    
// User route
app.get('/api/user', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });
    try {
        const { data: { user }, error } = await supabase.auth.getUser(authHeader.split(' ')[1]);
        if (error) throw error;
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('role, email')
            .eq('id', user.id)
            .single();
        if (userError) throw userError;
        res.json({ role: userData.role, email: userData.email });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});
    
// Tickets routes...
    
// Route to create a new ticket
app.post('/api/tickets', async (req, res) => {
    const { employee_id, name, line, process, description } = req.body;
    try {
        const created_at = getCurrentMexicoCityTime().toISO();
        const { data, error } = await supabase
            .from('tickets')
            .insert([{ employee_id, name, line, process, description, status: 'Open', created_at }])
            .select('ticket_id')
            .single();
    
        if (error) throw error;
        const ticket_id = data.ticket_id;
        res.status(201).json({ ticket_id });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: error.message });
    }
});
    
// Route to get a specific ticket by ID
app.get('/api/tickets/:ticket_id', async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('ticket_id', ticket_id)
            .single();
    
        if (error) throw error;
        res.json(data);
    } catch (error)
    {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: error.message });
    }
});
    
// Route to get all tickets with filtering and sorting
app.get('/api/tickets', async (req, res) => {
    try {
        let query = supabase.from('tickets').select(
            'ticket_id, employee_id, line, process, created_at, description, status'
        );
    
        const { ticket_id, employee_id, line, process, description, status, from, to } = req.query;
    
        if (ticket_id) query = query.ilike('ticket_id', `%${ticket_id}%`);
        if (employee_id) query = query.ilike('employee_id', `%${employee_id}%`);
        if (line) query = query.eq('line', line);
        if (process) query = query.ilike('process', `%${process}%`);
        if (description) query = query.ilike('description', `%${description}%`);
        if (status) {
            const statuses = status.split(',');
            query = query.in('status', statuses);
        }
    
        if (from) {
            const { startOfDay } = getDailyTimeRange(from);
            query = query.gte('created_at', startOfDay.toISO());
        }
        if (to) {
            const { endOfDay } = getDailyTimeRange(to);
            query = query.lte('created_at', endOfDay.toISO());
        }
    
        const sort_by = req.query.sort || 'created_at_desc';
        if (sort_by === 'created_at_desc') {
            query = query.order('created_at', { ascending: false });
        } else if (sort_by === 'created_at_asc') {
            query = query.order('created_at', { ascending: true });
        }
    
        const { data, error } = await query;
        if (error) throw error;
    
        res.json(data);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: error.message });
    }
});
    
    
// Import and use routes from separate files
app.put('/api/tickets/:ticketId/assign', require('./assign'));
app.put('/api/tickets/:ticketId/resolve', require('./resolve'));
app.get('/api/ticket-stats', require('./ticket-stats'));
app.get('/api/downtime', require('./downtime'));
app.get('/api/downtime-by-process', require('./downtime-by-process'));
app.get('/api/tickets-by-process', require('./tickets-by-process'));
// The next line is commented out because the file is missing
// app.get('/api/technician-stats', require('./technician-stats'));
    
    
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});