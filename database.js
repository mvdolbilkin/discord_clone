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

// Синхронизация базы данных
sequelize.sync()
    .then(() => console.log('База данных успешно создана'))
    .catch(err => console.error('Ошибка базы данных:', err));

module.exports = { sequelize, User, Message };