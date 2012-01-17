var redis = require('redis');


exports = module.exports = Manager;

function Manager(io, options) {
	// Set up options
	// -----------------------------
	this.io = io;
	this.rc = (options && options.redis_client) ? options.redis_client : redis.createClient();
	this.rc_pub = (options && options.redis_client_pub) ? options.redis_client_pub : redis.createClient();
	this.rc_sub = (options && options.redis_client_sub) ? options.redis_client_sub : redis.createClient();
	this.redis_channel = (options && options.redis_channel) ? options.redis_channel : "rs";

	var self = this;

	// Create publish subscribe
	// -----------------------------
	this.rc_sub.subscribe(self.redis_channel);

	this.rc_sub.on("message", function (channel, json) {
		var content = JSON.parse(json);
	});

	this.on = function(msg,cb) {
		self.io.sockets.on(msg,function(socket) {
			if (msg == 'connection') {
				console.log("New connection");
			}
			socket.r_broadcast_emit = function() {
				console.log('r_broadcast_emit');
				socket.broadcast.emit.apply(socket,arguments);
			};
			cb && cb(socket);
		});
	};

	return this;

}