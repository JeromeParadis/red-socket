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
	this.debug_mode = (options && options.debug) || false;

	var self = this;

	// Set process id
	// -----------------------------
	this.rc.incr(redis_prefix + "processes.counter", function(err,res) {
		if (res)
			self.process_id = parseFloat(res);
		else
			console.log('Redis error: cannot set process id');
	});

	// Redis Sets wrapper
	// -----------------------------
	this.Sets = function(set) {
		var set_key = self.redis_prefix + set;
		var self_sets = this;
		// sets.add(value,unique,callback)
		// Add a member to a set
		// [value]:    value to add in the set
		// [unique]:   default false, must be unique?
		// [callback]: returns true or false on success or failure
		// -----------------------------
		this.add = function(value,unique,callback) {			
			self.debug("sets.add()",set,value,unique)
			if (unique) {
				self_sets.exists(value,function(err,result) {
					if (!err && result)
						callback && callback(false); // already exists
					else
						self_sets.add(value,false,callback);
				});
			}
			else {
				self.rc.sadd(set_key,value,function(err2,result2) {
					if (result2 && !err2)
						callback && callback(true); // success
					else
						callback && callback(false);	// Unknown error
					
				});

			}
			
		};

		this.delete = function(value,callback) {
			self.rc.srem(set_key,value,function(err,result) {
				if (!err)
					callback && callback(true); // success
				else
					callback && callback(false); // error	
			});
		};

		this.delete_set = function(callback) {
			self.rc.del(set_key,function(err,result) {
				if (!err)
					callback && callback(true); // success
				else
					callback && callback(false); // error	
			});
		};

		this.get_members = function(callback) {
			self.debug("Sets.get_members()");
			self.rc.smembers(set_key,function(err,members) {
				self.debug("MEMBERS",members);
				if (members && !err)
					callback && callback(members);
				else
					callback && callback([]);
			});
		};

		// sets.exists(set,value,callback)
		// Checks if value member of a set
		// [set]:      set key, i.e.: nicknames
		// [value]:    value to add in the set
		// [callback]: returns true or false on success or failure
		// -----------------------------
		this.exists = function(value,callback) {
			self.rc.sismember(set_key,value,function(err,result) {
				if (result && !err)
					callback(true); // Exists
				else {
					callback(false);
				}
			});
			
		};

		return this;
	};

	// Create publish subscribe
	// -----------------------------
	this.rc_sub.subscribe(self.redis_channel);

	this.rc_sub.on("message", function (channel, json) {
		var content = JSON.parse(json);
		self.debug("Message received",content);
		self.debug("command",content.command);
		switch(content.command) {
			case "r_emit":
				self.io.sockets.emit(content.args[0],content.args[1]);
				break;
			case "r_send_user":
				var sock = io.sockets.socket(content.client_id);
				if (sock && sock.id) {
					self.debug("sending direct update to ",sock.id)
					sock.emit(content.type,content.message);
				}
				break;
			case "r_broadcast_emit":
				// self.debug("TRANSPORTS: ", self.io.sockets.manager.transports)
				if (self.process_id == content.process_id) {
					// Sent by same process, use broadcast
					// i.e.: find emitting socket and use broadcast.emit method
					// ------------------------------
					var sock = io.sockets.socket(content.client_id).broadcast;
					if (sock)
						sock.emit.apply(sock,content.args);
					else
						// Socket,d oesnt exist anymore
						// Use global emit
						self.io.sockets.emit(content.args[0],content.args[1]);
					
				}
				else {
					// Different process, use emit
					// ------------------------------
					self.io.sockets.emit(content.args[0],content.args[1]);
				}
				break;
		}
	});

	this.on = function(msg,cb) {
		self.io.sockets.on(msg,function(socket) {
			self.debug("SOCKET ID: ",socket.id)
			if (msg == 'connection') {
				self.debug("New connection");
			}
			socket.r_broadcast_emit = function() {
				self.debug('ARGUMENTS:',arguments);
				var args = [];
				for (var i=0;i<arguments.length;i++) {
					args.push(arguments[i]);
				}
				var content = {
					command: "r_broadcast_emit",
					client_id: socket.id,
					process_id: self.process_id,
					args: args
				};
				self.debug('r_broadcast_emit');
				self.debug('CONTENT:',content);
				//socket.broadcast.emit.apply(socket,arguments);
				self.rc_pub.publish(self.redis_channel,JSON.stringify(content));
			};
			cb && cb(socket);
		});
	};

	this.r_send_user = function(socketid,type,msg) {
		var content = {
			command: "r_send_user",
			client_id: socketid,
			process_id: self.process_id,
			type: type,
			message: msg
		};
		self.debug('r_send_user');
		//socket.broadcast.emit.apply(socket,arguments);
		self.rc_pub.publish(self.redis_channel,JSON.stringify(content));		
	};

	this.r_emit = function() {
		// self.debug("SOCKETS: ",self.io.sockets.manager.sockets.sockets);
		// self.debug("--END SOCKETS");
		// self.debug("r_emit calling")
		// self.debug("ARGUMENTS",arguments);
		var content = {
			command: "r_emit",
			process_id: self.process_id,
			args: arguments
		};
		self.rc_pub.publish(self.redis_channel,JSON.stringify(content));
		//self.io.sockets.emit(arguments[0],arguments[1]);
	};

	this.debug = function() {
		if (self.debug_mode) {
			var args = Array.prototype.slice.call(arguments);
			args.splice(0,0,"DEBUG")
			console.log.apply(console,args);
		}
	};

	if (this.debug_mode) {
		console.log("DEBUG mode ON.");
	}



	return this;

}