const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function resetDatabase() {
    return new Promise((resolve) => {
        rl.question('⚠️  This will delete all your tasks, time entries, and daily logs. Are you sure? (yes/no): ', (answer) => {
            if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
                const dataDir = path.join(__dirname, '..', 'data');
                const dbPath = path.join(dataDir, 'timetracker.db');
                
                try {
                    if (fs.existsSync(dbPath)) {
                        fs.unlinkSync(dbPath);
                        console.log('✅ Database reset successfully!');
                        console.log('💡 The database will be recreated automatically when you start the application.');
                    } else {
                        console.log('ℹ️  No database found to reset.');
                    }
                } catch (error) {
                    console.error('❌ Error resetting database:', error.message);
                }
            } else {
                console.log('❌ Reset cancelled.');
            }
            resolve();
        });
    });
}

async function main() {
    console.log('🔄 Time Tracker Database Reset\n');
    await resetDatabase();
    rl.close();
    process.exit(0);
}

main().catch(console.error);