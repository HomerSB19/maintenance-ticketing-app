const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

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
            .select('role')
            .eq('id', user.id)
            .single();
        if (userError) throw userError;
        res.json({ access_token: data.session.access_token, role: userData.role });
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
            .select('role')
            .eq('id', user.id)
            .single();
        if (userError) throw userError;
        res.json({ role: userData.role });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

// Tickets routes
app.get('/api/tickets', async (req, res) => {
    console.log('Handling GET /api/tickets', { query: req.query });
    try {
        const { status } = req.query;
        let query = supabase.from('tickets').select('*');
        if (status) query = query.in('status', status.split(','));
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const { employee_id, name, line, process, description, status } = req.body;
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token provided' });
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.split(' ')[1]);
        if (authError) throw authError;
        const ticket_id = `${line}-${Date.now()}`;
        const { error } = await supabase.from('tickets').insert({
            ticket_id,
            employee_id,
            name,
            line,
            process,
            description,
            status,
            created_at: new Date().toISOString()
        });
        if (error) throw error;
        res.status(201).json({ ticket_id });
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

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
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tickets/:ticket_id/assign', async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { assigned_to, status, assigned_at } = req.body;
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token provided' });
        const { error } = await supabase
            .from('tickets')
            .update({ assigned_to, status, assigned_at })
            .eq('ticket_id', ticket_id);
        if (error) throw error;
        res.json({ updated: true });
    } catch (error) {
        console.error('Error assigning ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/tickets/:ticket_id/resolve', async (req, res) => {
    try {
        const { ticket_id } = req.params;
        const { issue, fix, status, resolved_by, resolved_at } = req.body;
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No token provided' });
        const { error } = await supabase
            .from('tickets')
            .update({ issue, fix, status, resolved_by, resolved_at })
            .eq('ticket_id', ticket_id);
        if (error) throw error;
        res.json({ updated: true });
    } catch (error) {
        console.error('Error resolving ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stats and analytics routes
app.get('/api/ticket-stats', async (req, res) => {
    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 8, 0, 0);
        const { data: todayData, error: todayError } = await supabase
            .from('tickets')
            .select('ticket_id')
            .gte('created_at', todayStart.toISOString());
        if (todayError) throw todayError;
        const { data: weekData, error: weekError } = await supabase
            .from('tickets')
            .select('ticket_id')
            .gte('created_at', weekStart.toISOString());
        if (weekError) throw weekError;
        res.json({ today: todayData.length, week: weekData.length });
    } catch (error) {
        console.error('Error fetching ticket stats:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/downtime', async (req, res) => {
    try {
        const { line, from, to } = req.query;
        let query = supabase
            .from('tickets')
            .select('line, created_at, resolved_at')
            .in('status', ['Open', 'Ongoing', 'Closed']);
        if (line) query = query.eq('line', line);
        if (from) query = query.gte('created_at', new Date(from).toISOString());
        if (to) query = query.lte('created_at', new Date(to).toISOString());
        const { data, error } = await query;
        if (error) throw error;
        const now = new Date();
        const downtime = {};
        data.forEach(ticket => {
            const created = new Date(ticket.created_at);
            const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : now;
            const minutes = (resolved - created) / (1000 * 60);
            downtime[ticket.line] = (downtime[ticket.line] || 0) + minutes;
        });
        const result = Object.keys(downtime).map(line => ({ line, downtime: Math.round(downtime[line]) }));
        res.json(result);
    } catch (error) {
        console.error('Error fetching downtime:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/downtime-by-process', async (req, res) => {
    try {
        const { line, from, to } = req.query;
        let query = supabase.from('tickets').select('process, created_at, resolved_at').in('status', ['Open', 'Ongoing', 'Closed']);
        if (line) query = query.eq('line', line);
        if (from) query = query.gte('created_at', new Date(from).toISOString());
        if (to) query = query.lte('created_at', new Date(to).toISOString());
        const { data, error } = await query;
        if (error) throw error;
        const now = new Date();
        const downtime = {};
        data.forEach(ticket => {
            const created = new Date(ticket.created_at);
            const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : now;
            const minutes = (resolved - created) / (1000 * 60);
            downtime[ticket.process] = (downtime[ticket.process] || 0) + minutes;
        });
        const result = Object.keys(downtime).map(process => ({ process, downtime: Math.round(downtime[process]) }));
        res.json(result);
    } catch (error) {
        console.error('Error fetching downtime by process:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tickets-by-process', async (req, res) => {
    try {
        const { line, from, to } = req.query;
        let query = supabase.from('tickets').select('process');
        if (line) query = query.eq('line', line);
        if (from) query = query.gte('created_at', new Date(from).toISOString());
        if (to) query = query.lte('created_at', new Date(to).toISOString());
        const { data, error } = await query;
        if (error) throw error;
        const counts = {};
        data.forEach(ticket => {
            counts[ticket.process] = (counts[ticket.process] || 0) + 1;
        });
        const result = Object.keys(counts).map(process => ({ process, count: counts[process] }));
        res.json(result);
    } catch (error) {
        console.error('Error fetching tickets by process:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/technician-stats', async (req, res) => {
    try {
        const { line, from, to } = req.query;
        let query = supabase
            .from('tickets')
            .select('resolved_by, assigned_to, created_at, assigned_at, resolved_at, status');
        if (line) query = query.eq('line', line);
        if (from) query = query.gte('created_at', new Date(from).toISOString());
        if (to) query = query.lte('created_at', new Date(to).toISOString());
        const { data, error } = await query;
        if (error) throw error;

        const stats = {};
        const now = new Date();
        data.forEach(ticket => {
            const technician = ticket.resolved_by || ticket.assigned_to || 'Unassigned';
            if (!stats[technician]) {
                stats[technician] = { tickets_resolved: 0, total_resolve_time: 0, total_downtime: 0 };
            }
            if (ticket.status === 'Closed' && ticket.resolved_by) {
                stats[technician].tickets_resolved += 1;
                if (ticket.assigned_at && ticket.resolved_at) {
                    const resolveTime = (new Date(ticket.resolved_at) - new Date(ticket.assigned_at)) / (1000 * 60);
                    stats[technician].total_resolve_time += resolveTime;
                }
            }
            if (ticket.assigned_to) {
                const downtime = (ticket.resolved_at ? new Date(ticket.resolved_at) : now) - new Date(ticket.created_at);
                stats[technician].total_downtime += downtime / (1000 * 60);
            }
        });

        const result = Object.keys(stats).map(technician => ({
            technician,
            tickets_resolved: stats[technician].tickets_resolved,
            total_resolve_time: stats[technician].total_resolve_time,
            total_downtime: stats[technician].total_downtime
        }));
        res.json(result);
    } catch (error) {
        console.error('Error fetching technician stats:', error);
        res.status(500).json({ error: error.message });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));