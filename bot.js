//Set globals
var Discord = require('discord.io');
var logger = require('winston');
var MongoClient = require('mongodb').MongoClient; //Get database functions
var isDeaf = false;
var pageHolder = [];
var lastMsg;
var userData = {};
var items = {
  'times5': {
  'expireTime': 60, //time from buying to expire in minutes
    'function': (points) => {return points*5}, //function to be run on points 
    'uses': 0,
    'price': 500, //price of item in points
    'displayData': {'name':"5x earn rate",'description':"increases your point earning rate 5x for 60 minutes."} //data used in store page 
  },
  'times10': {
   'expireTime': 30,
    'function': (points) => {return points[2]*10},
    'uses': 0,
    'price': 1500,
    'displayData': {'name':"10x earn rate",'description':"increases your point earning rate 10x for 30 minutes."}
    },
  'admin': {
   'expireTime': 1,
    'function': (points) => {return points[2]},
    'uses': 0,
    'price': 1000000000,
    'displayData': {'name':"Admin privileges",'description':"lets you do whatever you want"}
    },
  'banana': {
   'expireTime': 0,
    'function': (points) => {bot.sendMessage({to:points[0],embed:{"image":{"url":"https://previews.123rf.com/images/atoss/atoss1206/atoss120600044/14033487-one-banana-on-white-background.jpg"}}});return points[2];},
    'uses': 1,
    'price': 100,
    'displayData': {'name':"banana",'description':"yes"}
    }
}

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
const uri = "mongodb+srv://bin:" + process.env.MONGO_PASS + "@pointdata-xx892.mongodb.net/test";

