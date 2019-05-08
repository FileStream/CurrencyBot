//Set global constants
var Discord = require('discord.io'); //Discord API
var logger = require('winston');
var MongoClient = require('mongodb').MongoClient; //Get database functions
var cbot = require('cleverbot.io');
var cleverbot = new cbot(process.env.CB_USER, process.env.CB_KEY);
var bigInteger = require('biginteger').BigInteger; //Handle arbitrarily large numbers
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

function pullDB(col, receiver) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(uri, { useNewUrlParser: true }, function (err, cli) {
            if (err)
                console.log("MONGODB CONNECTION ERROR: " + JSON.stringify(err));
            var collection = cli.db("datastore").collection(col);
            collection.find({}).toArray(function (er, result) {
                if (er) {
                    console.log("TOARRAY ERROR: " + JSON.stringify(er));
                }
                for (var r in result) {
                    try {
                        receiver[r.id] = r;
                    }
                    catch (error) {
                        console.log("ERROR ON DB PULL: " + JSON.stringify(error));
                        reject();
                    }
                }
            });
            cli.close();
            resolve();
        });
    });
}

function pushDB(col, sender, doWipe = true) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(uri, {
            useNewUrlParser: true
        }, async function (err, cli) {
            if (err) {
                console.log("MONGODB CONNECTION ERROR: " + JSON.stringify(err));
                reject();
            }
            var collection = cli.db("datastore").collection(col);
                if (doWipe)
                    await collection.drop().catch((res)=>reject("Failed drop: ", JSON.stringify(res)));

                try {
                    await collection.insertMany(Object.values(sender)).catch((res)=>reject("Failed insertion: ", JSON.stringify(res)));
                }
                catch (error) {
                    console.log("ERROR ON DB PUSH: " + JSON.stringify(error));
                    reject();
                }
            cli.close();
            resolve();
        });
    });
}

function User(userID) {
    this.id = userID;
}

function Server(serverID, pref = "x!") {
    this.prefix = pref;
    this.id = serverID;
}


//Log bot bootup and start various sheduled tasks
bot.on('ready', async function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');

    //Initialize data storage classes
        for (u in bot.users) {
            userData[u] = new User(u);
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
        console.log("Data sent.");
    }, 900000);

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


    if (message != '') console.log(user + ': ' + message); //log all messages

    try {
        var pre = serverData[bot.channels[channelID].guild_id].prefix;
    } catch (err) {
        var pre = "x!";
    }

    if (message.substring(0, pre.length) == pre) {
        var args = message.substring(pre.length).split(/ +/);
        var cmd = args[0];
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
                        bot.sendMessage({ to: channelID, message: "Sent data to database." });
                    })();
                    break;
                case 'load':
                    (async function () {
                        if (userID != creator_id) return;
                        await pullDB("userdata", userData).catch((res) => {
                            console.log("USERDATA FAILURE: " + res);
                        });;
                        bot.sendMessage({ to: channelID, message: "Retrieved data from database." });
                    })();
                    break;
                case 'getdata':
                    if (userID != creator_id) break;
                    console.log(JSON.stringify(userData));
                    break;
            }
        } catch (error) {
            console.log("Command error: " + JSON.stringify(error));
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

bigInteger.prototype.displayString = getCommas(this);


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
