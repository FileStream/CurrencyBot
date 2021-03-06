﻿//Set global constants
var Discord = require('discord.io'); //Discord API
var logger = require('winston');
var MongoClient = require('mongodb').MongoClient; //Get database functions
var cbot = require('cleverbot.io');
var cleverbot = new cbot(process.env.CB_USER, process.env.CB_KEY);
const creator_id = '175711685682659328';

//Set global mutables
var pageHolder = {};
var userData = {}; //All user data, USERIDs are keys
var serverData = {};


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = 'debug';

//Set up discord connection
var bot = new Discord.Client({
    token: process.env.BOT_TOKEN,
    autorun: true
});

//MongoDB stuff
const uri = "mongodb+srv://bin:" + process.env.MONGO_PASS + "@currency-swwe3.mongodb.net/test"; //Database URI

function pullDB(col, receiver, isCollection = true) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(uri, { useNewUrlParser: true }, function (err, cli) {
            if (err)
                console.log("MONGODB CONNECTION ERROR: " + err.message);
            var collection = cli.db("datastore").collection(col);
            collection.find().toArray(function (er, result) {
                if (er) {
                    console.log("TOARRAY ERROR: " + er.message);
                }
                for (var r of result) {
                    try {
                        if (isCollection) {
                            for (p in receiver[r.id])
                                if (r[p] != undefined) receiver[r.id][p] = r[p];
                        }
                        else {
                            for (p in receiver)
                                if (r[p] != undefined) receiver[p] = r[p];
                        }
                    }
                    catch (error) {
                        console.log("ERROR ON DB PULL: " + JSON.stringify(error));
                    }
                }
                cli.close();
                resolve();
            });
        });
    });
}

function pushDB(col, sender, isCollection = true) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(uri, {
            useNewUrlParser: true
        }, async function (err, cli) {
            if (err) {
                console.log("MONGODB CONNECTION ERROR: " + err.message);
                return reject();
            }
            var collection = cli.db("datastore").collection(col);
            collection.drop().catch((res) => reject("Failed drop: " + res.message));
            try {
                if (isCollection)
                    await collection.insertMany(Object.values(sender)).catch((res) => reject("Failed insertion: " + res.message));
                else {
                    await collection.insert(sender).catch((res) => reject("Failed insertion: " + res.message));
                }
            }
            catch (error) {
                console.log("ERROR ON DB PUSH: " + JSON.stringify(error));
                return reject();
            }
            resolve();
            cli.close();
        });
    });
}

//WORKING OBJECTS

const transactionTypes = {
    SEND: 1,
    RECEIVE: 2,
    TRANSFER: 3,
    DEPOSIT: 4,
    WITHDRAW: 5,
    BUY: 6
};

function depositBox(userID) {
    this.id = userID;
    this.balance = "0";
}

var Bank = {
    storage: {}, //Stores userIDs and their respective amount of money in the bank
    transactions: [] //Stores all deposit / withdraw logs from the bank
};

function Transaction(amount, transactionType, user = undefined) {
    this.amount = amount.toString(); //Amount of money used in transaction
    this.type = transactionType; //Type of transaction
    this.userID = (user != undefined ? user.id : undefined); //Set userID for later use, some transactions don't need this which is why user is an optional parameter

    if (user != undefined) { //Perform tasks on the user the transaction originated from

        if (transactionType == transactionTypes.SEND) {
            user.money = (BigInt(user.money) - amount).toString();
        }

        if (transactionType == transactionTypes.RECEIVE) {
            user.money = (BigInt(user.money) + amount).toString();
        }

        if (transactionType == transactionTypes.WITHDRAW) {
            var balance = BigInt(Bank.storage[this.userID].balance);
            if (amount > balance) { //If user withdraws more than they have in their bank balance
                amount = (amount > balance + (getNetWorth(user) * BigInt(user.credit)) - BigInt(user.debt) ? balance + ((getNetWorth(user) * BigInt(user.credit)) - BigInt(user.debt)) : amount); //Maximum overdraft is the user's credit score multiplied by their net worth
                user.debt = (BigInt(user.debt) + amount - balance).toString();
            }
            Bank.storage[this.userID].balance = (0 > balance - amount ? "0" : ((balance - amount).toString())); //Minimum balance in bank is 0, debt is stored seperately
            user.money = (BigInt(user.money) + amount).toString();
        }

        if (transactionType == transactionTypes.DEPOSIT) { //If user is depositing and they have debt, automatically pay off their debt with the deposit.
            var toRemove = 0n;
            if (BigInt(user.debt) > 0) { //If user has debt
                toRemove = (BigInt(user.debt) > amount ? amount : BigInt(user.debt)); //Pay off debt up to the total amount deposited
                user.debt = (BigInt(user.debt) - toRemove).toString();
            }
            user.money = (BigInt(user.money) - amount).toString();
            Bank.storage[this.userID].balance = (BigInt(Bank.storage[this.userID].balance) + amount - toRemove).toString(); //New balance is whatever part of the deposit wasn't used for paying off debt
        }
    }
}

