//Set globals
var Discord = require('discord.io');
var logger = require('winston');
var MongoClient = require('mongodb').MongoClient; //Get database functions
//var pPhrases = ["Beheading peasants", "Getting sent to the dungeon", "In the dungeon", "Escaping the dungeon", "Getting beheaded", "Being revived", "Giving people the succ", "Kissing lots of thots", "Stealing some Pokémon", "Nutting all over the place", "Dabbing on my haters", "Bottle Spinning"];
var remembering = []; //Database container
var pageHolder = []; //Database page splitter
var imageHolder = []; //Temp. Image Container
//var State = 0; //Contains current phrase setting
var stealPoke = false;
var isDeaf = false;
var waitFor = [false, "", ""];
var lockDown = [];
var pollHolder = {};
var lastMsg = "";
var pinCount = [];

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


//timer
function runAtDate(date, func) {
    var now = (new Date()).getTime();
    var then = date.getTime();
    var diff = Math.max((then - now), 0);
    if (diff > 0x7FFFFFFF) //setTimeout limit is MAX_INT32=(2^31-1)
        setTimeout(function() {
            runAtDate(date, func);
        }, 0x7FFFFFFF);
    else
        setTimeout(func, diff);
}

//MongoDB stuff
const uri = "mongodb+srv://bin:" + process.env.MONGO_PASS + "@bottlebot-zidlm.mongodb.net/test";