function pointDB(reading) {
    MongoClient.connect(uri, function(err, cli) {
        if (err)
            console.log(err);
        var collection = cli.db("test").collection("points");
        if (reading) {
            collection.find({}).toArray(function(er, result) {
              for (var r of result) {
                if (r.points)
               userData[r.id].points = r.points;
                if (r.purchasedItems)
                userData[r.id].purchasedItems = r.purchasedItems;
               if (r.expireTimes)
                userData[r.id].expireTimes = r.expireTimes;
              }
        });
        } else {
          collection.drop(function(err, delOK) {
                if (err) {}
            });
          for (var v of Object.keys(userData)) {
            collection.insert({
               id: v,
               points: userData[v].points,
                purchasedItems: userData[v].purchasedItems,
                expireTimes: userData[v].expireTimes
              });
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
        for (var u in bot.users) {
         userData[u] = {
          points:0,   
          purchasedItems: [],
          expireTimes: []
         }
        }
  pointDB(true);
    bot.setPresence({
        game: {
            name: "p!help | " + (Object.keys(bot.servers).length) + " servers"
        }
    }, console.log);
  setInterval(()=>{
    console.log("Sending userdata to database");
   pointDB(false);
      console.log("Data sent.");  
  },900000);
  setInterval(()=>{
    let now = new Date();
    now = now.getTime();
    for (var u of Object.keys(userData)) {
     for (var times of userData[u].expireTimes) {
       if (!items[times['item']]) continue;
      if ((times['date']+(items[times['item']].expireTime*60000))<=now) {
        userData[u].purchasedItems.splice(userData[u].purchasedItems.indexOf(userData[u].expireTimes.find(t=>t.item=times['item'])),1);
        userData[u].expireTimes.splice(userData[u].expireTimes.indexOf(times),1);
       bot.sendMessage({to:u,message:"Your " + items[times['item']].displayData['name'] + " upgrade has expired. Buy a new one!"}); 
      }
       else console.log(u + "'s upgrade is ok");
     }
    }
  },60000);
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

function addPoint(channelID, userID, amount) {
 if (amount===undefined) amount=1;
  let itemList = userData[userID].purchasedItems;
  for (let i of Object.keys(items)) {
    for (var o of itemList) {
   if (o.item.includes(i)) {
    amount = items[i].function([channelID,userID,amount]);
    if (itemList.find(n=>n.item==i).uses==1)
      itemList.splice(itemList.indexOf(itemList.find(it=>it.item==i)),1);
     else if (itemList.find(n=>n.item==i).uses>1) 
       itemList.find(n=>n.item==i).uses-=1
   }
   }
  }
  userData[userID].points+=amount;
}

function subPoint(userID, amount) {
  userData[userID].points -= amount;
}
//Message handling
bot.on('message', function(user, userID, channelID, message, evt) {
    evt.d.attachments.forEach((embed) => {
        if (embed.url) {
            console.log(user + ': ' + embed.url);
          addPoint(channelID,userID);
        }
    });
    if (message != '') {
      console.log(user + ': ' + message);
      addPoint(channelID,userID);
    }
  
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
                    ['p!help [<page #>]', 'Makes this panel open, put in a specific page as an optional parameter'],
                    ['p!ping', "Lets you test how fast the bot's server can respond to you without imploding"],
                    ['p!points',"Lets you see how many points you currently have"],
                    ['p!shop',"Opens the shop where you can buy various items & upgrades"]
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
                                "text": "Page 1/" + (pageHolder.length - 1) + ', use "p!help <page #>" to switch pages'
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
                                    "text": "Page " + args[1] + "/" + (pageHolder.length - 1) + ', use "p!help <page #>" to switch pages'
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
                    let Sstring = '';
                    for (var i = 1; i < args.length; i++)
                        Sstring = Sstring.concat(' ', args[i]);
                     
                    bot.setPresence({
                        game: {
                            name: Sstring
                        }
                    }, console.log);
                }
                break;
          case 'backup':
            if (userID!='175711685682659328') break; 
            pointDB(false);
            bot.sendMessage({to:channelID,message:"Sent data to database."});
            break;
          case 'points':
            bot.sendMessage({
              to:channelID,
              embed: {
               'title': user + "'s points",
                'description':userData[userID].points
              }
            });
            break
            case 'shop':
            let Sstring = "";
            let c = 1;
            for (let i of Object.keys(items)) {
              Sstring+= c + ': **'+items[i].displayData.name+'**\n   *' + items[i].displayData.description + '*\nPrice: **' + items[i].price + ' points**\n\n';
            c++;
            }
              bot.sendMessage({
                to:channelID,
                embed: {
                 "title":"Shop:",
                  "description":Sstring,
                  "footer":{
                   "text":"p!buy <item #> to buy items" 
                  }
                }
              });
            break;
          case 'buy':
            try {
            if (!args[1]) bot.sendMessage({to:channelID,message:"Please specify a number as the second parameter. (Ex. p!buy 2)"});
            else {
              if (!userData[userID].purchasedItems.includes(Object.keys(items)[args[1]-1])) {
             if (userData[userID].points >= Object.values(items)[args[1]-1].price) {
               subPoint(userID,Object.values(items)[args[1]-1].price);
               userData[userID].purchasedItems.push({'item':Object.keys(items)[args[1]-1],'uses':items[Object.keys(items)[args[1]-1]].uses});
               let now = new Date();
               now = now.getTime();
               if (items[Object.keys(items)[args[1]-1]].expireTime != 0)
               userData[userID].expireTimes.push({'item':Object.keys(items)[args[1]-1],'date':now});
               bot.sendMessage({to:channelID,message:"Item purchased successfully."});
             }
              else bot.sendMessage({to:channelID,message:"You need " + (Object.values(items)[args[1]-1].price-userData[userID].points) + " more points to buy that item"});
              }
              else bot.sendMessage({to:channelID,message:"You already own this item!"});
              }
            } catch (error) {
              bot.sendMessage({to:channelID,message:"Error buying item."})
              console.log("Buying error:\n" + error);
            }
            break;
          case 'add':
            if (userID!='175711685682659328') break;
            addPoint(channelID,args[1]=='me'?userID:args[1],parseInt(args[2]));
            break;
          case 'sub':
             if (userID!='175711685682659328') break;
            subPoint(args[1]=='me'?userID:args[1],parseInt(args[2]));
            break;
          case 'getdata':
            if (userID!='175711685682659328') break;
            console.log(userData);
            break;
          case 'set':
          if (userID!='175711685682659328') break;
            let data = userData[args[1]=='me'?userID:args[1]];
            switch(args[2]) {
              case 'points':
                data.points = parseInt(args[3]);
                break;
              case 'items':
                data.purchasedItems = args[3].split(',');
                break;
              case 'expires':
                data.expireTimes = args[3].split(',');
                break;
            }
            break;
                }}});

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
