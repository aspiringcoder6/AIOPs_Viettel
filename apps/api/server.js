import app from './app.js';
import {pool} from './src/db/database.js';
const PORT = process.env.PORT || 3000;
async function waitForDatabase() {
    while (true) {
        try {
            const result = await pool.query('SELECT NOW()');
            console.log('Database connected:', result.rows[0]);
            return;
        } catch (err) {
            console.log('Waiting for PostgreSQL...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
}

async function startServer(){
    await waitForDatabase();

    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });

}
startServer();