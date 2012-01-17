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
	this.redis_prefix = this.redis_channel + '.';

	var self = this;

	// Set process id
	// -----------------------------
	this.rc.incr(redis_prefix + "processes.counter", function(err,res) {
		if (res)
			this.process_id = parseFloat(res);
		else
			console.log('Redis error: cannot set process id');
	});

	// Create publish subscribe
	// -----------------------------
	this.rc_sub.subscribe(self.redis_channel);

	this.rc_sub.on("message", function (channel, json) {
		// console.log("JSON",JSON.stringify(json));
		var content = JSON.parse(json);
		console.log("Message received",content);
		console.log(content.command);
		switch(content.command) {
			case "r_emit":
				self.io.sockets.emit(content.args[0],content.args[1]);
				break;
			case "r_broadcast_emit":
				// console.log("TRANSPORTS: ", self.io.sockets.manager.transports)
				for(socket in self.io.sockets.manager.sockets.sockets) {
					// console.log("SOCKET args: ",socket.id);
					// console.log("SOCKET: ",socket);
					// console.log("SOCKET transport: ",self.io.sockets.manager.transports[socket]);
					var args = Array.prototype.slice.call(content.args);
					io.sockets.socket(socket).emit(content.args[0],args.slice(1)); // Ref: http://chrissilich.com/blog/socket-io-0-7-sending-messages-to-individual-clients/
				}
				break;
		}
	});

	this.on = function(msg,cb) {
		self.io.sockets.on(msg,function(socket) {
			console.log("SOCKET ID: ",socket.id)
			if (msg == 'connection') {
				console.log("New connection");
			}
			socket.r_broadcast_emit = function() {
				var content = {
					command: "r_broadcast_emit",
					client_id: socket.id,
					process_id: self.process_id,
					args: arguments
				};
				console.log('r_broadcast_emit');
				socket.broadcast.emit.apply(socket,arguments);
				self.rc_pub.publish(self.redis_channel,JSON.stringify(content));
			};
			cb && cb(socket);
		});
	};

	this.r_emit = function() {
		// console.log("SOCKETS: ",self.io.sockets.manager.sockets.sockets);
		// console.log("--END SOCKETS");
		// console.log("r_emit calling")
		// console.log("ARGUMENTS",arguments);
		var content = {
			command: "r_emit",
			process_id: self.process_id,
			args: arguments
		};
		self.rc_pub.publish(self.redis_channel,JSON.stringify(content));
		self.io.sockets.emit(arguments[0],arguments[1]);
	};

	return this;

}