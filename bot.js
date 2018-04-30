//Set globals
var Discord = require('discord.io');
var logger = require('winston');
var MongoClient = require('mongodb').MongoClient; //Get database functions
var isDeaf = false;
var pageHolder = [];

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
//const uri = "mongodb+srv://bin:" + process.env.MONGO_PASS + "@bottlebot-zidlm.mongodb.net/test";

function rememberDB(reading) {
    MongoClient.connect(uri, function(err, cli) {
        if (err)
            console.log(err);
//        var collection = cli.db("test").collection("remembers");
        if (reading) {
 //           collection.find({}).toArray(function(er, result) {
        //});
        } else {
        }
        cli.close();
    });
}

//Log bot bootup and start phrase timer
bot.on('ready', function(evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    //rememberDB(true);
    bot.setPresence({
        game: {
            name: "p!help | " + (Object.keys(bot.servers).length) + " servers"
        }
    }, console.log);
});

bot.on('connect', function(evt) {
    bot.sendMessage({
        to: "406691131037057025",
        message: "Guess who's here!"
    });
});

bot.on('disconnect', function(evt) {
    bot.sendMessage({
        to: "406691131037057025",
        message: "Shutting down. Cya later!"
    });
});

//Message handling
bot.on('message', function(user, userID, channelID, message, evt) {
    evt.d.attachments.forEach((embed) => {
        if (embed.url)
            console.log(user + ': ' + embed.url);
    });
    if (message != '') console.log(user + ': ' + message);
    
    if (message.substring(0, 2) == 'p!' && (!isDeaf || userID == '175711685682659328')) {
        var args = message.substring(2).split(' ');
        var cmd = args[0];
        args = args.splice(0);
        switch (cmd) {
            case 'ping':
                var date = new Date(Date.now());
                var currentTime = (date.getSeconds() * 1000) + date.getMilliseconds();
                var msgTime = (parseInt(evt.d.timestamp.split('.')[0].split(':')[2]) * 1000) + parseInt(evt.d.timestamp.split('.')[1].substring(0, 3));
                bot.sendMessage({
                    to: channelID,
                    message: 'Pong! `' + (currentTime - msgTime) + ' ms`'
                });
                break;
            case 'help':
                //help info
                var helpInfo = [
                    ['b!help [<page #>]', 'Makes this panel open, put in a specific page as an optional parameter'],
                    ['b!ping', "Lets you test how fast the bot's server can respond to you without imploding"]
                ];

                if (args[1] == null) {
                    var helpText = "```diff\n--- All commands start with p!\n--- anything enclosed in <> is a parameter\n--- anything enclosed in [] is optional\n+ commands are available to anyone\n- commands are admin only\n\n";
                } else {
                    var helpText = "";
                }
                for (var i = 0; i < helpInfo.length; i++)
                    helpText = helpText + ((helpInfo[i][2] != true) ? '+ ' : '- ') + helpInfo[i][0] + '\n--- ' + helpInfo[i][1] + ((i + 1 != helpInfo.length) ? '\n\n' : '\n```');

                if (args[1] == null) {
                    var holder = helpText.split('\n\n');
                    for (var i = 0; i < holder.length; i++) {
                        // var Sstring = spliceSlice(helpText, i - 1, '#$#');
                        if (i % 4 == 0 && i != 0)
                            holder[i] = holder[i].concat('```\n#$#\n```diff');
                    }
                    pageHolder = holder.join('\n\n').split('#$#');
                    pageHolder.push(userID);
                    bot.sendMessage({
                        to: channelID,
                        embed: {
                            "title": bot.username + ' command list:',
                            "color": Math.floor(Math.random() * 16777215) + 1,
                            "description": pageHolder[0],
                            "footer": {
                                "text": "Page 1/" + (pageHolder.length - 1) + ', use "b!help <page #>" to switch pages'
                            }
                        }
                    }, (err, res) => lastMsg = res.id);
                } else {
                    if (pageHolder[pageHolder.length - 1] == userID && args[1] < pageHolder.length) {
                        bot.editMessage({
                            channelID: channelID,
                            messageID: lastMsg,
                            embed: {
                                "color": Math.floor(Math.random() * 16777215) + 1,
                                "description": pageHolder[(args[1] - 1)],
                                "footer": {
                                    "text": "Page " + args[1] + "/" + (pageHolder.length - 1) + ', use "b!help <page #>" to switch pages'
                                }
                            }
                        });
                    }
                }
                break;
            case 'deafen':
                if (userID == '175711685682659328') {
                    isDeaf = !isDeaf;
                    message: "Deaf mode " + ((isDeaf) ? "deactivated." : "activated.")
                }
                break;
            case 'namechange':
                if (userID == '175711685682659328')
                    bot.editUserInfo({
                        username: args.slice(1).join(' ')
                    });
                break;
            case 'status':
                if (args[1] == "default")
                    bot.setPresence({
                        game: {
                            name: "p!help | " + (Object.keys(bot.servers).length) + " servers"
                        }
                    }, console.log);
                 else if (args[1] != null) {
                    var Sstring = '';
                    for (var i = 1; i < args.length; i++)
                        Sstring = Sstring.concat(' ', args[i]);
                     
                    bot.setPresence({
                        game: {
                            name: Sstring
                        }
                    }, console.log);
                }
                break;

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
            //console.log(roles.map(r=>(r >>> 0).toString(2)));
            //for (var role of roles) {
            //console.log(Object.values(roles[i]["ADMINISTRATOR"]).toString());
            //if (roles[i]["GENERAL_ADMINISTRATOR"] == true) return true;
            //i++;
            // if (i==roles.length) return false;
            //}
        }
    }

});
