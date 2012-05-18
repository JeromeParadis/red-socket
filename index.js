var redis = require('redis');


exports = module.exports = Manager;

function Manager(io, options) {
	// Set up options
	// -----------------------------
	if (!options) options = {}
	this.io = io;
	this.redis_prefix = options.redis_prefix || '';
	this.redis_channel = this.redis_prefix || 'rc';
	this.rc = options.redis_client || createClient(null, null, {prefix: this.redis_prefix});
	this.rc_pub = options.redis_client_pub || createClient(null, null, {prefix: this.redis_prefix});
	this.rc_sub = options.redis_client_sub || createClient(null, null, {prefix: this.redis_prefix});
	this.debug_mode = options.debug || false;

	var self = this;

	// Set process id
	// -----------------------------
	this.rc.incr("processes.counter", function(err,res) {
		
		if (res)
			self.process_id = parseFloat(res);
		else
			console.log('Redis error: cannot set process id', err);
	});

	// Redis Sets wrapper
	// -----------------------------
	this.Sets = function(set) {
		var set_key = set;
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

	this.on = function(msg, cb) {
		self.io.sockets.on(msg, function(socket) {
			self.debug("SOCKET ID: ",socket.id)
			if (msg == 'connection') {
				self.debug("New connection");
			}
			socket.r_broadcast_emit = function() {
				self.debug('ARGUMENTS:',arguments);
				
				//~ var args = [];
				//~ for (var i=0;i<arguments.length;i++) {
					//~ args.push(arguments[i]);
				//~ }
				var args = arguments.slice();
				
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

	this.r_send_user = function(socketid, type, msg) {
		var content = {
			command: "r_send_user",
			client_id: socketid,
			process_id: self.process_id,
			type: type,
			message: msg
		};
		self.debug('r_send_user');
		//socket.broadcast.emit.apply(socket,arguments);
		self.rc_pub.publish(self.redis_channel, JSON.stringify(content));
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


/**
 * 
 * Class to aid with the prefixing of keys.
 * 
 */
function NamespaceRedisClient(net_client, options) {
	redis.RedisClient.call(this, net_client, options);
	this.prefix = options && options.prefix ? options.prefix : '';
	console.log('NamespaceRedisClient()', 'options:', options);
}


/**
 * Funky way to implement inheritence.
 */
NamespaceRedisClient.prototype = (function() {
	var chain = function(){}
	chain.prototype = redis.RedisClient.prototype;
	return new chain();
})();


NamespaceRedisClient.prototype.constructor = NamespaceRedisClient;


/**
 * Overrides the send_command function to pre-fix key names if necessary.
 * Arguments are passed in the for of either:
 * 		send_command(command, [arg1, arg2], cb);
 * OR:
 * 		send_command(command, [arg1, arg2, cb]);
 */
NamespaceRedisClient.prototype.send_command = function (command, args, callback) {
	if (this.prefix) {
		if (!callback && typeof(args[args.length-1]) == 'function') {
			callback = args.pop();
		}
		var i = args.length, cmdType = NamespaceRedisClient.getCommandArgSubType(command);
		switch (cmdType) {
			case 'first':
				args[0] = this.addPrefix(args[0]);
				break;
			case 'all':
				while (i--) args[i] = this.addPrefix(args[i]);
				break;
			case 'odd':
				if (i%2) i--;
				while (i -= 2 >= 0) args[i] = this.addPrefix(args[i]);
				break;
			case 'allButFirst':
				while (--i) args[i] = this.addPrefix(args[i]);
				break;
			case 'allButSecond':
				while (i--) {
					if (i != 1) args[i] = this.addPrefix(args[i]);
				}
				break;
			case 'allButLast':
				i--;
				while (i--) args[i] = this.addPrefix(args[i]);
				break;
		}
	}
	console.log('NamespaceRedisClient.send_command()', 'type:', cmdType, 'command:', command, args);
	//~ if (args[0] == 'shwowp-notify.shwowp-notify.processes.counter') throw new Error('debug');
	return redis.RedisClient.prototype.send_command.call(this, command, args, callback);
}


/**
 * Adds the prefix.
 */
NamespaceRedisClient.prototype.addPrefix = function(key) {
	if (key.charAt(0) == ':') {
		key = key.substr(1);
	}
	else if (key.substr(0, this.prefix.length) != this.prefix) {
		key = this.prefix + key;
	}
	return key;
}


NamespaceRedisClient.getCommandArgSubType = function(command) {
	command = command.toLowerCase();
	if (NamespaceRedisClient.FIRST_ARG_CMDS.indexOf(command) > -1) return 'first';
	if (NamespaceRedisClient.ALL_ARG_CMDS.indexOf(command) > -1) return 'all';
	if (NamespaceRedisClient.ALL_ODD_ARG_CMDS.indexOf(command) > -1) return 'odd';
	if (NamespaceRedisClient.ALL_BUT_FIRST_ARG_CMDS.indexOf(command) > -1) return 'allButFirst';
	if (NamespaceRedisClient.ALL_BUT_SECOND_ARG_CMDS.indexOf(command) > -1) return 'allButSecond';
	if (NamespaceRedisClient.ALL_BUT_LAST_ARG_CMDS.indexOf(command) > -1) return 'allButLast';
	return null;
}

NamespaceRedisClient.FIRST_ARG_CMDS = ['dmp', 'exists', 'expire', 'expireat', 'keys', 'move', 'persist', 'pexpire', 'pexpireat', 'pttl', 'restore', 'sort', 'ttl', 'type', 'append', 'decr', 'decrby', 'get', 'getbit', 'getrange', 'getset', 'incr', 'incrby', 'incrbyfloat', 'psetx', 'set', 'setbit', 'setex', 'setnx', 'setrange', 'strlen', 'hdel', 'hexists', 'hget', 'hgetall', 'hincrby', 'hincrbyfloat', 'hkeys', 'hlen', 'hmget', 'hmset', 'hset', 'hsetnx', 'hvals', 'lindex', 'linsert', 'llen', 'lpop', 'lpush', 'lpushx', 'lrange', 'lrem', 'lset', 'ltrim', 'rpop', 'rpush', 'rpushx', 'sadd', 'scard', 'sismember', 'smembers', 'spop', 'srandmember', 'srem', 'zadd', 'zcard', 'zcount', 'zincrby', 'zrange', 'zrangebyscore', 'zrank', 'zrem', 'zremrangebyrank', 'zremrangebyscore', 'zrevrange', 'zrevrangebyscore', 'zrevrank', 'zscore'];
NamespaceRedisClient.ALL_ARG_CMDS = ['del', 'rename', 'renamenx', 'mget', 'rpoplpush', 'sdiff', 'sdiffstore', 'sinter', 'sinterstore', 'sunion', 'sunionstore', 'watch'];
NamespaceRedisClient.ALL_ODD_ARG_CMDS = ['mset', 'msetnx'];
NamespaceRedisClient.ALL_BUT_FIRST_ARG_CMDS = ['object'];
NamespaceRedisClient.ALL_BUT_SECOND_ARG_CMDS = ['zinterstore', 'zunionstore'];
NamespaceRedisClient.ALL_BUT_LAST_ARG_CMDS = ['blpop', 'brpop', 'brpoplpush', 'smove'];
//~ NamespaceRedisClient.UNSUPPORTED_CMDS = ['migrate', 'script'];


/**
 * A complete cut-and-paste job of the createClient function in redis
 * except it returns a NamespaceRedisClient instead.
 */
var net = require("net"),
    default_port = 6379,
    default_host = "127.0.0.1";

var createClient = function (port_arg, host_arg, options) {
    var port = port_arg || default_port,
        host = host_arg || default_host,
        redis_client, net_client;

    net_client = net.createConnection(port, host);

    redis_client = new NamespaceRedisClient(net_client, options);

    redis_client.port = port;
    redis_client.host = host;

    return redis_client;
};