function rememberDB(reading) {
    MongoClient.connect(uri, function(err, cli) {
        if (err)
            console.log(err);
        var collection = cli.db("test").collection("remembers");
        if (reading) {
            remembering = [];
            collection.find({}).toArray(function(er, result) {
                if (er)
                    console.log(er);
                for (var o of result) {
                    remembering.push([o.id, o.remembers.split(','), o.times]);
                    remembering[remembering.length-1][1].forEach((v, n) => {
                        remembering[remembering.length-1][1][n] = v.replace(/\#\$\#/g, ", ");
                        if (o.times != null && o.times[n] != null)
                            remembering[remembering.length-1][2][n] = o.times[n];
                        else
                            remembering[remembering.length-1][2] = [];
                    });
                }
            });
            for (var i = 0; i < remembering.length; i++) {
                for (var n = 0; n < remembering[i][1].length; n++) {
                    let dateHolder = remembering[i][2][n];
                    var now = (new Date()).getTime();
                    var then = dateHolder[0].getTime();
                    var diff = then - now;
                    if ((diff) >= 0) {
                        runAtDate(dateHolder[0], () => {
                            if (dateHolder[1] == remembering[i][1][n])
                                bot.sendMessage({
                                    to: dateHolder[3],
                                    message: dateHolder[1]
                                })
                        });
                    } else {
                        bot.sendMessage({
                            to: dateHolder[3],
                            message: dateHolder[1] + "\n**Due to an unknown error, this message was delivered " + (Math.abs(diff) / 60000) + " minutes late. Sorry for the inconvenience!**"
                        });
                    }
                }
            }
        } else {
            collection.drop(function(err, delOK) {
                if (err) {}
            });
            for (var i = 0; i < remembering.length; i++) {
                if (remembering[i][1][0]) {
                    remembering[i][1].forEach((v,n) => {
                        remembering[i][1][n] = v.replace(/, /g, "#$#");
                    });
                    collection.insert({
                        id: remembering[i][0],
                        remembers: remembering[i][1].toString(),
                        times: remembering[i][2]
                    });
                }
            }
        }
        cli.close();
    });
}

//Log bot bootup and start phrase timer
bot.on('ready', function(evt) {
    logger.info('Connected');
    logger.info('Logged in as: ');
    logger.info(bot.username + ' - (' + bot.id + ')');
    rememberDB(true);
    Object.values(bot.channels).forEach(c => pollHolder[c.id] = [[],[]]);
    console.log("retrieved vaults");
    bot.setPresence({
        game: {
            name: "b!help | " + (Object.keys(bot.servers).length) + " servers"
        }
    }, console.log);
    //State++;
    //    bot.setPresence({
    //      game: {
    //        name: pPhrases[State]
    //  }
    //}, console.log);
    //if (State + 1 < pPhrases.length) {
    //      State++;
    //} else {
    //    State = 0;
    //}
    bot.sendMessage({
        to: '411429643116216330',
        message: 'b!purge all 20'
    });
    bot.setPresence({
        game: {
            name: "b!help | " + (Object.keys(bot.servers).length) + " servers"
        }
    }, console.log);
    setInterval(function() {
        rememberDB(false);
        console.log("backed up vaults");
    }, 900000);
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

bot.on('guildRoleUpdate', function(Oldrole, Newrole) {
    if (Newrole.name.toLowerCase() == 'dj') {
        bot.deleteRole({
            serverID: '428702206078746634',
            roleID: Newrole.id
        });
    }
});

bot.on('messageReactionAdd', function(reaction) {
    console.log(reaction.d.emoji.name);
    console.log(reaction.d.message_id);
    if (reaction.d.emoji.name == '📌') {
        if (pinCount.find(p => p[1] == reaction.d.message_id) == null) {
            pinCount.push([1, reaction.d.message_id, []]);
            pinCount[pinCount.length - 1][2].push(reaction.d.user_id);
            console.log(pinCount);
        } else if (!pinCount.find(p => p[1] == reaction.d.message_id)[2].includes(reaction.d.user_id)) {
            if (pinCount.find(p => p[1] == reaction.d.message_id)[0] == 1) {
                bot.pinMessage({
                    channelID: reaction.d.channel_id,
                    messageID: reaction.d.message_id
                });
                pinCount[pinCount.indexOf(pinCount.find(p => p[1] == reaction.d.message_id))] = null;
            } else {
                pinCount.find(p => p[1] == reaction.d.message_id)[0] += 1;
                pinCount.find(p => p[1] == reaction.d.message_id)[2].push(reaction.d.user_id);
            }
        }
    }
});

//Message handling
bot.on('message', function(user, userID, channelID, message, evt) {
    evt.d.attachments.forEach((embed) => {
        if (embed.url)
            console.log(user + ': ' + embed.url);
    });
    if (message != '') console.log(user + ': ' + message);
    try {
        if (lockDown[0].includes(channelID) && !findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
            bot.deleteMessage({
                channelID,
                messageID: evt.d.id
            });
        }
    } catch (er) {}

    if (waitFor[0] && waitFor[1] == userID) {
        var hasRecord = false;
        if (waitFor[2] == 'i') {
            if (evt.d.content == "") {
                evt.d.attachments.forEach((img) => {
                    if (img.url != null) {
                        if (remembering.length > 0) {
                            for (var i = 0; i < remembering.length; i++) {
                                if (remembering[i][0] == userID) {
                                    remembering[i][1].push('/$/' + img.url);
                                    hasRecord = true;
                                }
                            }
                            if (!hasRecord) {
                                remembering.push([userID, ['/$/' + img.url]]);
                            }

                        } else {
                            remembering.push([userID, ['/$/' + img.url]]);
                        }
                        waitFor = [false, "", ""];
                        bot.sendMessage({
                            to: channelID,
                            message: "Your vault has been updated."
                        });
                    }
                });
            } else {
                waitFor = [false, "", ""];
                bot.sendMessage({
                    to: channelID,
                    message: "Image upload cancelled."
                });
            }
        } else if (waitFor[2] == 'b') {
            if (evt.d.content != "") {
                if (remembering.length > 0) {
                    for (var i = 0; i < remembering.length; i++) {
                        if (remembering[i][0] == userID) {
                            remembering[i][1].push('/@/' + evt.d.content);
                            hasRecord = true;
                        }
                    }
                    if (!hasRecord) {
                        remembering.push([userID, ['/@/' + evt.d.content]]);
                    }

                } else {
                    remembering.push([userID, ['/@/' + evt.d.content]]);
                }
                waitFor = [false, "", ""];
                bot.sendMessage({
                    to: channelID,
                    message: "Your vault has been updated."
                });
            } else {
                waitFor = [false, "", ""];
                bot.sendMessage({
                    to: channelID,
                    message: "Block upload cancelled."
                });
                console.log(evt.d.content);
            }
        } else if (waitFor[2] == 'v') {
            waitFor = [false, "", ""];
            bot.addReaction({
                channelID: channelID,
                messageID: evt.d.id,
                reaction: "👍"
            });
            setTimeout(() => {
                bot.addReaction({
                    channelID: channelID,
                    messageID: evt.d.id,
                    reaction: "👎"
                });
            }, 800);
        }
    }
    if (userID == '365975655608745985' && stealPoke) {
        try {
            var imageURL;
            evt.d.embeds.forEach((embed) => {
                if (embed.image.url != null) {
                    imageURL = embed.image.url;
                    imageURL = imageURL.slice(0, -4);
                    if (embed.title == 'A wild pokémon has appeared!') {
                        for (var i = imageURL.length - 1; i >= 0; i--) {
                            if (imageURL.charAt(i) == imageURL.charAt(i).toUpperCase()) {
                                if (imageURL.charAt(i - 1) == '-') {
                                    i--;
                                } else {
                                    imageURL = imageURL.slice(i);
                                    break;
                                }
                            }
                        }
                        bot.sendMessage({
                            to: '175711685682659328',
                            message: 'p!catch ' + imageURL + ' in channel #' + Object.values(bot.channels).find(c => c.id == channelID).name + " in server " + Object.values(bot.servers).find(s => Object.values(s.channels).find(c => c.id == channelID)).name
                        });
                        setTimeout(function() {
                            bot.getMessages({
                                channelID: channelID
                            }, (e, a) => {
                                var i = 0;
                                for (var v of a) {
                                    if (v.author.id == '365975655608745985' && i < 2) {
                                        bot.deleteMessage({
                                            channelID,
                                            messageID: v.id
                                        });
                                        i++
                                    }
                                }
                            });
                        }, 100);
                    }
                }
            });
        } catch (err) {
            console.log(err);
        }
    }

    // Our bot needs to know if it will execute a command
    // It will listen for messages that will start with `!`
    if (message.substring(0, 2) == 'b!' && (!isDeaf || userID == '175711685682659328')) {
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
            case 'bday':
                if (userID == '175711685682659328') {
                    bot.deleteMessage({
                        channelID,
                        messageID: evt.d.id
                    });
                    setTimeout(() => {
                        bot.sendMessage({
                            to: channelID,
                            message: ":balloon::star2::cake: Happy birthday snerpy! :cake::star2::balloon:"
                        })
                    }, 1000);
                    bot.sendMessage({
                        to: channelID,
                        embed: {
                            "image": {
                                "url": "https://media.giphy.com/media/JBBq4FCnpy3q8/giphy.gif"
                            }
                        }
                    });
                }
                break;
            case 'define':
                var Sstring = args.slice(1).join(' ');
                bot.sendMessage({
                    to: channelID,
                    message: ((bot.channels[channelID].nsfw) ? "https://www.urbandictionary.com/define.php?term=" : "https://www.merriam-webster.com/dictionary/") + Sstring.replace(/ /g, '%20')
                });
                break;
            case 'poll':
                try {
                    if (args[1] == 'vote') {
                        if (pollHolder[channelID][1].includes(userID)) {} else {
                            pollHolder[channelID][0][args[2] - 1][1] += 1;
                            args = pollHolder[channelID][0][pollHolder[channelID][0].length - 2];
                            var Sstring = '';
                            var title = args.slice(1).join(' ').split(':')[0];
                            for (var i = 0; i < args.join(' ').split('|').length; i++) {
                                Sstring += '[' + (i + 1) + '] ' + pollHolder[channelID][0][i][0] + ' - ' + pollHolder[channelID][0][i][1] + ' votes\n\n';
                            }
                            bot.editMessage({
                                channelID: channelID,
                                messageID: pollHolder[channelID][0][pollHolder[channelID][0].length - 1],
                                embed: {
                                    "title": title,
                                    "description": Sstring,
                                    "footer": {
                                        "text": "This is a poll. Type b!poll vote <# selection> to vote."
                                    }
                                }
                            });
                            pollHolder[channelID][1].push(userID);
                        }
                    } else {
                        pollHolder[channelID] = [
                            [],
                            []
                        ];
                        if (args.join(' ').split(':')[1].split('|').length <= 10) {
                            var Sstring = '';
                            var title = args.slice(1).join(' ').split(':')[0];
                            for (var i = 0; i < args.join(' ').split('|').length; i++) {
                                pollHolder[channelID][0].push([args.join(' ').split(':')[1].split('|')[i], 0]);
                                Sstring += '[' + (i + 1) + '] ' + pollHolder[channelID][0][i][0] + ' - ' + pollHolder[channelID][0][i][1] + ' votes\n\n';
                            }
                            pollHolder[channelID][0].push(args);
                            bot.deleteMessage({
                                channelID,
                                messageID: evt.d.id
                            });
                            bot.sendMessage({
                                to: channelID,
                                embed: {
                                    "title": title,
                                    "description": Sstring,
                                    "footer": {
                                        "text": "This is a poll. Type b!poll vote <# selection> to vote."
                                    }
                                }
                            }, (err, res) => {
                                pollHolder[channelID][0].push(res.id)
                            });
                        } else {
                            bot.sendMessage({
                                to: channelID,
                                message: "Sorry, there is a maximum of 10 options per poll."
                            });
                            break;
                        }
                    }
                } catch (error) {
                    bot.sendMessage({
                        to: channelID,
                        message: "Sorry, there was an error creating the poll."
                    })
                }
                break;
            case 'vote':
                var Sstring = args.slice(1).join(' ');
                waitFor = [true, bot.id, 'v'];
                bot.deleteMessage({
                    channelID,
                    messageID: evt.d.id
                });
                bot.sendMessage({
                    to: channelID,
                    message: "**Vote by <@!" + userID + ">:** *" + Sstring + "*"
                });
                break;
            case 'help':
                //help info
                var helpInfo = [
                    ['b!help [<page #>]', 'Makes this panel open, put in a specific page as an optional parameter'],
                    ['b!ping', "Lets you test how fast the bot's server can respond to you without imploding"],
                    ['b!spin', 'Spins the bottle, landing on a random user in the server'],
                    ['b!kiss [<mention>]', 'Makes you kiss whoever you mention, or blow a kiss without a mention!'],
                    ['b!behead <mention>', 'Beheads whoever is mentioned', true],
                    ['b!vote <what to vote on>', 'Lets people vote on a topic using bot-provided thumbs-up and thumbs-down reactions'],
                    ['b!succ [<mention>]', 'Gives whoever you mentioned the succ, try it without a mention!'],
                    ['b!purge <mention|all> <# of msgs to delete>', "removes a certain number of messages from the current channel either from a mentioned user or from anyone", true],
                    ["b!nut [<mention>]", "Allows for you to show your raw passion for someone by brutally nutting on them!"],
                    ["b!echo <anything to say>", "Defile the bot by making it say whatever horrible things you have planned", true],
                    ["b!pebnis [<mention>]", "Uses the bot's patented Pebnis™ equation to figure out the length of your or a mentioned user's pebnis!"],
                    ["b!remember <phrase>", "Lets you add data to your own secure vault that you can retrieve at any time later!"],
                    ["b!remember [get [i|b|p]|slice <# of reminder to slice>|clear|time <hours>:<minutes> <phrase>|block|private]", "Get: Retrieves your vault data, optional second parameter p will send reminder list over DM for privacy.\n--- Slice: Removes a piece of data from your vault specified using the emboldened numbers\n--- Clear: Removes *ALL DATA* from your vault, be careful with this!\n--- Time: DMs you a reminder after a specified amount of time. You can cancel the reminder my deleting it.\n--- Block: Allows you to remember a code block."],
                    ["b!warn [all] <what to warn>", "Puts a warning of your choice into the current channel or all channels", true],
                    ["b!lockdown [all|end]", "Closes down the current channel or ALL channels from non-admin users, can be toggled off with end keyword", true],
                    ["b!poll <title of poll>:<option 1>|[<option 2>|<option 3>|....]", "Starts a poll with the specified title offering a variety of options of your choice. Maximum of 10 options."],
                    ["b!define <word>", "defines a word using Merriam Webster or Urban Dictionary if the channel is NSFW"],
                    ["b!selfrole [modify] <role name>:<color code>[:true]", "lets you give yourself or modify a role with a specified color, select and copy your color code from https://www.webpagefx.com/web-design/color-picker/ (color code is the number next to the # above the color picker)\nOptional 3rd parameter allows for you to say whether or not the role is shown separately on the sidebar - off by default"],
                    ["b!selfrole remove <role name>", "remove a role from yourself"],
                ];

                if (args[1] == null) {
                    var helpText = "```diff\n--- All commands start with b!\n--- anything enclosed in <> is a parameter\n--- anything enclosed in [] is optional\n+ commands are available to anyone\n- commands are admin only\n\n";
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
            case 'purge':
                if (args[2] != null && (findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID) || args[1].includes(userID))) {
                    if (args[2] > 50) {
                        bot.sendMessage({
                            to: channelID,
                            message: "Maximum purge amount is 50."
                        });
                        break;
                    }
                    if (args[1] != 'all') {
                        if (args[1].length == 21)
                            cmd = args[1].slice(2, -1);
                        else
                            cmd = args[1].slice(3, -1);
                    }
                    if (args[1] == 'all' && !findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
                        break;
                    }
                    var i = 0;
                    bot.getMessages({
                        channelID: channelID
                    }, (e, a) => {
                        a.forEach((m) => {
                            if (((args[1] != 'all') ? m.author.id == cmd || (m.author.id == userID && i == 0) : true == true) && i <= 50 && i <= args[2]) {
                                setTimeout(() => {
                                    bot.deleteMessage({
                                        channelID,
                                        messageID: m.id
                                    }, (err) => {
                                        if (err) console.log(err);
                                    });
                                }, 800 * (i + 1));
                                i++;
                            }
                        })
                    });
                }
                break;
            case 'pt':
                if (userID == '175711685682659328') {
                    stealPoke = !stealPoke;
                    bot.sendMessage({
                        to: channelID,
                        message: 'Pokésteal is now ' + ((stealPoke) ? 'ON' : 'OFF')
                    });
                }
                break;
            case 'deafen':
                if (userID == '175711685682659328') {
                    isDeaf = !isDeaf;
                    message: "Deaf mode " + ((isDeaf) ? "deactivated." : "activated.")
                }
                break;
            case 'warn':
                if (findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
                    if (args[1] != 'all') {
                        Sstring = args.slice(1).join(' ');
                        bot.sendMessage({
                            to: channelID,
                            embed: {
                                "title": Sstring,
                                "color": 16774656,
                                "image": {
                                    "url": 'https://i2.wp.com/freepngimages.com/wp-content/uploads/2016/10/yellow-caution-sign-health-and-safety.png'
                                }
                            }
                        });
                    } else {
                        Sstring = args.slice(2).join(' ');
                        Object.values(bot.servers[bot.channels[channelID].guild_id].channels).map(c => c.id).forEach(v => {
                            bot.sendMessage({
                                to: v,
                                embed: {
                                    "title": Sstring,
                                    "color": 16774656,
                                    "image": {
                                        "url": 'https://i2.wp.com/freepngimages.com/wp-content/uploads/2016/10/yellow-caution-sign-health-and-safety.png'
                                    }
                                }
                            });
                        });
                    }
                    bot.deleteMessage({
                        channelID,
                        messageID: evt.d.id
                    });
                }
                break;
            case 'lockdown':
                if (findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
                    if (args[1] == 'end') {
                        try {
                            lockDown[0].forEach(v => {
                                bot.sendMessage({
                                    to: v,
                                    embed: {
                                        "title": "All channels have been reactivated.",
                                        "color": 65295,
                                        "image": {
                                            "url": 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Yes_Check_Circle.svg/2000px-Yes_Check_Circle.svg.png'
                                        }
                                    }
                                });
                            });
                        } catch (er) {}
                        lockDown = [];
                    } else if (args[1] != 'all') {
                        bot.sendMessage({
                            to: channelID,
                            embed: {
                                "title": "This channel has been temporarily disabled by an administrator.",
                                "color": 16711710,
                                "image": {
                                    "url": 'https://cdn.pixabay.com/photo/2014/04/02/10/26/attention-303861_1280.png'
                                }
                            }
                        });
                        lockDown = [
                            [channelID]
                        ];
                    } else {
                        Object.values(bot.servers[bot.channels[channelID].guild_id].channels).map(c => c.id).forEach(v => {
                            bot.sendMessage({
                                to: v,
                                embed: {
                                    "title": "All channels have temporarily been disabled by an administrator.",
                                    "color": 16711710,
                                    "image": {
                                        "url": 'https://cdn.pixabay.com/photo/2014/04/02/10/26/attention-303861_1280.png'
                                    }
                                }
                            });
                        });
                        lockDown = [
                            [Object.values(bot.servers[bot.channels[channelID].guild_id].channels).map(c => c.id)]
                        ];
                    }
                }
                bot.deleteMessage({
                    channelID,
                    messageID: evt.d.id
                });
                break;
            case 'brit':
                var Sstring = args.slice(1).join(' ');
                Sstring = Sstring.toLowerCase().replace(/at|ar|aw/g, 'au');
                Sstring = Sstring.replace(/or/g, 'our');
                bot.sendMessage({
                    to: channelID,
                    message: "**Your message translated to britspeak :flag_gb: is:** " + Sstring
                });
                break;
            case 'massmsg':
                if (userID == '175711685682659328' && args[1] != null && findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
                    var Sstring = args.slice(1).join(' ');
                    for (var s of Object.keys(bot.servers)) {
                        try {
                            var channelCounts = Object.keys(bot.servers[s].channels).map(x => bot.channels[x.id].recipients.length);
                            console.log(channelCounts);
                            bot.sendMessage({
                                to: Object.values(bot.channels).find(p => p.recipients.length == Math.max(channelCounts)).id,
                                message: Sstring
                            });
                        } catch (err) {
                            console.log(err)
                        }
                    }
                }
                break;
            case 'echo':
                if (args[1] != null && findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
                    var Sstring = '';
                    for (var i = args[1] != 'id' ? 1 : 3; i < args.length; i++) {
                        Sstring = Sstring.concat(' ', args[i]);
                    }
                    bot.sendMessage({
                        to: args[1] != 'id' ? channelID : args[2],
                        message: Sstring
                    });
                }
                break;
            case 'selfrole':
                var Sstring = args.slice(args[1] == 'remove' || args[1] == 'modify' ? 2 : 1).join(' ');
                if (args[1] != 'remove' && args[1] != 'modify') {
                    if (Sstring.split(':')[0].includes('dj')) {
                        bot.sendMessage({
                            to: channelID,
                            message: "Nice try!"
                        });
                        break;
                    }
                    if (Object.values(bot.servers[bot.channels[channelID].guild_id].roles).map(r => r.name.toLowerCase()).includes(Sstring.split(':')[0].toLowerCase())) {
                        bot.sendMessage({
                            to: channelID,
                            message: "Sorry, that role already exists. Ask an admin to assign it to you?"
                        });
                        break;
                    }
                    try {
                        bot.createRole(bot.channels[channelID].guild_id, (err, res) => {
                            bot.editRole({
                                serverID: bot.channels[channelID].guild_id,
                                roleID: res.id,
                                name: Sstring.split(':')[0],
                                color: '#' + Sstring.split(':')[1].replace(/ /g, ''),
                                hoist: (Sstring.split(':')[2] == 'true') ? true : false
                            });
                            bot.addToRole({
                                serverID: bot.channels[channelID].guild_id,
                                userID: userID,
                                roleID: res.id
                            });
                        });
                    } catch (error) {
                        bot.sendMessage({
                            to: channelID,
                            message: "Sorry, an error happened giving you that role."
                        })
                    }
                } else if (args[1] == 'remove') {
                    try {
                        if (Object.values(bot.servers[bot.channels[channelID].guild_id].members).find(m => m.id == userID).roles.includes(Object.values(bot.servers[bot.channels[channelID].guild_id].roles).find(r => r.name.toLowerCase() == Sstring.split(':')[0].toLowerCase()).id)) {
                            bot.deleteRole({
                                serverID: bot.channels[channelID].guild_id,
                                roleID: Object.values(bot.servers[bot.channels[channelID].guild_id].roles).find(r => r.name.toLowerCase() == Sstring.toLowerCase()).id,
                            });
                        } else {
                            bot.sendMessage({
                                to: channelID,
                                message: "Sorry, but you have to be a member of a role to delete it."
                            })
                        }
                    } catch (err) {
                        bot.sendMessage({
                            to: channelID,
                            message: "Sorry, an error happened trying to remove that role."
                        })
                    }
                } else if (args[1] == 'modify') {
                    try {
                        if (Object.values(bot.servers[bot.channels[channelID].guild_id].members).find(m => m.id == userID).roles.includes(Object.values(bot.servers[bot.channels[channelID].guild_id].roles).find(r => r.name.toLowerCase() == Sstring.split(':')[0].toLowerCase()).id)) {
                            bot.editRole({
                                serverID: bot.channels[channelID].guild_id,
                                roleID: Object.values(bot.servers[bot.channels[channelID].guild_id].roles).find(r => r.name.toLowerCase() == Sstring.split(':')[0].toLowerCase()).id,
                                name: Sstring.split(':')[0],
                                color: '#' + Sstring.split(':')[1].replace(/ /g, ''),
                                hoist: (Sstring.split(':')[2] == 'true') ? true : false
                            });
                        } else {
                            bot.sendMessage({
                                to: channelID,
                                message: "Sorry, but you have to be a member of a role to modify it."
                            });
                        }
                    } catch (error) {
                        bot.sendMessage({
                            to: channelID,
                            message: "Sorry, an error happened trying to modify that role."
                        })
                    }
                }
                break;
            case 'remember':
                if (args[1] != 'clear' && args[1] != 'slice' && args[1] != 'get' && args[1] != 'select' && args[1] != 'time') {
                    var Sstring = '';
                    if (args[1] == 'count') {
                        var i = 0;
                        remembering.forEach((v) => {
                            if (v[1][0] != '') i++
                        });
                        bot.sendMessage({
                            to: channelID,
                            message: "There are currently " + i + " vaults in existance."
                        });
                        break;
                    }
                    if (args[1] != 'image' && args[1] != 'block') {
                        for (var i = 1; i < args.length; i++) {
                            Sstring = Sstring.concat(' ', args[i]);
                        }
                    } else if (args[2] == null && args[1] == 'block') {
                        bot.sendMessage({
                            to: channelID,
                            message: "Please send a block to save, <@!" + userID + ">."
                        });
                        waitFor = [true, userID, 'b'];
                        break;
                    } else if (args[2] != null && args[1] == 'image') {
                        Sstring = '/$/' + args[2];
                    } else {
                        bot.sendMessage({
                            to: channelID,
                            message: "Please send an image file to save, <@!" + userID + ">."
                        });
                        waitFor = [true, userID, 'i'];
                        break;
                    }
                    var hasRecord = false;
                    if (remembering.length > 0) {
                        for (var i = 0; i < remembering.length; i++) {
                            if (remembering[i][0] == userID) {
                                remembering[i][1].push(Sstring);
                                remembering[i][2].push("");
                                hasRecord = true;
                            }
                        }
                        if (!hasRecord) {
                            remembering.push([userID, [Sstring], ""]);
                        }

                    } else {
                        remembering.push([userID, [Sstring], ""]);
                    }
                    bot.sendMessage({
                        to: channelID,
                        message: "Your vault has been updated."
                    });
                } else if (args[1] == 'get') {
                    try {
                        if (args[2] != null && args[2] != 'p') {
                            if (args[2] == 'i') {
                                if (args[3] != null && (args[3] - 1) < imageHolder.length - 1) {
                                    if (imageHolder[imageHolder.length - 1] != userID) {} else {
                                        bot.sendMessage({
                                            to: channelID,
                                            embed: {
                                                "color": Math.floor(Math.random() * 16777215) + 1,
                                                "image": {
                                                    "url": imageHolder[args[3] - 1]
                                                }
                                            }
                                        });
                                    }
                                }
                            } else if (args[2] == 'b') {
                                if (args[3] != null && (args[3] - 1) < imageHolder.length - 1) {
                                    if (imageHolder[imageHolder.length - 1] != userID) {} else {
                                        bot.sendMessage({
                                            to: channelID,
                                            message: imageHolder[args[3] - 1]
                                        });
                                    }
                                }
                            } else if ((args[2] - 1) < pageHolder.length) {
                                if (pageHolder[pageHolder.length - 1] != userID) {} else {
                                    bot.sendMessage({
                                        to: channelID,
                                        embed: {
                                            "color": Math.floor(Math.random() * 16777215) + 1,
                                            "description": pageHolder[args[2] - 1],
                                            "footer": {
                                                "text": "Page " + args[2] + '/' + (pageHolder.length - 1) + ', use "b!remember get <page #>" to switch pages'
                                            }
                                        }
                                    });
                                }
                            }
                        } else {
                            var hasRecord = false;
                            var Sstring = '';
                            var imagecount = 1;
                            imageHolder = [];
                            if (remembering.length > 0) {
                                for (var i = 0; i < remembering.length; i++) {
                                    if (remembering[i][0] == userID) {
                                        if (remembering[i][1].length > 0 && remembering[i][1][0] != null) {
                                            for (var r = 0; r < remembering[i][1].length; r++) {
                                                if (remembering[i][1][r] != null) {
                                                    if (remembering[i][1][r].substring(0, 3) != '/$/' && remembering[i][1][r].substring(0, 3) != '/@/') {
                                                        Sstring = Sstring + '**' + (r + 1) + ':** ' + remembering[i][1][r] + '\n\n';
                                                    } else if (remembering[i][1][r].substring(0, 3) == '/$/') {
                                                        Sstring = Sstring + '**' + (r + 1) + ':** ***This is an image. Type "b!remember get i ' + (imagecount) + '" to view it.***\n\n';
                                                        imageHolder.push(remembering[i][1][r].substring(3));
                                                        imagecount++;
                                                    } else if (remembering[i][1][r].substring(0, 3) == '/@/') {
                                                        Sstring = Sstring + '**' + (r + 1) + ':** ***This is a block. Type "b!remember get b ' + (imagecount) + '" to view it.***\n\n';
                                                        imageHolder.push(remembering[i][1][r].substring(3));
                                                        imagecount++;
                                                    }
                                                }
                                            }
                                            if (imageHolder[0] != null) {
                                                imageHolder.push(userID);
                                            }
                                            if (Sstring.length < 2000) {
                                                bot.sendMessage({
                                                    to: (args[2] != 'p') ? channelID : userID,
                                                    embed: {
                                                        "title": user + "'s reminders:",
                                                        "color": Math.floor(Math.random() * 16777215) + 1,
                                                        "description": Sstring
                                                    }
                                                });
                                                hasRecord = true;
                                            } else {
                                                for (var i = 2000; i < Sstring.length; i += 2000) {
                                                    Sstring = spliceSlice(Sstring, i - 1, '#$#');
                                                }
                                                pageHolder = Sstring.split('#$#');
                                                pageHolder.push(userID);
                                                bot.sendMessage({
                                                    to: (args[2] != 'p') ? channelID : userID,
                                                    embed: {
                                                        "title": user + "'s reminders:",
                                                        "color": Math.floor(Math.random() * 16777215) + 1,
                                                        "description": pageHolder[0],
                                                        "footer": {
                                                            "text": "Page 1/" + (pageHolder.length - 1) + ', use "b!remember get <page #>" to switch pages'
                                                        }
                                                    }
                                                });
                                                hasRecord = true;
                                            }
                                        }
                                    }
                                }
                            }
                            if (!hasRecord) {
                                bot.sendMessage({
                                    to: channelID,
                                    message: 'No reminders found for your user!'
                                });
                            }
                        }
                    } catch (error) {
                        console.log(error);
                    }
                } else if (args[1] == 'slice') {
                    try {
                        for (var i = 0; i < remembering.length; i++) {
                            if (remembering[i][0] == userID) {
                                remembering[i][1].splice(args[2] - 1, 1);
                                remembering[i][2].splice(args[2] - 1, 1);
                                bot.sendMessage({
                                    to: channelID,
                                    message: 'Reminder ' + args[2] + ' has been removed.'
                                });
                                break;
                            }
                        }
                    } catch (err) {
                        bot.sendMessage({
                            to: channelID,
                            message: 'No such reminder value!'
                        });
                    }
                } else if (args[1] == 'clear') {
                    try {
                        for (var i = 0; i < remembering.length; i++) {
                            if (remembering[i][0] == userID) {
                                remembering[i][1].splice(0);
                                remembering[i][2].splice(0)
                                bot.sendMessage({
                                    to: channelID,
                                    message: 'Your reminders have been cleared.'
                                });
                                break;
                            }
                        }
                    } catch (err) {
                        bot.sendMessage({
                            to: channelID,
                            message: 'Cannot find your reminders. Did you have any?'
                        });
                    }
                } else if (args[1] == 'time') {
                    try {
                        Sstring = args.slice(3).join(' ');
                        if (remembering.length > 0) {
                            for (var i = 0; i < remembering.length; i++) {
                                if (remembering[i][0] == userID) {
                                    remembering[i][1].push(Sstring);
                                    hasRecord = true;
                                }
                            }
                            if (!hasRecord)
                                remembering.push([userID, [Sstring], []]);
                        else
                            remembering.push([userID, [Sstring], []]);
                        }
                        bot.sendMessage({
                            to: channelID,
                            message: "Your vault has been updated. I will remind you in " + args[2].split(':')[0] + " hours and " + args[2].split(':')[1] + " minutes."
                        });
                        for (var i = 0; i < remembering.length; i++) {
                            if (remembering[i][0] == userID) {
                                var num = i;
                                var toTime = remembering[i][1].length - 1;
                                var content = Sstring;
                                var date = new Date();
                                date.setMinutes(date.getMinutes() + (parseInt(args[2].split(':')[0] * 60) + parseInt(args[2].split(':')[1])));
                                console.log("future date is " + date);
                                remembering[i][2].push([date, remembering[num][1][toTime], content, userID]);
                                runAtDate(date, () => {
                                    if (remembering[num][1][toTime] == content)
                                        bot.sendMessage({
                                            to: userID,
                                            message: remembering[num][1][toTime]
                                        })
                                });
                            }
                        }
                    } catch (err) {
                        bot.sendMessage({
                            to: channelID,
                            message: "Error setting timed reminder."
                        });
                        console.log(err);
                    }
                }
                break;
            case 'backup':
                if (userID == '175711685682659328') {
                    rememberDB(false);
                    bot.sendMessage({
                        to: channelID,
                        message: 'Backed up ' + remembering.length + ' vaults.'
                    });
                }
                break;
            case 'recover':
                if (userID == '175711685682659328') {
                    rememberDB(true);
                    setTimeout(() => {
                        bot.sendMessage({
                            to: channelID,
                            message: 'Recovered ' + remembering.length + ' vaults.'
                        });
                    }, 1000);
                }
                break;
            case 'namechange':
                if (userID == '175711685682659328')
                    bot.editUserInfo({
                        username: args.slice(1).join(' ')
                    });
                break;
            case 'nut':
                cmd = args[1];
                if (cmd == null)
                    bot.sendMessage({
                        to: channelID,
                        message: user + ' nutted all over the place! :eggplant:'
                    });
                else if (cmd.includes("417093667778723840"))
                    bot.sendMessage({
                        to: channelID,
                        message: "oOOOObabby DELICHIS snack:yum::yum::yum::weary::weary::raised_hands::raised_hands:"
                    });
                else if (cmd.includes(userID))
                    bot.sendMessage({
                        to: channelID,
                        message: '<@!' + userID + '>' + " nutted on... oh my." + ' :flushed:'
                    });
                else 
                    bot.sendMessage({
                        to: channelID,
                        message: user + " nutted all over " + cmd + '! :eggplant:'
                    });
                break;
            case 'spin':
                let count = bot.servers[bot.channels[channelID].guild_id].members.length
                let spins = 0;
                let rnd = Math.floor(Math.random() * count + 1);
                for (var u in bot.servers[bot.channels[channelID].guild_id].members) {
                    if (spins == rnd) {
                        bot.sendMessage({
                            to: channelID,
                            message: '<@!' + userID + '>, ' + 'you must kiss ' + '<@' + u + '>!'
                        });
                    }
                    if (user == "Bin") {
                        bot.sendMessage({
                            to: channelID,
                            message: '<@!' + userID + '>, ' + 'you must kiss ' + '<@!304831916333465602>!'
                        });
                        break;
                    }
                    if (userID == "304831916333465602") {
                        bot.sendMessage({
                            to: channelID,
                            message: '<@!' + userID + '>, ' + 'you must kiss ' + '<@!175711685682659328>!'

                        });
                        break;
                    }
                    if (userID == "394358493580361730") {
                        bot.sendMessage({
                            to: channelID,
                            message: '<@!' + userID + '>, ' + 'you must kiss ' + '<@!175711685682659328>!'

                        });
                        break;
                    }
                    spins++;
                }
                break;
            case 'status':
                if (args[1] == "default")
                    bot.setPresence({
                        game: {
                            name: "b!help | " + (Object.keys(bot.servers).length) + " servers"
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
            case 'kiss':
                cmd = args[1];
                if (!cmd)
                    bot.sendMessage({
                        to: channelID,
                        message: '<@!' + userID + '>' + " blew a kiss!"
                    });
                else if (cmd.includes("417093667778723840"))
                    bot.sendMessage({
                        to: channelID,
                        message: user + " kissed... me!?" + " :blush:"
                    });
                else if (args[2]) {
                        var person = cmd;
                        cmd = args[2];
                        if (cmd == "nohomo") {
                            bot.sendMessage({
                                to: channelID,
                                message: user + " kissed " + person + "! :kiss: (no homo tho miss me with that gay shit)"
                            })
                            break;
                        }
                    }
                    bot.sendMessage({
                        to: channelID,
                        message: user + " kissed " + cmd + "! :kiss:"
                    });
                break;
            case 'succ':
                if (!args[2]) {
                    if (!args[1])
                        bot.sendMessage({
                            to: channelID,
                            message: user + " gave themselves the succ... geez " + '<@!' + userID + ">, you must be awfully flexible!"
                        });
                    else
                        bot.sendMessage({
                            to: channelID,
                            message: user + " gave " + args[1] + " the succ!" + ' :triumph: :sweat_drops: :weary:'
                        });
                }
                else if (args[2] == "toes" && userID == 394358493580361730)
                        bot.sendMessage({
                            to: channelID,
                            message: user + " sucked " + args[1] + "'s toes!" + ' :triumph: :open_mouth:'
                        });
                    else if (args[2] == "toes")
                        bot.sendMessage({
                            to: channelID,
                            message: 'Sorry, ' + user + ', but only <@!394358493580361730> can suck toes!'
                        });
                break;
            case 'dab':
                if (cmd == null)
                    bot.sendMessage({
                        to: channelID,
                        message: '<:dab:413205300536147969>'
                    });
                else
                    bot.sendMessage({
                        to: channelID,
                        message: user + " dabbed on " + args[1] + "!" + ' <:dab:413205300536147969>'
                    });
                break;
            case 'pebnis':
                try {
                    var pebnisvar = "=";
                    cmd = args[1];
                    if (cmd == null) {
                        pebnisvar = generatepebnis(user, userID);
                        bot.sendMessage({
                            to: channelID,
                            message: '<@!' + userID + ">'s pebnis size is [8" + pebnisvar + 'D]!'
                        });
                    } else {
                        if (args[1].length == 21)
                            cmd = args[1].slice(2, -1);
                        else
                            cmd = args[1].slice(3, -1);

                        var uname = Object.values(bot.users).find(m => m.id == cmd).username;
                        pebnisvar = generatepebnis(uname, cmd);
                        bot.sendMessage({
                            to: channelID,
                            message: '<@!' + cmd + ">'s pebnis size is [8" + pebnisvar + 'D]!'
                        });
                    }
                } catch (err) {
                    sendError(channelID, err);
                }
                break;
            case 'behead':
                cmd = args[1];
                if (cmd != null && findRole(Discord.Permissions.GENERAL_ADMINISTRATOR, channelID, userID)) {
                    bot.sendMessage({
                        to: channelID,
                        message: !args[1].includes(userID) ? cmd + " has been beheaded by " + '<@!' + userID + '>! :dizzy_face: :skull:' : "Holy shit! <@!" + userID + "> just decapitated themselves! :open_mouth:"
                    });
                }
                break;
        }
    } else if (message.includes('417093667778723840') && !userID.includes('417093667778723840')) bot.sendMessage({
        to: channelID,
        message: '<@!' + userID + '>, why you pinging me bitch?'
    });

    function generatepebnis(user, userID) {
        if ((userID.includes('8') | userID.includes('2')) && (userID.includes('7') | userID.includes('4')))
            var rnd = user.length * (((userID.split('8').length - 1) <= 0) ? (userID.split('2').length - 1) : (userID.split('8').length - 1)) / (((userID.split('7').length - 1) <= 0) ? (userID.split('4').length - 1) : (userID.split('7').length - 1));
        else if ((userID.includes('8') | userID.includes('2')) && (userID.includes('6') | userID.includes('9')))
            var rnd = user.length * (((userID.split('8').length - 1) <= 0) ? (userID.split('2').length - 1) : (userID.split('8').length - 1)) / (((userID.split('6').length - 1) <= 0) ? (userID.split('9').length - 1) : (userID.split('6').length - 1));
        
        var pebnis = "";
        while (pebnis.length < rnd)
            pebnis += "=";
        
        return pebnis;
    }

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