function User(userID) {
    this.id = userID;
    this.money = "0";
    this.transactions = [];
    this.debt = "0";
    this.credit = "3";
}

function Server(serverID, pref = "x!") {
    this.prefix = pref;
    this.id = serverID;
    this.transactions = [];
    this.stockMultiplier = "1";
    this.stocks = {}; //Stores stocks - userID of stockholder and initial deposit amount
}


//Log bot bootup and start various sheduled tasks
bot.on('ready', async function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');

    //Initialize data storage classes
    for (u in bot.users) {
        userData[u] = new User(u);
        Bank.storage[u] = new depositBox(u);
    }
    for (s in bot.servers) {
        serverData[s] = new Server(s);
    }

    //Pull values from database
    await pullDB("userdata", userData).catch((res) => {
        console.log("USERDATA FAILURE: " + res);
    });
    await pullDB("serverdata", serverData).catch((res) => {
        console.log("SERVERDATA FAILURE: " + res);
    });
    await pullDB("bankdata", Bank, false).catch((res) => {
        console.log("BANKDATA FAILURE: " + res);
    });

    bot.setPresence({
        game: {
            name: "x!help | " + (Object.keys(bot.servers).length) + " servers"
        }
    }, console.log);

    setInterval(async function sendData() { //Periodically update database
        console.log("Sending userdata to database");
        await pushDB("userdata", userData).catch((res) => {
            console.log("USERDATA FAILURE: " + res);
        });
        await pushDB("serverdata", serverData).catch((res) => {
            console.log("SERVERDATA FAILURE: " + res);
        });
        await pushDB("bankdata", Bank, false).catch((res) => {
            console.log("BANKDATA FAILURE: " + res);
        });
        console.log("Data sent.");
    }, 900000);

    setInterval(compoundInterest, 86400000); //Compound interest daily

});

bot.on('connect', function (evt) {
    //things to do upon connection
});

bot.on('disconnect', function (evt) {
    //cleanup various things
});

