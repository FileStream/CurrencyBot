//Set global constants
const Discord = require('discord.io'); //Discord API
const logger = require('winston');
const MongoClient = require('mongodb').MongoClient; //Get database functions
const cbot = require('cleverbot.io');
const cleverbot = new cbot(process.env.CB_USER, process.env.CB_KEY, 'XChange');
const bigInteger = require('biginteger').BigInteger; //Handle arbitrarily large numbers
const creator_id = '175711685682659328';

//Set global mutables
var pageHolder = {};
var userData = {}; //All user data, USERIDs are keys


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

function pullDB(collection, receiver) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(uri, { useNewUrlParser: true }, function (err, cli) {
            if (err)
                console.log("MONGODB CONNECTION ERROR: " + JSON.stringify(err));
            var collection = cli.db("datastore").collection(collection.toString());
            collection.find({}).toArray(function (er, result) {
                for (var r of result) {
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

function pushDB(collection, sender, doWipe = false) {
    return new Promise((resolve, reject) => {
        MongoClient.connect(uri, {
            useNewUrlParser: true
        }, function (err, cli) {
            if (err) {
                console.log("MONGODB CONNECTION ERROR: " + JSON.stringify(err));
                reject();
            }
            var collection = cli.db("datastore").collection(collection.toString());
            if (doWipe)
                collection.drop(function (error, delOK) {
                    if (error) console.log("DROP DB ERROR: " + JSON.stringify(error));
                });
            for (u in sender)
                try {
                    collection.insert(JSON.stringify(sender[u]));
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

//Log bot bootup and start various sheduled tasks
bot.on('ready', async function (evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    await pullDB("userdata", userData);
    bot.setPresence({
        game: {
            name: "x!help | " + (Object.keys(bot.servers).length) + " servers"
        }
    }, console.log);
    setInterval(async function sendData() { //Periodically update database
        console.log("Sending userdata to database");
        await pushDB("userdata", userData);
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


    if (message != '') console.log(user + ': ' + message); //log all messages


    if (message.substring(0, 2) == 'x!' && (!isDeaf || userID == creator_id)) {
        var args = message.substring(2).split(' ');
        var cmd = args[0];
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
                if (args[1] != null && findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
                    bot.sendMessage({
                        to: args[1] != 'id' ? channelID : args[2],
                        message: (args[1] != 'id' ? message.slice(1) : message.slice(3))
                    });
                }
                break;
            case 'help':

                if (!args[1]) args[1] = 1; //Automatically set page to 1 if no page # is specified

                var helpInfo = [
                    [
                        { trigger: 'x!help [<page #>]', desc: 'Makes this panel open, put in a specific page as an optional parameter' },
                        { trigger: 'x!ping', desc: "Lets you test how fast the bot's server can respond to you without imploding" }
                    ]
                ];

                if (args[1] == 1) {
                    var helpText = "```diff\n--- All commands start with x!\n--- anything enclosed in <> is a parameter\n--- anything enclosed in [] is optional\n+ commands are available to anyone\n- commands are admin only\n\n";
                }
                else
                    var helpText = "";

                var page = args[1] - 1;

                for (var command of helpInfo[page])
                    helpText = helpText + ((command.restricted != true) ? '+ ' : '- ') + command.trigger + '\n--- ' + command.desc + ((i + 1 != helpInfo[page].length) ? "\n\n" : "```");


                bot.sendMessage({
                    channelID: channelID,
                    embed: {
                        "title": bot.username + ' command list:',
                        "color": Math.floor(Math.random() * 16777215) + 1,
                        "description": helpText,
                        "footer": {
                            "text": "Page " + args[1] + "/" + (helpInfo.length) + ', use "x!help <page #>" to switch pages'
                        }
                    }
                });
                break;
            case 'deafen':
                if (userID == creator_id) {
                    isDeaf = !isDeaf;
                    message: "Deaf mode " + ((isDeaf) ? "deactivated." : "activated.")
                }
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
                            name: "x!help | " + (Object.keys(bot.servers).length) + " servers"
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
                    if (userID != creator_id) break;
                    await pushDB("userdata", userData)
                    bot.sendMessage({ to: channelID, message: "Sent data to database." });
                })();
                break;
            case 'getdata':
                if (userID != creator_id) break;
                console.log(JSON.stringify(userData));
                break;
        }
    }
    else if (channelID == '575078510876688404' && userID == '417093667778723840') {
        if (message) {
            cleverbot.setNick("XChange");
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


function findRole(role, channelID, userID) {
    try {
        if (Object.values(bot.directMessages).find(m => m.recipient.id == userID).id == channelID) return true;
    } catch (err) {
        var roles = [];

        for (var r of Object.values(bot.servers[bot.channels[channelID].guild_id].members).find(m => m.id == userID).roles)
            roles.push(bot.servers[bot.channels[channelID].guild_id].roles[r]);

        for (var i = 0; i < roles.length; i++) {
            console.log(roles[i]);
            if ((parseInt(roles[i]['_permissions']) & role) == 1) return true;
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
