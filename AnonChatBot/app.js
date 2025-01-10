const { Telegraf } = require('telegraf')
const fs = require('fs')

let db = JSON.parse(fs.readFileSync('db.json'))
let rooms = db.ROOMS
let global_users = db.GLOBAL_USERS
let main_user

const bot = new Telegraf(db.TOKEN)
bot.start((ctx) => {
    main_user = global_users.find(el => el.username == ctx.from.username)
    if(main_user){ // якщо в глобальних користувачах я вже є, то відкликати
        return
    }else{  
        ctx.reply(`Hello, ${ctx.from.first_name}!`)
        global_users.push({
            username: ctx.from.username, 
            id: ctx.chat.id,
            active: ""
        })
        fs.writeFileSync('db.json', JSON.stringify(db, null, 1))
    }
})
bot.command('create', (ctx) => {
    let name = ctx.message.text.split(' ').splice(1).join(' ') // /create {і ось тут назва, яку ми відрізаємо за допомогою split(' ').splice(1).join(' ')}
    if(name == ''){ // Якщо поле пусте
        return ctx.reply(`No room name, please write it.`)
    }else{
        let roomExists = rooms.some(el => el.roomName == name) // якщо кімната існує, то
        if(roomExists){ // то відповісти і вийти з функції
            return ctx.reply(`Room <b>${name}</b> allready exists!`, {parse_mode:'HTML'})
        }
        for(let k=0; k<rooms.length; k++){
            rooms[k].users.forEach(user => {
                if(user.username == ctx.from.username){
                    rooms[k].users.splice(rooms[k].users.indexOf(user), 1)
                    fs.writeFileSync('db.json', JSON.stringify(db, null, 1))
                    return ctx.reply(`You need to leave from room to create your own.`)
                }
            })
        }
        for(let i=0; i<rooms.length; i++){
            if(rooms[i].creator == ctx.from.username){ // якщо я вже створював кімнату до того, то замінити стару кімнату на нову
                ctx.reply(`You already own a room and we are creating a new room for you. Please, wait...`)
                let room = rooms.find(el => el.creator == rooms[i].creator)
                rooms.splice(rooms.indexOf(room), 1) // видаляю стару
                rooms.push({ // закидаю нову
                    creator: ctx.from.username,
                    roomName: name,
                    users: [{
                        username: ctx.from.username, // добавляю самого творця кімнати
                        id: ctx.chat.id,
                    }]
                })
                main_user = global_users.find(el => el.username == ctx.from.username)
                main_user.active = name // змінюю стан юзера в масиві GLOBAL_USERS
                ctx.reply(`New room created. Creator: @${ctx.from.username}. Other can join by writing room name: <b>${name}</b>`, {parse_mode:'HTML'})
                fs.writeFileSync('db.json', JSON.stringify(db, null, 1))
                return null // виходжу з функції
            }
        }
        rooms.push({ // якщо ж я не створював кімнат до того, то просто створити нову
            creator: ctx.from.username,
            roomName: name,
            users: [{
                username: ctx.from.username,
                id: ctx.chat.id,
            }]
        })
        main_user = global_users.find(el => el.username == ctx.from.username)
        main_user.active = name // змінюю стан юзера в масиві GLOBAL_USERS
        fs.writeFileSync('db.json', JSON.stringify(db, null, 1))
        ctx.reply(`Creator: @${ctx.from.username}. Other can join by writing room name: <b>${name}</b>`, {parse_mode:'HTML'})
    }
})
bot.command('join', (ctx) => { // приєднання до кімнати
    let name = ctx.message.text.split(' ').splice(1).join(' ')
    let room = rooms.find(el => el.roomName == name)
    if(room.creator == ctx.from.username){ // Якщо ти створив цю кімнату, то повідомлення про те, що творець вже є у кімнаті
        return ctx.reply(`You're already in the room!`)
    }else{
        for(let i=0; i<rooms.length; i++){
            if(rooms[i].roomName == name){ // Якщо rooms[i].roomName(назва кімнати) існує, то приєднатись
                
                let user = rooms[i].users.find(el => el.username == ctx.from.username) // знаходимо користувача
                if(user){ // якщо користувач вже в кімнаті
                    return ctx.reply(`You're already in the room!`)
                }else{
                    rooms.forEach(room => {
                        if(room.creator == ctx.from.username){ // якщо у користувача є власна кімната, то її потрібно видалити
                            rooms.splice(rooms.indexOf(room), 1) // видалення
                            global_users.forEach(user => {
                                if(user.active == name){
                                    user.active = ""
                                }
                            })
                            main_user = global_users.find(el => el.username == ctx.from.username)
                            main_user.active = ""
                            fs.writeFileSync('db.json', JSON.stringify(db, null, 1)) // запис в бд
                            ctx.reply(`Room was successfully deleted. Joining to ${name}`) // всьо
                        }
                    })
                    rooms[i].users.push({ // добавляю нового користувача в кімнату (rooms[i])
                        username: ctx.from.username,
                        id: ctx.chat.id
                    })
                    rooms[i].users.forEach(user => {
                        if(user.username != ctx.from.username){
                            ctx.telegram.sendMessage(user.id, `<i>${ctx.from.first_name} Has connected to <b>${rooms[i].roomName}</b></i>`, {parse_mode:'HTML'})
                        }
                    })
                    main_user = global_users.find(el => el.username == ctx.from.username)
                    main_user.active = name // змінюю стан юзера в масиві GLOBAL_USER
                    fs.writeFileSync('db.json', JSON.stringify(db, null, 1))
                }
            }
        }
        ctx.reply(`Not found`) // якщо не знайдено
    }
})
bot.command('delete', (ctx) => { // видалення кімнати
    let name = ctx.message.text.split(' ').splice(1).join(' ')
    let room = rooms.find(el => el.roomName == name)
    if(room.creator == ctx.from.username){ // якщо користувач, який хоче видалити кімнату є власником цієї кімнати, то тоді він має право на її видалення
        rooms.splice(rooms.indexOf(room), 1) // видалення
        global_users.forEach(user => {
            if(user.active == name){
                user.active = ""
            }
        })
        ctx.reply(`Room was successfully deleted`)
        main_user = global_users.find(el => el.username == ctx.from.username)
        main_user.active = ""
        fs.writeFileSync('db.json', JSON.stringify(db, null, 1)) // запис в бд
    }else{
        ctx.reply(`You're not an owner!`) // якщо не власник
    }
})
bot.command('leave', (ctx) => {
    let name = ctx.message.text.split(' ').splice(1).join(' ')
    for(let i=0; i<rooms.length; i++){
        if(rooms[i].roomName == name && rooms[i].creator != ctx.from.username){
            let user = rooms[i].users.find(el => el.username == ctx.from.username)
            if (user){
                rooms[i].users.splice(rooms[i].users.indexOf(user), 1)
                main_user = global_users.find(el => el.username == ctx.from.username)
                main_user.active = ""
                rooms[i].users.forEach(user => {
                    if(user.username != ctx.from.username){
                        ctx.telegram.sendMessage(user.id, `<i>${ctx.from.first_name} Has left from <b>${rooms[i].roomName}</b></i>`, {parse_mode:'HTML'})
                    }
                })
                fs.writeFileSync('db.json', JSON.stringify(db, null, 1)) // запис в бд
            }else{
                return ctx.reply(`You left <b>${rooms[i].roomName}</b>.`, {parse_mode:'HTML'})
            }
        }
    }
    ctx.reply(`Not found`)
})
bot.command('rooms', (ctx) => {
    list = '\n'
    rooms.forEach(room => {
        list += `\n${room.roomName}`
    })
    ctx.reply(`List of rooms: ${list}`)
})
bot.on('photo', async (ctx) => {
    main_user = global_users.find(el => el.username == ctx.from.username)
    if(main_user.active != ""){
        room = rooms.find(el => el.roomName == main_user.active)
        room.users.forEach(user => {
            if(user.username != ctx.from.username){
                const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id
                ctx.telegram.sendPhoto(user.id, fileId, {caption: `From: <i>${ctx.from.first_name}</i>`, parse_mode: 'HTML'})
            }
        })
    }
})
bot.on('sticker', (ctx) => {
    main_user = global_users.find(el => el.username == ctx.from.username)
    if(main_user.active != ""){
        room = rooms.find(el => el.roomName == main_user.active)
        room.users.forEach(user => {
            if(user.username != ctx.from.username){
                ctx.telegram.sendSticker(user.id, ctx.message.sticker.file_id)
            }
        })
    }
})
bot.on('voice', (ctx) => {
    main_user = global_users.find(el => el.username == ctx.from.username)
    if(main_user.active != ""){
        room = rooms.find(el => el.roomName == main_user.active)
        room.users.forEach(user => {
            if(user.username != ctx.from.username){
                ctx.telegram.sendVoice(user.id, ctx.message.voice.file_id, {caption: `From: <i>${ctx.from.first_name}</i>`, parse_mode: 'HTML'})
            }
        })
    }
})
bot.on('video', (ctx) => {
    main_user = global_users.find(el => el.username == ctx.from.username)
    if(main_user.active != ""){
        room = rooms.find(el => el.roomName == main_user.active)
        room.users.forEach(user => {
            if(user.username != ctx.from.username){
                ctx.telegram.sendVideo(user.id, ctx.message.video.file_id, {caption: `From: <i>${ctx.from.first_name}</i>`, parse_mode: 'HTML'})
            }
        })
    }
})
bot.on('animation', (ctx) => {
    main_user = global_users.find(el => el.username == ctx.from.username)
    if(main_user.active != ""){
        room = rooms.find(el => el.roomName == main_user.active)
        room.users.forEach(user => {
            if(user.username != ctx.from.username){
                ctx.telegram.sendAnimation(user.id, ctx.message.animation.file_id, {caption: `From: <i>${ctx.from.first_name}</i>`, parse_mode: 'HTML'})
            }
        })
    }
})
bot.on('message', (ctx) => {
    main_user = global_users.find(el => el.username == ctx.from.username)
    if(main_user.active != ""){
        room = rooms.find(el => el.roomName == main_user.active)
        room.users.forEach(user => {
            if(user.username != ctx.from.username){
                ctx.telegram.sendMessage(user.id, `<b>${ctx.from.first_name}</b>: ${ctx.message.text}`, {parse_mode:'HTML'})
            }
        })
    }
})

bot.launch()
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))