//Message handling
bot.on('message', function (user, userID, channelID, message, evt) {

    if (channelID == '575112665983352835' && userID != '417093667778723840') return;


    message = message.replace(/@+(everyone|here)/g, "");


    if (message != '') console.log(user + ': ' + message); //log all messages

    try {
        var pre = serverData[bot.channels[channelID].guild_id].prefix;
    } catch (err) {
        var pre = "x!";
    }

    if (message.substring(0, pre.length) == pre) {
        var args = message.substring(pre.length).split(/ +/);
        var cmd = args[0];
        var guild = (bot.channels[channelID] != undefined) ? bot.servers[bot.channels[channelID].guild_id] : undefined;
        var currentUser = bot.users[userID];
        var data = userData[userID];
        args = args.splice(0);

        try { //Catch any command errors

            switch (cmd) {
                case 'ping':
                    var date = new Date();
                    var currentTime = (date.getSeconds() * 1000) + date.getMilliseconds();
                    var msgTime = (parseInt(evt.d.timestamp.split('.')[0].split(':')[2]) * 1000) + parseInt(evt.d.timestamp.split('.')[1].substring(0, 3));
                    bot.sendMessage({
                        to: channelID,
                        message: 'Pong! `' + (currentTime - msgTime) + ' ms`'
                    });
                    break;
                case 'withdraw':
                case 'w':
                    (async function () {
                        withdraw(data, args[1]).then(msg =>
                            bot.sendMessage({ to: channelID, message: msg })).catch(msg =>
                                bot.sendMessage({ to: channelID, message: msg }));
                    })();
                    break;
                case 'deposit':
                case 'd':
                    (async function () {
                        deposit(data, args[1]).then(msg =>
                            bot.sendMessage({ to: channelID, message: msg })).catch(msg =>
                                bot.sendMessage({ to: channelID, message: msg }));
                    })();
                    break;
                case 'send':
                case 's':
                    (async function () {
                        send(data, userData[args[1].match(/\d+/)[0]], args[2], serverData[guild.id]).then(msg =>
                            bot.sendMessage({ to: channelID, message: msg })).catch(msg =>
                                bot.sendMessage({ to: channelID, message: msg }));
                    })();
                    break;
                case 'info':
                case 'i':
                    bot.sendMessage({
                        "to": channelID,
                        "embed": {
                            "color": Math.floor(Math.random() * 16777216),
                            "thumbnail": {
                                "url": "https://cdn.discordapp.com/avatars/575083138380726282/90f673d5585c7ae3c5083bde3293af23"
                            },
                            "author": {
                                "name": `${currentUser.username}'s stats`,
                                "icon_url": `https://cdn.discordapp.com/avatars/${userID}/${currentUser.avatar}`
                            },
                            "fields": [
                                {
                                    "name": "__Net worth__ 💰",
                                    "value": `$${display(getNetWorth(data))}`,
                                    "inline": true
                                },
                                {
                                    "name": "Cash 💵",
                                    "value": `$${display(data.money)}`,
                                    "inline": true
                                },
                                {
                                    "name": "Money in Bank 🏦",
                                    "value": `$${display(Bank.storage[userID].balance)}`,
                                    "inline": true
                                },
                                {
                                    "name": "Value of Stocks 📈",
                                    "value": "$0",
                                    "inline": true
                                },
                                {
                                    "name": "Credit 💳",
                                    "value": `${display(data.credit)}`,
                                    "inline": true
                                },
                                {
                                    "name": "Debt 📉",
                                    "value": `$${display(data.debt)}`,
                                    "inline": true
                                }
                            ]
                        }
                    });
                    break;
                case 'compound':
                    if (userID != creator_id) break;
                    compoundInterest();
                    break;
                case 'echo':
                    if (args[1] == 'id' && userID != creator_id) {
                        bot.sendMessage({
                            to: channelID,
                            message: "You do not have permission to use the ID feature of ECHO"
                        });
                        break;
                    }
                    if (args[1] != null && findPerm(8, channelID, userID)) {
                        bot.sendMessage({
                            to: args[1] != 'id' ? channelID : args[2],
                            message: (args[1] != 'id' ? args.slice(1).join(' ') : args.slice(3).join(' '))
                        });
                    }
                    break;
                case 'prefix':
                    if (args[1] == "set") {
                        if (!findPerm(8, channelID, userID)) break;
                        serverData[bot.channels[channelID].guild_id].prefix = args[2];
                        bot.sendMessage({
                            to: channelID,
                            message: "Prefix for this server has been changed to: " + serverData[bot.channels[channelID].guild_id].prefix
                        });
                    }
                    else
                        bot.sendMessage({
                            to: channelID,
                            message: "Current prefix for this server is: " + pre
                        });
                    break;
                case 'help':
                    if (!args[1]) args[1] = 1; //Automatically set page to 1 if no page # is specified

                    var helpInfo = [
                        [
                            { trigger: `${pre}help [<page #>]`, desc: 'Makes this panel open, put in a specific page as an optional parameter', restricted: false },
                            { trigger: `${pre}ping`, desc: "Lets you test how fast the bot's server can respond to you without imploding", restricted: false }
                        ]
                    ];

                    if (args[1] == 1) {
                        var helpText = `\`\`\`diff\n--- All commands start with ${pre}\n--- anything enclosed in <> is a parameter\n--- anything enclosed in [] is optional\n+ commands are available to anyone\n- commands are admin only\n\n`;
                    }
                    else
                        var helpText = "";

                    var page = args[1] - 1;

                    for (var command of helpInfo[page])
                        helpText = helpText + ((command.restricted != true) ? '+ ' : '- ') + command.trigger + '\n--- ' + command.desc + ((helpInfo[page].indexOf(command) + 1 != helpInfo[page].length) ? "\n\n" : "```");


                    bot.sendMessage({
                        to: channelID,
                        embed: {
                            "title": bot.username + ' command list:',
                            "color": Math.floor(Math.random() * 16777215) + 1,
                            "description": helpText,
                            "footer": {
                                "text": "Page " + args[1] + "/" + (helpInfo.length) + `, use "${pre}help <page #>" to switch pages`
                            }
                        }
                    }, err => console.log("HELP ERROR: " + JSON.stringify(err)));
                    break;
                case 'getservers':
                    for (var v of Object.values(bot.servers)) {
                        console.log("Server name: " + v.name, "Server id: " + v.id);
                    }
                    break;
                case 'leaveserver':
                bot.leaveServer(args[1]);
                break;
                case 'getvoice':
                    if (userID == creator_id) {
                        var target = bot.servers[bot.channels[channelID].guild_id];
                        let vchannels = Object.values(target.channels).filter(x => x.type == 2);
                        for (var c of Object.values(vchannels)) {
                            console.log("Voice channel name: " + c.name);
                            console.log("Current occupants: " + Object.values(target.members).filter(m => m.voice_channel_id == c.id).map(x => x.username));
                        }
                    }
                    break;
                case 'namechange':
                    if (userID == creator_id)
                        bot.editUserInfo({
                            username: args.slice(1).join(' ')
                        });
                    break;
                case 'status':
                    if (args[1] == "default")
                        bot.setPresence({
                            game: {
                                name: `${pre}help | ` + (Object.keys(bot.servers).length) + " servers"
                            }
                        }, console.log);
                    else if (args[1]) {
                        bot.setPresence({
                            game: {
                                name: args.slice(1).join(' ')
                            }
                        }, console.log);
                    }
                    break;
                case 'backup':
                    (async function () {
                        if (userID != creator_id) return;
                        await pushDB("userdata", userData).catch((res) => {
                            console.log("USERDATA FAILURE: " + res);
                        });
                        await pushDB("serverdata", serverData).catch((res) => {
                            console.log("SERVERDATA FAILURE: " + res);
                        });
                        await pushDB("bankdata", Bank, false).catch((res) => {
                            console.log("BANKDATA FAILURE: " + res);
                        });
                        bot.sendMessage({ to: channelID, message: "Sent data to database." });
                    })();
                    break;
                case 'load':
                    (async function () {
                        if (userID != creator_id) return;
                        await pullDB("userdata", userData).catch((res) => {
                            console.log("USERDATA FAILURE: " + res);
                        });
                        await pullDB("serverdata", serverData).catch((res) => {
                            console.log("SERVERDATA FAILURE: " + res);
                        });
                        await pullDB("bankdata", Bank, false).catch((res) => {
                            console.log("BANKDATA FAILURE: " + res);
                        });
                        bot.sendMessage({ to: channelID, message: "Retrieved data from database." });
                    })();
                    break;
                case 'getdata':
                    if (userID != creator_id) break;
                    console.log(JSON.stringify(userData));
                    break;
            }
        } catch (error) {
            console.log("Command error: " + error.message);
            bot.sendMessage({
                to: channelID,
                message: "There was an error running that command. :frowning:"
            });
        }
    }
    else if (message.includes('575083138380726282') && !userID.includes('575083138380726282')) {
        var args = message.substring(2).split(' ');
        var Sstring = args.slice(1).join(' ');
        if (Sstring) {
            cleverbot.setNick("yotsuba");
            cleverbot.create(function (err, response) {
                cleverbot.ask(Sstring, function (err, response) {
                    if (err)
                        throw response;
                    bot.sendMessage({
                        to: channelID,
                        message: response,
                        typing: true
                    });
                });
            });
        }
    }
    else if (channelID == '575112665983352835' && userID == '417093667778723840') {
        if (message) {
            if (Math.floor(Math.random() * 1000) == 999) bot.pinMessage({
                channelID: channelID,
                messageID: evt.d.id
            });
            cleverbot.setNick("yotsuba");
            cleverbot.create(function (err, response) {
                cleverbot.ask(message, function (err, response) {
                    if (err)
                        throw response;
                    bot.sendMessage({ to: channelID, message: response, typing: true });
                });
            });
        }
    }

});

