# Chat example

This is a copy of the socket.io [chat example](https://github.com/LearnBoost/socket.io/tree/master/examples/chat) with commented modifications using red-socket

Modifications to original socket.io example commented below:

# Server-side code

    /**
     * Module dependencies.
     */

    var express = require('express')
      , stylus = require('stylus')
      , nib = require('nib')
      , sio = require('socket.io')

Define red-socket object

      , RedSocket = require('../../index');



    /**
     * App.
     */

    var app = express.createServer();

    /**
     * App configuration.
     */

    app.configure(function () {
      app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }));
      app.use(express.static(__dirname + '/public'));
      app.set('views', __dirname);
      app.set('view engine', 'jade');

      function compile (str, path) {
        return stylus(str)
          .set('filename', path)
          .use(nib());
      };
    });

    /**
     * App routes.
     */

    app.get('/', function (req, res) {
      res.render('index', { layout: false });
    });

    /**
     * App listen.
     */

    app.listen(3000, function () {
      var addr = app.address();
      console.log('   app listening on http://' + addr.address + ':' + addr.port);
    });

    /**
     * Socket.IO server (single process only)
     */

    var io = sio.listen(app);

Define RedSocket instance and put nicknames in a Redis set. Nicknames need to be shared between processes.

    //OLD:  , nicknames = {};

    var rsr = RedSocket(io,{debug: true});
    var nicknames = new rsr.Sets("nicknames");

Use rsr.on instead of io.on

    rsr.on('connection', function (socket) {
      socket.on('user message', function (msg) {
        //socket.broadcast.emit('user message', socket.nickname, msg);
        socket.r_broadcast_emit('user message', socket.nickname, msg);
      });

      socket.on('nickname', function (nick, fn) {
        // if (nicknames[nick]) {
        //   fn(true);
        // } else {
        //   fn(false);
        //   nicknames[nick] = socket.nickname = nick;
        //   socket.broadcast.emit('announcement', nick + ' connected');
        //   io.sockets.emit('nicknames', nicknames);
        // }

Use socket.r_broadcast_emit() instead of socket.broadcast.emit.
Then use the Redis set helper to get members of the nicknames set and use rsr.r_emit() instead of io.sock Then use rsr.r_emit() instead of io.sockets.emit().

        nicknames.add(nick,true,function(is_new) {
          fn(!is_new);
          if (is_new) {
            // OLD: nicknames[nick] = socket.nickname = nick;
            socket.nickname = nick;
            //OLD: socket.broadcast.emit('announcement', nick + ' connected');
            socket.r_broadcast_emit('announcement', nick + ' connected');
            //OLD: io.sockets.emit('nicknames', nicknames);
            nicknames.get_members(function(members) {
              rsr.r_emit('nicknames', members);
            });
            }
        });
      });

      socket.on('disconnect', function () {
        if (!socket.nickname) return;

        // OLD: delete nicknames[socket.nickname];
        nicknames.delete(socket.nickname);
        // OLD: socket.broadcast.emit('announcement', socket.nickname + ' disconnected');
        socket.r_broadcast_emit('announcement', socket.nickname + ' disconnected');
        // OLD: socket.broadcast.emit('nicknames', nicknames);
        nicknames.get_members(function(members) {
          socket.r_broadcast_emit('nicknames', members);
        });
      });
    });
