
module.exports = function( host, config, server ) {
	return {
		name: "package",
		actions: {
			new: {
				url: "/",
				method: "post",
				handle: function( envelope ) {
					var info = envelope.data;
					var compatible = info.project === config.package.project;
					if ( compatible ) {
						server.checkForNew();
					}
					return { status: 200 };
				}
			}
		}
	};
};