//ECONOMY FUNCTIONS


function display(value) { //Convert BigInts to readable strings
    return getCommas(BigInt(value));
}

function send(sender, receiver, amount, server) {
    return new Promise((res, rej) => {
        amount = BigInt(amount);
        if (sender.id == receiver.id) return rej("You cannot send money to yourself!");
        if (BigInt(sender.money) < amount) return rej("You cannot send more money than you have in your balance!");
        sender.transactions.push(new Transaction(amount, transactionTypes.SEND, sender));
        receiver.transactions.push(new Transaction(amount, transactionTypes.RECEIVE, receiver));
        server.transactions.push(new Transaction(amount, transactionTypes.TRANSFER));
        return res(`Succesfully transfered $${display(amount)} from your account to ${bot.users[receiver.id].username}'s account.`);
    });
}

function deposit(sender, amount) {
    return new Promise((res, rej) => {
        amount = BigInt(amount);
        if (BigInt(sender.money) < amount) return rej("You cannot deposit more money than you have in your balance!");
        var originalDebt = BigInt(sender.debt);
        var t = new Transaction(amount, transactionTypes.DEPOSIT, sender);
        sender.transactions.push(t);
        Bank.transactions.push(t);
        if (originalDebt == 0) return res(`Succesfully deposited $${display(amount)} into the bank.`);
        else return res(`Succesfully deposited $${display(amount)} into the bank.\n$${display(originalDebt-BigInt(sender.debt))} automatically went into paying off your debt.\nYour remaining debt is $${display(sender.debt)}.`);
    });
}

