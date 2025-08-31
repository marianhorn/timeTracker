const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function resetDatabase() {
    return new Promise((resolve) => {
        rl.question('⚠️  This will delete ALL user data, accounts, tasks, time entries, and logs. Are you sure? (yes/no): ', (answer) => {
            if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
                const dataDir = path.join(__dirname, '..', 'data');
                const mainDbPath = path.join(dataDir, 'timetracker.db');
                const usersDir = path.join(dataDir, 'users');
                
                try {
                    let deletedItems = 0;
                    
                    // Delete main database (users and authentication)
                    if (fs.existsSync(mainDbPath)) {
                        fs.unlinkSync(mainDbPath);
                        deletedItems++;
                        console.log('✅ Main database deleted');
                    }
                    
                    // Delete all user databases
                    if (fs.existsSync(usersDir)) {
                        const userFolders = fs.readdirSync(usersDir, { withFileTypes: true })
                            .filter(dirent => dirent.isDirectory())
                            .map(dirent => dirent.name);
                        
                        for (const userId of userFolders) {
                            const userDbPath = path.join(usersDir, userId, 'timetracker.db');
                            if (fs.existsSync(userDbPath)) {
                                fs.unlinkSync(userDbPath);
                                deletedItems++;
                            }
                        }
                        
                        // Remove users directory
                        fs.rmSync(usersDir, { recursive: true, force: true });
                        console.log('✅ All user databases deleted');
                    }
                    
                    if (deletedItems > 0) {
                        console.log(`✅ Reset complete! Deleted ${deletedItems} database(s)`);
                        console.log('💡 Databases will be recreated automatically when you start the application.');
                    } else {
                        console.log('ℹ️  No databases found to reset.');
                    }
                } catch (error) {
                    console.error('❌ Error resetting databases:', error.message);
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