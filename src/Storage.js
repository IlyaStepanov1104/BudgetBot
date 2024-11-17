// src/storage/Storage.js
import * as fs from "node:fs";
import {DATA_FILE} from "../index.js";
import {add, addHours, addMinutes, isBefore, parseISO} from "date-fns";

export class Storage {
    static loadData() {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({users: {}}, null, 2));
        }

        const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const parsedData = {users: {}};

        Object.entries(rawData.users).forEach(([userID, _]) => {
            parsedData.users[userID] = rawData.users[userID]
                .map((entry) => {
                    entry.date = parseISO(entry.date);
                    entry.date = addMinutes(addHours(entry.date, -26), -59);

                    if (entry.repeat) {
                        const today = new Date();
                        while (isBefore(entry.date, today)) {
                            entry.date = add(entry.date, {months: 1});
                        }
                    }
                    return entry;
                });

            parsedData.users[userID].sort((a, b) => {
                if (!a.date || !b.date) return 0;
                return a.date - b.date;
            });
        });

        return parsedData;
    }

    static saveData(data) {
        Object.entries(data.users).forEach(([userID, _]) => {
            data.users[userID] = data.users[userID].map((entry) => {
                entry.date = addMinutes(addHours(entry.date, 26), 59);
                return entry;
            });
        });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }

    static addEntry(userId, entry) {
        if (!entry.date) return false;
        const data = this.loadData();
        if (!data.users[userId]) {
            data.users[userId] = [];
        }
        data.users[userId].push(entry);
        this.saveData(data);
        return true;
    }

    static deleteEntry(userId, index) {
        const data = this.loadData();
        if (!data.users[userId] || data.users[userId].length <= index) {
            return false;
        }
        data.users[userId].splice(index, 1);
        this.saveData(data);
        return true;
    }

    static listEntries(userId) {
        const data = this.loadData();
        return data.users[userId] || [];
    }

    static getAllUsers() {
        const data = this.loadData();
        return Object.keys(data.users);
    }
}
