// src/entities/Entry.js

export class Entry {

    constructor(type, amount, repeat, date, description) {
        this.type = type;
        this.amount = amount;
        this.date = date;
        this.description = description;
        this.repeat = repeat;
    }
}
