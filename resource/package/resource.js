
module.exports = function( host, config, server ) {
	return {
		name: "package",
		actions: {
			new: {
				url: "/",
				method: "post",
				handle: function( envelope ) {
					var info = envelope.data;
					console.log( "Dat webhook, tho", info );
					var compatible = info.package === config.package.package &&
						info.owner === config.package.owner &&
						info.branch === config.package.branch;
					if ( compatible ) {
						server.checkAvailable( info );
					}
					return { status: 200 };
				}
			}
		}
	};
};
