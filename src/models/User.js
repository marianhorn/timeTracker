const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class User {
    constructor(data) {
        this.id = data.id || uuidv4();
        this.username = data.username;
        this.email = data.email;
        this.passwordHash = data.passwordHash;
        this.isActive = data.isActive !== undefined ? data.isActive : true;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
        this.lastLoginAt = data.lastLoginAt;
    }

    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    async validatePassword(password) {
        return await bcrypt.compare(password, this.passwordHash);
    }

    toJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            isActive: this.isActive,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastLoginAt: this.lastLoginAt
        };
    }

    // Safe object without sensitive data for client
    toSafeJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email
        };
    }
}

module.exports = User;