function withdraw(asker, amount) {
    return new Promise((res, rej) => {
        amount = BigInt(amount);
        oldDebt = BigInt(asker.debt);
        oldMoney = BigInt(asker.money);
        oldBalance = BigInt(Bank.storage[asker.id].balance);
        var t = new Transaction(amount, transactionTypes.WITHDRAW, asker);
        asker.transactions.push(t);
        Bank.transactions.push(t);
        if (oldDebt < BigInt(asker.debt)) {//If user gained debt, notify them that they overdrew

            if (oldMoney + amount == BigInt(asker.money)) //If user overdrew without hitting limit
                return res(`Succesfully withdrew $${display(amount)} from your bank account. Due to an overdraft, your debt has increased by $${BigInt(asker.debt) - oldDebt}.`);
            else //If user hit overdraw limit
                return res(`Only $${display(BigInt(asker.money) - oldMoney)} was able to be withdrawn from your bank account because your overdraft limit was hit. Due to the overdraft, your debt has increased by $${BigInt(asker.debt) - oldDebt}. **You can increase your maximum overdraft by improving your credit.**`);
        }
        else if (BigInt(asker.debt) == BigInt(asker.credit) * getNetWorth(asker)) { //User has already maxed out their overdraft
            return res(`You have already hit your maximum overdraft, and cannot borrow any more money. **Your debt will continue to compound daily until paid off.**`);
        }
        else//If user didn't gain any debt
            return res(`Succesfully withdrew $${display(amount)} from your bank account.`);
    });
}

