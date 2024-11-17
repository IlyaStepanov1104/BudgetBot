import TelegramBot from 'node-telegram-bot-api';
import {Storage} from './Storage.js';
import {Entry} from './Entry.js';
import {addDays, differenceInCalendarDays, format, parse, setDate, setMonth, setYear} from "date-fns";
import {ru} from "date-fns/locale";
import schedule from "node-schedule";

export class Bot {
    bot;

    constructor(token) {
        this.bot = new TelegramBot(token, {polling: true});
    }

    start() {
        this.bot.on("polling_error", console.info);

        this.bot.onText(/\/start/, (msg) => {
            this.bot.sendMessage(msg.chat.id, 'Привет! Я бот для управления бюджетом. Используй команды:\n' +
                '/list - показать все долги/доходы\n' +
                '/add - добавить долг или доход\n' +
                '/edit - редактировать запись\n' +
                '/delete - удалить запись');
        });

        this.bot.onText(/\/list/, (msg) => this.listEntries(msg));

        this.bot.onText(/\/add/, (msg) => this.addEntry(msg));

        this.bot.onText(/\/delete/, (msg) => this.deleteEntry(msg));
        this.scheduleDailyNotifications();
    }

    scheduleDailyNotifications() {
        schedule.scheduleJob('0 10 * * *', () => {
            const allUsers = Storage.getAllUsers(); // Предположим, что Storage предоставляет список всех пользователей
            allUsers.forEach(userID => this.notifyUser(userID));
        });
    }

    notifyUser(userID) {
        const now = new Date();
        const entries = Storage.listEntries(userID);
        const today = new Date();

        // Фильтруем записи с учетом ближайших дат
        const upcomingEntries = entries.filter(entry => {
            let entryDate = entry.date;
            if (entry.repeat) {
                // Сдвигаем повторяющиеся записи на текущий или следующий месяц
                entryDate = setYear(setMonth(setDate(entryDate, entry.date.getDate()), now.getMonth()), now.getFullYear());
                if (entryDate < today) {
                    entryDate = addDays(entryDate, 30); // Следующий месяц
                }
            }

            entry.date = entryDate;

            const diff = differenceInCalendarDays(entry.date, today);

            return 0 <= diff && diff <= 7;
        });

        if (upcomingEntries.length > 0) {
            upcomingEntries.sort((a, b) => a.date - b.date)
            const message = upcomingEntries.map((entry, index) =>
                `
${index + 1}. ${entry.type === 'debt' ? '💸 Долг' : '💰 Доход'} - ${entry.amount} ₽
Дата: ${entry.date ? format(entry.date, 'eeeeee, dd-MMM-yyyy', {locale: ru}) : '-'} 
Осталось дней: ${differenceInCalendarDays(entry.date, now)}
Название: ${entry.description}
`
            ).join('\n\n');

            this.bot.sendMessage(userID, `Напоминание о выплатах на ближайшие дни:\n\n${message}`);
        }
    }

    listEntries(msg) {
        const entries = Storage.listEntries(msg.chat.id);
        if (entries.length === 0) {
            this.bot.sendMessage(msg.chat.id, 'Записей пока нет.');
        } else {
            const response = entries.map((entry, index) =>
                `
${index + 1}. ${entry.type === 'debt' ? '💸 Долг' : '💰 Доход'} - ${entry.amount} ₽
Дата: ${entry.date ? format(entry.date, 'eeeeee, dd-MMM-yyyy', {locale: ru}) : '-'}
Каждый месяц: ${entry.repeat ? 'Да' : 'Нет'}
Название: ${entry.description}`
            ).join('\n\n');
            this.bot.sendMessage(msg.chat.id, response);
        }
    }

    addEntry(msg) {
        const value = msg.text?.slice(5);

        if (!value) {
            this.bot.sendMessage(msg.chat.id, 'Введите данные в формате: "Тип(долг/доход)  сумма  дата (ГГГГ-ММ-ДД) повтор(Да/Нет) описание"');
            return;
        }

        const [type, amount, date, repeat, ...description] = value.split(' ').map(s => s.trim());

        if (!/\d\d-\d\d-\d\d\d\d/.test(date)) {
            console.log(date)
            this.bot.sendMessage(msg.chat.id, 'Некорректный формат даты! Отправьте дату в формате дд-мм-гггг');
            return;
        }

        const entry = new Entry(
            type.toLowerCase() === 'долг' ? 'debt' : 'income',
            parseFloat(amount),
            repeat.toLowerCase() === 'да',
            parse(date, "dd-MM-yyyy", new Date()),
            description.join(' '));

        if (Storage.addEntry(msg.chat.id, entry)) {
            this.bot.sendMessage(msg.chat.id, 'Запись добавлена!');
        } else {
            this.bot.sendMessage(msg.chat.id, 'Запись не добавлена! Ошибка с датой');
        }
    }

    deleteEntry(msg) {
        const entries = Storage.listEntries(msg.chat.id);
        if (entries.length === 0) {
            this.bot.sendMessage(msg.chat.id, 'Нет записей для удаления.');
            return;
        }

        const response = entries.map((entry, index) =>
            `${index + 1}. ${entry.type === 'debt' ? '💸 Долг' : '💰 Доход'} - ${entry.amount} ₽\nДата: ${entry.date}\nОписание: ${entry.description}`
        ).join('\n\n');
        this.bot.sendMessage(msg.chat.id, `Выберите номер записи для удаления:\n${response}`);
        this.bot.once('message', (response) => {
            if (!response.text) {
                this.bot.sendMessage(msg.chat.id, 'Неверный номер записи.');
                return;
            }
            const index = parseInt(response.text) - 1;
            const success = Storage.deleteEntry(msg.chat.id, index);
            this.bot.sendMessage(msg.chat.id, success ? 'Запись удалена!' : 'Неверный номер записи.');
        });
    }
}
