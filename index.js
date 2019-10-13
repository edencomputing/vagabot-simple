//Load required classes.
const { Servers } = require('alta-jsapi');
const { WebsocketBot } = require('att-bot-core');
const Discord = require('discord.js');
const sha512 = require('crypto-js/sha512');
const fs = require('fs');

//Load information from credentials and config
const { username, password, botToken } = require("./credentials");
const discordPrefix = "!";

function strrep( str, n )
{
    if ( n < 1 ) return '';
    var result = str;
    while( n-- > 0 )
    {
        result += str;
    }
    return result;
}

function convertPassToHash( username, password, botToken )
{
    // The SHA512 hash generated by crypto-js/sha512 will be 128 characters
    if ( password.length !== 128 )
    {
        console.log( "Plaintext password encountered, converting to SHA512 hash for permanent storage" );
        newPass = sha512( password ).toString();
        newFile = { "username" : username, "password" : newPass, "botToken": botToken };
        fs.writeFile('./credentials.json', JSON.stringify( newFile, null, 4 ), function( err ) {
            if ( err )
            {
                console.log( err );
            } else {
                console.log( "New credentials.json saved" );
            }
        });
        password = newPass;
    }
    return password;
}

//Command list
const commands = {
    'ping': (message, args) =>
    {
        message.channel.send("pong");
    },

    'servers': async function (message, args)
    {
        var servers = await Servers.getOnline();

        if ( !!servers )
        {
            var longest = 0;
            for( var i in servers )
            {
                if ( servers[i].name.length > longest )
                {
                    longest = servers[i].name.length;
                }
            }

            var serverNameLen = longest + 1;
            var listTable =  "| Servers"+ strrep(' ', (serverNameLen - 7)) +"| Players\n";
                listTable += "|"+ strrep('-', (serverNameLen + 1) ) +"|---------\n";
            for ( var i in servers )
            {
                listTable += "| "+ servers[i].name + strrep(' ', ( serverNameLen - servers[i].name.length )) +"| "+ servers[i].online_players.length +"\n";
            }
        
            message.channel.send( '```'+ listTable +'```' );
                   
        } else {
            message.channel.send("No servers appear to be online, perhaps it's patch day?");
        }
    },

    'players': async function (message, args)
    {
        var servers = await Servers.getOnline();
        var listTable = '';

        while ( args.length && ( args[0].toLowerCase() === "online" || args[0].toLowerCase() === "in" || args[0].toLowerCase() === "on" ) )
        {
            args.shift();
        }

        var mustMatch = args.join(' ');

        for( var i in servers )
        {
            if ( mustMatch )
            {
                var re = new RegExp( mustMatch, 'ig' );
                if ( !servers[i].name.match( re ) )
                {
                    continue;
                }
            }
            listTable += "| "+ servers[i].name +"\n";
            listTable += "|"+ strrep('-', (servers[i].name.length + 1)) +"\n";
                    
            var pOnline = servers[i].online_players;
            for( var n in pOnline )
            {
                listTable += "| "+ pOnline[n].username +"\n";
            }
            listTable += "\n";
        }

        if ( listTable === '' )
        {
            if ( mustMatch )
            {
                message.channel.send('```No server found matching "'+ mustMatch +'"```');
            } else {
                message.channel.send('```No servers were found online, is it patch day?```');
            }
        } else {
            message.channel.send('```'+ listTable +'```');
        }
    }
}

function splitArgs( args )
{
    let spaceChars = '#s#';
    // If an exact match of the space character exists in the string, make it more unique
    while( args.indexOf( spaceChars ) > -1 ) { spaceChars += '|'; }

    // replace spaces which are inside quotes with the spaceChar placeholder
    let mangleargs = args.replace( /"([^"]*)"?/g, ( match, cap ) => {
        return cap.replace(/\s/g, spaceChars );
    });

    // split the padded string on actual spaces
    let newargs = mangleargs.split( /\ +/ );

    // replace the spaceChar in any matching elements with actual spaces
    let reg = new RegExp( spaceChars, 'g' );
    let argarr = newargs.map( ( x ) => { return x.replace( reg, ' ' ); });

    return argarr;
}



//Run the program
main();

async function main()
{
    console.log( "bot is starting" );

    // Convert the password to a hash if necessary
    var mpassword = convertPassToHash( username, password, botToken );

    //Connect to discord
    const discord = new Discord.Client();
    await new Promise( resolve =>
    {
        discord.on('ready', resolve);
        discord.login(botToken);
    });
    
    //Discord command and message management (todo: move to own lib)
    discord.on('message', message =>
    {
        if ( message.content.length > 0 && message.content.startsWith( discordPrefix ) )
        {
            var tmessage = message.content.substring(discordPrefix.length).trim();

            var args = splitArgs( tmessage );

            if ( args && args.length >= 1 )
            {
                var command = args.shift();
                var commandFunction = commands[command];
                if (!!commandFunction)
                {
                    commandFunction(message, args, tmessage);
                }
            }
        }
    });
                    

    //Alta Login
    const bot = new WebsocketBot();
    //Use a hashed password, SHA512
    await bot.loginWithHash(username, mpassword);

}