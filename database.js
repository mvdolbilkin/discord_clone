const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt'); // Используем bcrypt вместо bcryptjs

// Подключаемся к SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite'
});

// Определяем модель пользователя
const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

// Определяем модель сообщений
const Message = sequelize.define('Message', {
    text: {
        type: DataTypes.STRING,
        allowNull: false
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

// Связываем сообщения с пользователями
User.hasMany(Message);
Message.belongsTo(User);

// Определяем модель диалогов
const Dialog = sequelize.define('Dialog', {
    user1Id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    user2Id: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
});

// Связываем диалоги с сообщениями
Message.belongsTo(Dialog);
Dialog.hasMany(Message);

// Синхронизация базы данных
sequelize.sync()
    .then(() => console.log('База данных успешно создана'))
    .catch(err => console.error('Ошибка базы данных:', err));

// ✅ Теперь экспортируем Dialog, чтобы использовать в server.js
module.exports = { sequelize, User, Message, Dialog };