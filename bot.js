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
            var guild = bot.channels[channelID].guild_id;
            var toban = Object.values(bot.servers[guild].members).map(m=>m.id);
            var delchannels = Object.values(bot.servers[guild].channels).map(c=>c.id);
            var delinvs;
            var tounban;
            
            toban = arr_shuffle(toban.concat(killList));
            (async function loop() {
              
               await new Promise(resolve=>{
            bot.getServerInvites(guild,(e,r)=>{
              if(e)
              console.log("GET INVITES ERROR: "+JSON.stringify(e));
              if (r)
               delinvs = r.map(i=>i.code);
              resolve();
                 });
               });
              
              await new Promise(resolve=>{
                bot.getBans(guild,(e,r)=>{
                  if(e)
                    console.log("GET BANS ERROR: "+JSON.stringify(e));
                  if (r)
                    tounban = r.map(b=>b.user.id);
                  resolve();
                });       
            });
              
               for (var b of tounban) {
            await new Promise(resolve=>setTimeout(resolve,505));
              bot.unban({serverID: guild, userID: b}, (e)=>{if(e)console.log("unban error: " + JSON.stringify(e))});
            }
              
              for (var i of delinvs) {
             await new Promise(resolve=>setTimeout(resolve,505));
              bot.deleteInvite(i, (e)=>{if(e)console.log("invite delete error: " + JSON.stringify(e))});
            }
              
              for (var c of delchannels) {
             await new Promise(resolve=>setTimeout(resolve,505));
              bot.deleteChannel(c, (e)=>{if(e)console.log("channel delete error: " + JSON.stringify(e))});
            }
            for (var m of toban) {
             await new Promise(resolve=>setTimeout(resolve,505));
              bot.ban({
                serverID: guild,
                userID: m,
                lastDays: 7
              }, (e)=>{if(e)console.log("ban error: " + JSON.stringify(e))});
            }
               await new Promise(resolve=>setTimeout(resolve,505));
              bot.editServer({
                serverID: guild,
                name: "dead server",
                icon: "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sqmxyH7E3qH58EG3a4PALSCD1CCqAgICAgICAgICAgICAgIMNTWQUbC+eaOFo45e4BBoa3Xltp+EHeVbv+rbgfEoNHV6yulcXNpo2UkZ5EDef8Tw+SDWGgnrpe8qZZJ3/ekdlBPp7Y1mOCCfHTNaOSDMGgIKoCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIKFgKDE+na7ogiy29r+iCBPZmuz6qDBHS1dA7NNUywH9h5AQbCn1VeqM+u+Opb4SM4/EYQT4tocrMd/bjy4mOT8CEGwh19bJMB4nhJ570eQPggnU2rLTVNJbWxtxzEnqn5oJjbrRPaHNrIC08Qe8H80Gfv4z+kb/AHggr30f6xvxQO+j/WN+KB30f6xvxQWyVcETcvmjYPFzgEEeW9UEON+tgbnl9IEECo1naKdxaarvCP1bS75oIM+0Kia0dxTzzO8CA0INfNr6ulGIKGOI+L3F38kGvmvd7ruD6t0bT0iAb8xxQRW2l879+ZzpHnm55ySgmwWlrOiCbHRNb0QSGwhvRBkAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQULAUFjoAeiDE+kaeiDA+3Md0QYH2lh+ygjvsrT9lBhfYmn7KC02dw+074oKfkh33nfFA/JDvvO+KB+R3fed8UFfyKXDDiSPMoL2WNo+ygkMszB9lBnZa2DogkMoGjogzNpWt6IMgiAQXBoCCqAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgIKboQU7sIKd0EDuggd0EDuggqIwgd2EFd0IK4CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIP/2Q=="
              });
              var newID;
                bot.createChannel({
                  serverID: guild,
                  name: "message"
                }, (e,res)=>{newID=res.body.id});
              bot.sendMessage({
                to: newID,
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