function getBankInterest() {

    if (Bank.transactions != []) {

        var withdrawals = Bank.transactions.filter(t => t.type == transactionTypes.WITHDRAW);
        var deposits = Bank.transactions.filter(t => t.type == transactionTypes.DEPOSIT);

        if (withdrawals != [])
            var withdrawn = withdrawals.map(t => t.amount).reduce((total, cur) => { return total + BigInt(cur) }, 0n);
        else var withdrawn = 0n;

        if (deposits != [])
            var deposited = deposits.map(t => t.amount).reduce((total, cur) => { return total + BigInt(cur) }, 0n);
        else var deposited = 0n;

    } else return 1n;


    if (deposited == 0n) return 1n;
    else return (withdrawn / deposited > 2n ? (withdrawn / deposited) : 2n);
}

function getDebtInterest(user) {

    if (user.transactions != []) {

        var withdrawals = user.transactions.filter(t => t.type == transactionTypes.WITHDRAW);
        var deposits = user.transactions.filter(t => t.type == transactionTypes.DEPOSIT);

        if (withdrawals != [])
            var withdrawn = withdrawals.map(t => t.amount).reduce((total, cur) => { return total + BigInt(cur) }, 0n);
        else var withdrawn = 0n;

        if (deposits != [])
            var deposited = deposits.map(t => t.amount).reduce((total, cur) => { return total + BigInt(cur) }, 0n);
        else var deposited = 0n;

    }
    else return 1n;

    if (deposited == 0n) return 1n;
    else return (withdrawn / deposited > 1n ? (withdrawn / deposited) : 1n);
}

function updateStocks() {

}

function getNetWorth(user) {
    return BigInt(user.money) + BigInt(Bank.storage[user.id].balance) - BigInt(user.debt);
}

function compoundInterest() {
    for (u of Object.values(userData)) {
        u.debt = (BigInt(u.debt) + (BigInt(u.debt) * getDebtInterest(u))).toString();
        Bank.storage[u.id].balance = (BigInt(Bank.storage[u.id].balance) + (BigInt(Bank.storage[u.id].balance) * getBankInterest())).toString();
    }
}










//GENERAL FUNCTIONS

function sendError(channelID, err) {
    bot.sendMessage({
        to: channelID,
        message: "Oh no! I've crashed due to the following error:\n```\n" + err + "\n```"
    });
    bot.disconnect();
}

function spliceSlice(str, index, add) {
    // We cannot pass negative indexes dirrectly to the 2nd slicing operation.
    if (index < 0) {
        index = str.length + index;
        if (index < 0) {
            index = 0;
        }
    }

    return str.slice(0, index) + (add || "") + str.slice(index, str.length - 1);
}

function getCommas(x) {
    var parts = x.toString().split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
}

//BigInt.prototype.displayString = getCommas(this);


function findPerm(role, channelID, userID) {
    //if (userID=='175711685682659328') return true;
    try {
        if (Object.values(bot.directMessages).find(m => m.recipient.id == userID).id == channelID) return true;
        else throw "Not in DM";
    } catch (err) {
        var roles = [];

        for (var r of Object.values(bot.servers[bot.channels[channelID].guild_id].members).find(m => m.id == userID).roles)
            roles.push(bot.servers[bot.channels[channelID].guild_id].roles[r]);

        for (var i = 0; i < roles.length; i++) {
            if ((parseInt(roles[i]['_permissions']) & role) != 0) return true;
        }
        return false;
    }
}

function findRole(name, channelID, userID) {
    try {
        if (Object.values(bot.directMessages).find(m => m.recipient.id == userID).id == channelID) return true;
        else throw "Not in DM";
    } catch (err) {
        var roles = [];

        for (var r of Object.values(bot.servers[bot.channels[channelID].guild_id].members).find(m => m.id == userID).roles)
            roles.push(bot.servers[bot.channels[channelID].guild_id].roles[r]);

        for (var i = 0; i < roles.length; i++) {
            if (roles[i].name == name) return true;
        }
        return false;
    }
}

function arr_shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
